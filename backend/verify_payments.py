"""End-to-end verification of the Razorpay credential vault."""
import os
os.environ["ADMIN_SEED_PASSWORD"] = "TestPass123"
from app import create_app, bcrypt, get_razorpay_credentials, \
    clear_razorpay_cache, verify_razorpay_webhook_signature
from models import db, User, Admin, StoreSetting, Order

results = []
def check(label, cond, extra=""):
    results.append((label, bool(cond), extra))
    print(("PASS  " if cond else "FAIL  ") + label + (f"   [{extra}]" if extra else ""))

app = create_app()
c = app.test_client()
r = c.post("/api/auth/login", json={"email": "admin", "password": "TestPass123"})
H = {"Authorization": "Bearer " + r.get_json()["access_token"],
     "X-CSRF-TOKEN": r.get_json().get("csrf_access_token", "")}
check("superadmin login", r.status_code == 200)

# --- 1. initial state -------------------------------------------------------
r0 = c.get("/api/admin/settings/payment", headers=H)
d0 = r0.get_json()
check("GET settings responds with expected shape",
      r0.status_code == 200 and isinstance(d0.get("razorpay_key_secret_set"), bool)
      and d0.get("encryption_configured") is True,
      f"source={d0['source']}")

# --- 2. dept gate: non-finance admin denied ---------------------------------
with app.app_context():
    it_admin = db.session.scalars(db.select(Admin).where(
        Admin.email == "it-admin@test.local")).first()
    if not it_admin:
        it_admin = Admin(email="it-admin@test.local")
        it_admin.is_superadmin = False
        db.session.add(it_admin)
    it_admin.admin_department = "IT"
    it_admin.set_password("Passw0rd1", bcrypt)
    db.session.commit()
c2 = app.test_client()
r_it = c2.post("/api/auth/login", json={"email": "it-admin@test.local", "password": "Passw0rd1"})
H_IT = {"Authorization": "Bearer " + r_it.get_json()["access_token"]}
check("non-finance admin blocked (GET)", c2.get("/api/admin/settings/payment",
      headers=H_IT).status_code == 403)
check("non-finance admin blocked (POST)", c2.post("/api/admin/settings/payment",
      json={"razorpay_mode": "live"}, headers=H_IT).status_code == 403)

# --- 3. validations ----------------------------------------------------------
r = c.post("/api/admin/settings/payment", json={"razorpay_mode": "staging"}, headers=H)
check("invalid mode rejected", r.status_code == 400)
r = c.post("/api/admin/settings/payment",
           json={"razorpay_key_id": "rzp_live_xxx", "razorpay_mode": "test"}, headers=H)
check("key-prefix/mode mismatch rejected", r.status_code == 400)

# --- 4. save full test-mode config -------------------------------------------
SECRET = "rzp_test_SECRETVALUE123"
r = c.post("/api/admin/settings/payment", headers=H, json={
    "razorpay_key_id": "rzp_test_ABCDEF123456",
    "razorpay_key_secret": SECRET,
    "razorpay_webhook_secret": "whsec_abc123",
    "razorpay_mode": "test",
    "razorpay_enabled": True,
})
check("save config -> 200", r.status_code == 200)
body = r.get_json()
check("response never leaks secret", SECRET not in r.get_data(as_text=True))
masked = body.get("razorpay_key_masked", "")
check("masked key shown", masked.endswith(SECRET[-4:]) and "••••" in masked,
      f"masked={masked}")

# --- 5. encrypted at rest ----------------------------------------------------
with app.app_context():
    enc = __import__("app")._setting_value("razorpay_key_secret")
    check("secret stored encrypted (not plaintext)",
          enc and SECRET not in enc and enc != SECRET)
    check("decrypt round-trip", __import__("app")._decrypt_secret(enc) == SECRET)

# --- 6. GET masks everything --------------------------------------------------
r = c.get("/api/admin/settings/payment", headers=H)
raw = r.get_data(as_text=True)
d = r.get_json()
check("GET leaks neither secret nor webhook secret",
      SECRET not in raw and "whsec_abc123" not in raw)
check("GET reports webhook configured", d.get("razorpay_webhook_secret_set") is True)
check("GET shows enabled+mode", d.get("razorpay_enabled") is True and d.get("razorpay_mode") == "test")

# --- 7. update WITHOUT secret keeps old one -----------------------------------
r = c.post("/api/admin/settings/payment", headers=H,
           json={"razorpay_key_id": "rzp_test_ABCDEF123456", "razorpay_enabled": False})
with app.app_context():
    enc2 = __import__("app")._setting_value("razorpay_key_secret")
check("secret preserved when omitted", __import__("app")._decrypt_secret(enc2) == SECRET)
clear_razorpay_cache()
with app.app_context():
    creds = get_razorpay_credentials(force_refresh=True)
check("resolver: disabled flag honoured", creds and creds["enabled"] is False)
check("resolver source = database", creds and creds["source"] == "database")

# --- 8. webhook signature helper ----------------------------------------------
payload = b'{"event":"payment.captured"}'
sig = __import__("hmac").new(b"whsec_abc123", payload, __import__("hashlib").sha256).hexdigest()
check("webhook signature valid", verify_razorpay_webhook_signature(payload, sig, "whsec_abc123"))
check("webhook signature tamper caught",
      not verify_razorpay_webhook_signature(payload + b"x", sig, "whsec_abc123"))

print(f"\n===== {sum(1 for _,ok,_ in results if ok)}/{len(results)} checks passed =====")
raise SystemExit(1 if any(not ok for _, ok, _ in results) else 0)
