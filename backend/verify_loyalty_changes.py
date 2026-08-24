"""Verify: loyalty-rate validation, journaling on admin set-balance, referral removal."""
import os
os.environ["ADMIN_SEED_PASSWORD"] = "TestPass123"
from app import create_app, bcrypt, get_loyalty_settings
from models import db, User, StoreSetting, WalletTransaction

a = create_app()
results = []
def check(label, cond, extra=""):
    results.append((label, bool(cond), extra))
    print(("PASS  " if cond else "FAIL  ") + label + (f"   [{extra}]" if extra else ""))

c = a.test_client()
r = c.post("/api/auth/login", json={"email": "admin", "password": "TestPass123"})
H = {"Authorization": f"Bearer {r.get_json()['access_token']}"}
print("admin login:", r.status_code)

# --- Fix 1: rate validation -------------------------------------------------
r1 = c.put("/api/admin/store-settings", json={"loyalty_earn_rate": "abc"}, headers=H)
check("invalid rate text rejected", r1.status_code == 400, f"{r1.status_code}")
r2 = c.put("/api/admin/store-settings", json={"loyalty_review_points": 250}, headers=H)
check("review pct >100 rejected", r2.status_code == 400, f"{r2.status_code}")
r3 = c.put("/api/admin/store-settings",
           json={"loyalty_earn_rate": 0.15, "loyalty_redeem_rate": 0.02,
                 "loyalty_review_points": 12}, headers=H)
check("valid rates accepted", r3.status_code == 200, f"{r3.status_code}")
with a.app_context():
    earn, redeem = get_loyalty_settings()
    check("rates persisted & readable", str(earn) == "0.15" and str(redeem) == "0.02",
          f"earn={earn} redeem={redeem}")

# --- Fix 2: journaled manual balance set ------------------------------------
with a.app_context():
    cust = User(email="adj@test.local", role="customer", first_name="A", last_name="D")
    cust.is_email_verified = True
    cust.set_password("Passw0rd1", bcrypt)
    db.session.add(cust)
    db.session.commit()
    cid = cust.id

# superadmin sets balance via the users PUT route
r4 = c.put("/api/admin/users/%d" % cid, json={"loyalty_points": 100}, headers=H)
print("set->100:", r4.status_code)
r5 = c.put("/api/admin/users/%d" % cid, json={"loyalty_points": 40}, headers=H)
print("set->40:", r5.status_code)
r6 = c.put("/api/admin/users/%d" % cid, json={"loyalty_points": -5}, headers=H)
check("negative balance rejected", r6.status_code == 400, f"{r6.status_code}")
with a.app_context():
    u = db.session.get(User, cid)
    txs = db.session.scalars(db.select(WalletTransaction)
                             .where(WalletTransaction.user_id == cid)).all()
    check("balance applied", (u.loyalty_points or 0) == 40, f"bal={u.loyalty_points}")
    deltas = sorted(t.amount for t in txs if "Admin balance adjustment" in (t.description or ""))
    check("both adjustments journaled (+100 credit, -60 debit)", deltas == [-60, 100],
          f"deltas={deltas}")
    kinds = {("credit" if t.amount > 0 else "debit") for t in txs
             if "Admin balance adjustment" in (t.description or "")}
    check("journal types correct", kinds == {"credit", "debit"}, f"kinds={kinds}")

# --- Referral removal -------------------------------------------------------
with a.app_context():
    lc = a.test_client()
    rr = lc.post("/api/auth/login", json={"email": "adj@test.local", "password": "Passw0rd1"})
    lh = {"Authorization": "Bearer " + rr.get_json()["access_token"]}
    r7 = lc.get("/api/customer/loyalty", headers=lh)
    body = r7.get_json() or {}
    check("loyalty history has no referral fields",
          r7.status_code == 200 and "referral_code" not in body and "referral_count" not in body,
          f"keys={sorted(body.keys())}")

fails = [x for x in results if not x[1]]
print(f"\n===== {len(results)-len(fails)}/{len(results)} checks passed =====")
raise SystemExit(1 if fails else 0)
