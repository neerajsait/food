"""Behavioral proof for ticket-upload hardening + error-format policy."""
import io
import os
import shutil
import tempfile
from datetime import datetime, timezone, timedelta

os.environ["FLASK_ENV"] = "development"
os.environ.pop("CLAMD_HOST", None)
os.environ.pop("CLAMD_SOCKET", None)

from sqlalchemy import select
from app import create_app, bcrypt, _purge_old_ticket_attachments
from models import db, User, SupportTicket

PASS = "Passw0rd1"
results = []
def check(label, cond, extra=""):
    results.append((label, bool(cond), extra))
    print(("PASS  " if cond else "FAIL  ") + label + (f"   [{extra}]" if extra else ""))

# --- App harness (10MB body cap so our per-file limit triggers first) -------
tmp = tempfile.mkdtemp(prefix="ff-up-")
app = create_app({
    "TESTING": True,
    "SQLALCHEMY_DATABASE_URI": f"sqlite:///{os.path.join(tmp, 'v.db')}",
    "SQLALCHEMY_ENGINE_OPTIONS": {"connect_args": {"timeout": 30}},
    "RATELIMIT_ENABLED": False,
    "MAX_CONTENT_LENGTH": 10 * 1024 * 1024,
})

with app.app_context():
    cust = User(email="up@test.local", role="customer", first_name="U", last_name="T")
    cust.is_email_verified = True
    cust.set_password(PASS, bcrypt)
    db.session.add(cust)
    db.session.commit()
    cid = cust.id

c = app.test_client()
r = c.post("/api/auth/login", json={"email": "up@test.local", "password": PASS})
token = r.get_json()["access_token"]
H = {"Authorization": f"Bearer {token}"}

def png_bytes(size):
    data = b"\x89PNG\r\n\x1a\n" + b"A" * max(0, size - 8)
    return data

# --- 1. Valid PNG upload succeeds ------------------------------------------
r1 = c.post("/api/customer/tickets",
            data={"issue_type": "bug", "description": "d1",
                  "attachment": (io.BytesIO(png_bytes(2048)), "shot.png")},
            content_type="multipart/form-data", headers=H)
t1 = r1.get_json().get("ticket", {}) if r1.status_code == 201 else {}
fname = t1.get("attachment_filename")
saved = os.path.exists(os.path.join(__import__("app").TICKETS_UPLOAD_FOLDER, fname or "_"))
check("valid PNG upload -> 201 + saved", r1.status_code == 201 and bool(fname) and saved,
      f"status={r1.status_code}")

# --- 2. Disallowed extension rejected ---------------------------------------
r2 = c.post("/api/customer/tickets",
            data={"issue_type": "bug", "description": "d2",
                  "attachment": (io.BytesIO(b"MZ\x90\x00" + b"x" * 512), "evil.exe")},
            content_type="multipart/form-data", headers=H)
check("disallowed .exe rejected -> 400", r2.status_code == 400, f"status={r2.status_code}")

# --- 3. Oversized file rejected (>5MB per-file cap) -------------------------
r3 = c.post("/api/customer/tickets",
            data={"issue_type": "bug", "description": "d3",
                  "attachment": (io.BytesIO(png_bytes(6 * 1024 * 1024)), "big.png")},
            content_type="multipart/form-data", headers=H)
check("oversized >5MB rejected -> 400", r3.status_code == 400, f"status={r3.status_code}")

# --- 4. Per-user lifetime quota enforced ------------------------------------
with app.app_context():
    resp = __import__("app")._check_attachment_quota(cid, 21 * 1024 * 1024)
check("per-user quota (20MB) blocks 21MB upload", resp is not None and resp[1] == 400)

# --- 5. Production + scanner unreachable => fail-closed 503 -----------------
os.environ["CLAMD_HOST"] = "127.0.0.1"
os.environ["CLAMD_TCP_PORT"] = "1"           # nothing listening
os.environ["FLASK_ENV"] = "production"
try:
    r5 = c.post("/api/customer/tickets",
                data={"issue_type": "bug", "description": "d5",
                      "attachment": (io.BytesIO(png_bytes(1024)), "p.png")},
                content_type="multipart/form-data", headers=H)
    check("prod: scanner down => fail-closed 503", r5.status_code == 503,
          f"status={r5.status_code}")
finally:
    os.environ["FLASK_ENV"] = "development"
    os.environ.pop("CLAMD_HOST", None)
    os.environ.pop("CLAMD_TCP_PORT", None)

# --- 6+7. Retention cleanup job purges ONLY old closed tickets --------------
with app.app_context():
    now = datetime.now(timezone.utc)
    old_closed = SupportTicket(customer_id=cid, issue_type="i", description="old closed")
    db.session.add(old_closed); db.session.flush()
    old_file = os.path.join(__import__("app").TICKETS_UPLOAD_FOLDER, "old_closed.bin")
    with open(old_file, "wb") as f:
        f.write(b"payload-old-closed")
    old_closed.attachment_filename = "old_closed.bin"
    old_closed.attachment_url = f"/api/tickets/{old_closed.id}/attachment"
    old_closed.status = "Closed"
    old_closed.updated_at = now - timedelta(days=365)

    old_open = SupportTicket(customer_id=cid, issue_type="i", description="old open")
    db.session.add(old_open); db.session.flush()
    open_file = os.path.join(__import__("app").TICKETS_UPLOAD_FOLDER, "old_open.bin")
    with open(open_file, "wb") as f:
        f.write(b"payload-old-open")
    old_open.attachment_filename = "old_open.bin"
    old_open.attachment_url = f"/api/tickets/{old_open.id}/attachment"
    old_open.updated_at = now - timedelta(days=365)   # still 'Open' -> keep
    db.session.commit()

os.environ["TICKET_RETENTION_DAYS"] = "90"
purged = _purge_old_ticket_attachments(app)
check("cleanup purged exactly the old CLOSED ticket", purged == 1, f"purged={purged}")
check("closed ticket's file removed from disk", not os.path.exists(old_file))
check("open ticket's file kept", os.path.exists(open_file))



# --- 8/9. Error format: dev has traceback, prod never does ------------------
def _resolve_500_handler(a):
    """Recursively locate the Exception-keyed handler anywhere inside
    Flask's error_handler_spec (structure varies across Flask versions)."""
    def find(node):
        if isinstance(node, dict):
            h = node.get(Exception)
            if callable(h):
                return h
            for v in node.values():
                r = find(v)
                if r is not None:
                    return r
        return None
    return find(a.error_handler_spec)

handler = _resolve_500_handler(app)
print("resolved 500 handler:", "OK" if handler else "NOT FOUND")

with app.test_request_context("/"):
    os.environ["FLASK_ENV"] = "development"
    resp_dev, code_dev = handler(ValueError("boom-dev"))
body_dev = resp_dev.get_json()
check("dev 500 keeps structured debug.traceback",
      code_dev == 500 and isinstance(body_dev.get("debug", {}).get("traceback"), list),
      f"code={code_dev}")

with app.test_request_context("/"):
    os.environ["FLASK_ENV"] = "production"
    resp_prod, code_prod = handler(ValueError("boom-prod"))
os.environ["FLASK_ENV"] = "development"
raw_prod = resp_prod.get_data(as_text=True)
body_prod = resp_prod.get_json()
check("prod 500 has NO traceback/debug leak",
      code_prod == 500 and "traceback" not in raw_prod and "boom-prod" not in raw_prod
      and "debug" not in body_prod)
check("prod 500 returns correlation error_id",
      bool(body_prod.get("error_id")) and bool(body_prod.get("timestamp")))

shutil.rmtree(tmp, ignore_errors=True)
fails = [x for x in results if not x[1]]
print(f"\n===== {len(results) - len(fails)}/{len(results)} checks passed =====")
raise SystemExit(1 if fails else 0)
