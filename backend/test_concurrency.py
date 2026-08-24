"""Concurrency tests for the order placement flow.

Simulates high-contention checkouts (parallel threads) and asserts that:
  1. Stock can never be oversell-ed (guarded UPDATE ... WHERE stock >= qty).
  2. Coupon usage_limit cannot be exceeded under a race.
  3. Loyalty redemption can never drive the balance negative.
  4. A losing attempt inside the single transaction leaves NO partial state.

Run with:  python -m unittest test_concurrency -v
"""
import os
import random
import shutil
import tempfile
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor

os.environ.setdefault("FLASK_ENV", "development")

from sqlalchemy import select, func

from app import create_app, bcrypt
from models import db, User, MenuItem, Coupon, Order


class ConcurrencyBase(unittest.TestCase):
    """Shared harness backed by a real (temp-file) SQLite database so every
    thread gets its own pooled connection with proper transaction isolation."""

    @classmethod
    def setUpClass(cls):
        cls._tmpdir = tempfile.mkdtemp(prefix="ff-race-")
        db_path = os.path.join(cls._tmpdir, "race.db")
        cls.app = create_app({
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_path}",
            # Generous busy-timeout so SQLite writers serialize gracefully.
            "SQLALCHEMY_ENGINE_OPTIONS": {
                "connect_args": {"timeout": 30},
                "pool_pre_ping": True,
            },
            "RATELIMIT_ENABLED": False,
        })
        with cls.app.app_context():
            cust = User(email="race-customer@test.local", role="customer",
                        first_name="Race", last_name="Tester")
            cust.is_email_verified = True
            cust.set_password("Passw0rd1", bcrypt)
            db.session.add(cust)
            db.session.commit()
            cls.customer_id = cust.id

    @classmethod
    def tearDownClass(cls):
        with cls.app.app_context():
            db.session.remove()
        shutil.rmtree(cls._tmpdir, ignore_errors=True)

    def auth_headers(self):
        with self.app.test_client() as c:
            r = c.post("/api/auth/login",
                       json={"email": "race-customer@test.local",
                             "password": "Passw0rd1"})
            self.assertEqual(r.status_code, 200, r.get_data(as_text=True)[:200])
            token = r.get_json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def fire_parallel(self, n_threads, payload_fn):
        """Fires n_threads simultaneous POST /api/foods/order requests.
        Returns the list of HTTP status codes."""
        headers = self.auth_headers()
        go = threading.Event()

        def fire(_idx):
            with self.app.test_client() as c:
                for attempt in range(6):
                    try:
                        r = c.post("/api/foods/order", json=payload_fn(),
                                   headers=headers)
                        return r.status_code
                    except Exception as e:
                        # SQLite serializes writers; retry transient locks.
                        if "locked" in str(e).lower() and attempt < 5:
                            time.sleep(random.uniform(0.002, 0.04))
                            continue
                        return 500
                return 500

        with ThreadPoolExecutor(max_workers=n_threads) as ex:
            futures = [ex.submit(fire, i) for i in range(n_threads)]
            go.set()
            return [f.result(timeout=120) for f in futures]

class TestStockOversell(ConcurrencyBase):
    def test_no_oversell_under_contention(self):
        """12 parallel qty=1 orders against stock=5 -> exactly 5 succeed."""
        with self.app.app_context():
            item = MenuItem(name="Race Item", price=50,
                            business_type="home_foods", global_stock=5)
            db.session.add(item)
            db.session.commit()
            item_id = item.id

        codes = self.fire_parallel(
            12, lambda: {"items": [{"menu_item_id": item_id, "quantity": 1}],
                         "delivery_address": "Test Street 1"}
        )

        successes = codes.count(201)
        conflicts = codes.count(409)
        self.assertEqual(successes, 5,
                         f"expected exactly 5 successful orders, got {successes} ({codes})")
        self.assertGreaterEqual(conflicts, 1, "oversell was not prevented")

        with self.app.app_context():
            self.assertEqual(db.session.get(MenuItem, item_id).global_stock, 0,
                             "stock must be exactly zero after the race")


class TestCouponLimitRace(ConcurrencyBase):
    def test_coupon_usage_limit_not_exceeded(self):
        """12 parallel orders sharing usage_limit=3 coupon -> exactly 3 win."""
        with self.app.app_context():
            item = MenuItem(name="Coupon Race Item", price=100,
                            business_type="home_foods", global_stock=None)
            coupon = Coupon(code="RACE3", discount_pct=10, usage_limit=3)
            db.session.add_all([item, coupon])
            db.session.commit()
            item_id, code = item.id, coupon.code

        codes = self.fire_parallel(
            12, lambda: {"items": [{"menu_item_id": item_id, "quantity": 1}],
                         "delivery_address": "Test Street 1",
                         "coupon_code": code}
        )

        successes = codes.count(201)
        self.assertEqual(successes, 3,
                         f"exactly 3 orders should win the coupon, got {successes} ({codes})")
        self.assertEqual(codes.count(400), 9,
                         f"losing attempts must be rejected, got {codes}")

        with self.app.app_context():
            c = db.session.scalars(select(Coupon).where(Coupon.code == code)).first()
            self.assertEqual(c.usage_count, 3, "usage_count must equal limit")


class TestLoyaltyRedeemRace(ConcurrencyBase):
    def test_redeem_never_negative_balance(self):
        """8 threads each redeeming 80 pts from a 100 pt balance.
        Invariants: final balance >= 0 AND total redeemed <= 100."""
        with self.app.app_context():
            cust = db.session.get(User, self.customer_id)
            cust.loyalty_points = 100
            item = MenuItem(name="Loyalty Item", price=500,
                            business_type="home_foods", global_stock=None)
            db.session.add(item)
            db.session.commit()
            item_id = item.id

        codes = self.fire_parallel(
            8, lambda: {"items": [{"menu_item_id": item_id, "quantity": 1}],
                        "delivery_address": "Test Street 1",
                        "redeem_loyalty_points": 80}
        )

        with self.app.app_context():
            cust = db.session.get(User, self.customer_id)
            total_redeemed = db.session.scalar(
                select(func.coalesce(func.sum(Order.loyalty_points_redeemed), 0))
            )
            self.assertGreaterEqual(cust.loyalty_points or 0, 0,
                                    "loyalty balance went negative!")
            self.assertLessEqual(int(total_redeemed), 100,
                                 f"redeemed {total_redeemed} > 100 points that existed!")
            self.assertIn(409, codes, "at least one redeem must lose the race")


class TestFailedAttemptAtomicity(ConcurrencyBase):
    def test_failed_checkout_leaves_no_partial_state(self):
        """coupon limit=1 + stock=50, 6 racing orders of qty=2:
        exactly ONE order survives; stock reflects ONLY that order."""
        with self.app.app_context():
            item = MenuItem(name="Atomic Item", price=80,
                            business_type="home_foods", global_stock=50)
            coupon = Coupon(code="ONCE1", discount_pct=5, usage_limit=1)
            db.session.add_all([item, coupon])
            db.session.commit()
            item_id, code = item.id, coupon.code

        codes = self.fire_parallel(
            6, lambda: {"items": [{"menu_item_id": item_id, "quantity": 2}],
                        "delivery_address": "Test Street 1",
                        "coupon_code": code}
        )

        successes = codes.count(201)
        self.assertEqual(successes, 1, f"only one order may win, got {successes}")

        with self.app.app_context():
            n_orders = db.session.scalar(select(func.count()).select_from(Order))
            self.assertEqual(n_orders, 1, "losing attempts left orphan order rows!")
            item = db.session.get(MenuItem, item_id)
            self.assertEqual(item.global_stock, 48,
                             "stock must reflect ONLY the successful order (50 - 2)")


if __name__ == "__main__":
    unittest.main(verbosity=2)

