"""One-shot verification: access-token cookie + CSRF double-submit flow."""
import os
os.environ["ADMIN_SEED_PASSWORD"] = "TestPass123"
from app import create_app, bcrypt
from models import db, User

a = create_app()
with a.app_context():
    u = db.session.scalars(db.select(User).where(User.email == "admin")).first()
    if u:
        u.set_password("TestPass123", bcrypt)
        u.is_first_login = False
        db.session.commit()

c = a.test_client()
print("--- login ---")
r = c.post("/api/auth/login", json={"email": "admin", "password": "TestPass123"})
print("status:", r.status_code)
sc_all = " | ".join(r.headers.getlist("Set-Cookie"))
for name in ("access_token", "csrf_access_token", "refresh_token"):
    hit = [s for s in r.headers.getlist("Set-Cookie") if s.startswith(name + "=")]
    print(f"cookie {name}: {'SET' if hit else 'MISSING'}",
          ("HttpOnly" if "HttpOnly" in hit[0] else "READABLE") if hit else "")
body = r.get_json() or {}
print("body carries access_token (API-client compat):", bool(body.get("access_token")))

print("--- 1. GET via cookie ONLY (no Authorization header) ---")
r2 = c.get("/api/auth/me")
print("status:", r2.status_code, "(expect 200)")

print("--- 2. POST via cookie WITHOUT CSRF header must be rejected ---")
r3 = c.post("/api/admin/outlets", json={})
print("status:", r3.status_code, "(expect 401 missing-CSRF)")
if r3.status_code == 401:
    print("   body:", r3.get_data(as_text=True)[:120])

print("--- 3. POST via cookie WITH X-CSRF-TOKEN passes auth ---")
# Extract csrf value from the login response's Set-Cookie headers.
csrf = None
for s in r.headers.getlist("Set-Cookie"):
    if s.startswith("csrf_access_token="):
        csrf = s.split("=", 1)[1].split(";", 1)[0]
print("csrf extracted:", bool(csrf))
r5 = c.post("/api/admin/outlets", json={"name": ""},
            headers={"X-CSRF-TOKEN": csrf} if csrf else {})
print("protected POST with CSRF:", r5.status_code,
      "(expect 400 business error - i.e. auth+CSRF passed, NOT 401)")
if r5.status_code == 401:
    print("   body:", r5.get_data(as_text=True)[:150])

print("--- 4. Authorization-header path unaffected (no cookies) ---")
c2 = a.test_client()
token = None
with c2.session_transaction() as s:
    pass
rl = c2.post("/api/auth/login", json={"email": "admin", "password": "TestPass123"})
token = rl.get_json()["access_token"]
rm = c2.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
print("header-auth GET:", rm.status_code, "(expect 200)")

print("--- 5. logout clears all cookies ---")
r6 = c.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
sc6 = " || ".join(r6.headers.getlist("Set-Cookie"))
cleared = sum(1 for n in ("access_token", "csrf_access_token") if f"{n}=;" in sc6 or f"{n}=\"\";" in sc6)
print("logout:", r6.status_code, "| jwt cookies cleared:", cleared, "/2",
      "| refresh cleared:", "max-age=0" in sc6.lower())
