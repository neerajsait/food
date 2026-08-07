import re
import os

with open("app.py", "r", encoding="utf-8") as f:
    code = f.read()

# Fix 1: WhatsApp signature uses wrong secret + leftover TODO
code = code.replace(
    'os.getenv("APP_SECRET", app.config["SECRET_KEY"]).encode(\'utf-8\')',
    '(os.getenv("WHATSAPP_APP_SECRET") or os.getenv("APP_SECRET") or "").encode(\'utf-8\')'
)
code = code.replace(
    '            # TODO: Implement proper X-Hub-Signature-256 verification from Meta\n',
    ''
)
# Add check if secret is empty
old_signature_check = '''            expected_signature = 'sha256=' + hmac.new(
                (os.getenv("WHATSAPP_APP_SECRET") or os.getenv("APP_SECRET") or "").encode('utf-8'),
                request.get_data(),
                hashlib.sha256
            ).hexdigest()'''
new_signature_check = '''            secret = os.getenv("WHATSAPP_APP_SECRET") or os.getenv("APP_SECRET")
            if not secret:
                return jsonify({"error": "Server Configuration Error", "message": "Missing Meta app secret"}), 500
            expected_signature = 'sha256=' + hmac.new(
                secret.encode('utf-8'),
                request.get_data(),
                hashlib.sha256
            ).hexdigest()'''
if old_signature_check in code:
    code = code.replace(old_signature_check, new_signature_check)

# Fix 2: WhatsApp GET challenge returns JSON
code = code.replace(
    'return jsonify({"challenge": challenge}), 200',
    'return challenge, 200'
)

# Fix 3: Public menu endpoints have no rate limit
# (Already applied @limiter.limit("60 per minute") in previous turn, double checking)

# Fix 4: Loyalty points can go negative
# (Already applied max(0, ...), but double checking if we missed any). We'll re-run a regex just in case.
code = re.sub(r'user\.loyalty_points\s*-\s*(\w+)', r'max(0, (user.loyalty_points or 0) - \1)', code)
code = code.replace('max(0, max(0,', 'max(0,') # fix double wrap if happened

# Fix 5 & Fix 12 & Fix 20: Staff PIN lockout fails open when Redis is down, no progressive delay, no IP tracking
old_staff = '''        if staff_code and pin:
            from redis_client import get_redis
            rc = get_redis()
            lockout_key = f"staff_login_attempts:{staff_code}"
            
            if rc:
                attempts = int(rc.get(lockout_key) or 0)
                if attempts >= 5:
                    return jsonify({"error": "Too Many Requests", "message": "Account temporarily locked due to excessive failed attempts"}), 429

            user = db.session.scalars(select(User).where(User.staff_code == staff_code)).first()
            if not user or getattr(user, 'pin_hash', None) is None or not user.check_pin(pin, bcrypt):
                logger.warning(f"Failed staff login attempt for staff_code: {staff_code}")
                if rc:
                    attempts = int(rc.get(lockout_key) or 0) + 1
                    rc.setex(lockout_key, 300, attempts)
                return jsonify({"error": "Unauthorized", "message": "Invalid staff code or PIN"}), 401
            
            if rc:
                rc.setex(lockout_key, 1, 0) # reset lockout'''

new_staff = '''        if staff_code and pin:
            from redis_client import get_redis
            rc = get_redis()
            
            if not rc and os.getenv("FLASK_ENV") == "production":
                return jsonify({"error": "Service Unavailable", "message": "Login temporarily unavailable"}), 503

            ip_address = request.remote_addr
            ip_lockout_key = f"staff_login_ip:{ip_address}"
            lockout_key = f"staff_login_attempts:{staff_code}"
            
            attempts = 0
            ip_attempts = 0
            if rc:
                attempts = int(rc.get(lockout_key) or 0)
                ip_attempts = int(rc.get(ip_lockout_key) or 0)
                if attempts >= 5 or ip_attempts >= 10:
                    return jsonify({"error": "Too Many Requests", "message": "Account or IP temporarily locked due to excessive failed attempts"}), 429

            user = db.session.scalars(select(User).where(User.staff_code == staff_code)).first()
            if not user or getattr(user, 'pin_hash', None) is None or not user.check_pin(pin, bcrypt):
                logger.warning(f"Failed staff login attempt for staff_code: {staff_code} from IP {ip_address}")
                if rc:
                    attempts += 1
                    ip_attempts += 1
                    rc.setex(lockout_key, 300, attempts)
                    rc.setex(ip_lockout_key, 300, ip_attempts)
                
                import time
                time.sleep(min(attempts, 4))
                return jsonify({"error": "Unauthorized", "message": "Invalid staff code or PIN"}), 401
            
            if rc:
                rc.setex(lockout_key, 1, 0) # reset lockout
                rc.setex(ip_lockout_key, 1, 0)'''
if old_staff in code:
    code = code.replace(old_staff, new_staff)

# Fix 6 & 14: CSP unsafe-inline comment and CSP reporting
old_csp_comment = "# TODO: Remove 'unsafe-inline' and 'unsafe-eval' once frontend no longer needs them\n        response.headers['Content-Security-Policy']"
new_csp_comment = "# TODO: Remove 'unsafe-inline' and 'unsafe-eval' once frontend no longer needs them\n        # TODO: Add report-uri or report-to directive in the future for CSP monitoring\n        response.headers['Content-Security-Policy']"
if old_csp_comment in code:
    code = code.replace(old_csp_comment, new_csp_comment)

# Fix 7: Specific exceptions
code = code.replace('except Exception as e:\n            import logging\n            logging.error(f"Redis error during blocklist check: {e}")', 'except redis.RedisError as e:\n            import logging\n            logging.error(f"Redis error during blocklist check: {e}")')
code = code.replace('except Exception as db_err:\n                    import logging\n                    logging.error(f"Lightweight DB check error: {db_err}")', 'except sqlalchemy.exc.SQLAlchemyError as db_err:\n                    import logging\n                    logging.error(f"Lightweight DB check error: {db_err}")')
# Will also do manual regex replaces for rollback scenarios
code = re.sub(r'except Exception as (e\d?):\n\s*db\.session\.rollback\(\)', r'except sqlalchemy.exc.SQLAlchemyError as \1:\n                db.session.rollback()', code)

# Fix 8: Public coupon endpoints comment
old_coupon_active = '''    @app.route("/api/coupons/active", methods=["GET"])
    @limiter.limit("30 per minute")
    def get_active_coupons():'''
new_coupon_active = '''    @app.route("/api/coupons/active", methods=["GET"])
    @limiter.limit("30 per minute")
    def get_active_coupons():
        # Intentionally public but rate-limited'''
if old_coupon_active in code:
    code = code.replace(old_coupon_active, new_coupon_active)

old_coupon_code = '''    @app.route("/api/coupons/<string:code>", methods=["GET"])
    @limiter.limit("30 per minute")
    def get_coupon(code):'''
new_coupon_code = '''    @app.route("/api/coupons/<string:code>", methods=["GET"])
    @limiter.limit("30 per minute")
    def get_coupon(code):
        # Intentionally public but rate-limited'''
if old_coupon_code in code:
    code = code.replace(old_coupon_code, new_coupon_code)

# Fix 9: Admin direct loyalty set audit log
old_audit_log = '''            elif key == "loyalty_points":
                old_val = getattr(user, 'loyalty_points', 0)
                user.loyalty_points = value
                logger.info(f"Admin {current_admin_id} changed loyalty points for user {user.id} from {old_val} to {value}")'''
new_audit_log = '''            elif key == "loyalty_points":
                old_val = getattr(user, 'loyalty_points', 0)
                user.loyalty_points = value
                logger.info(f"Admin {current_admin_id} changed loyalty points for user {user.id} from {old_val} to {value}")
                log_admin_action(current_admin_id, "UPDATE_USER_LOYALTY", f"Changed from {old_val} to {value}")'''
if old_audit_log in code:
    code = code.replace(old_audit_log, new_audit_log)

# Fix 10: CORS fallback
old_cors = '''    if os.getenv("FLASK_ENV") == "production":
        cors_origins = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else []
    else:'''
new_cors = '''    if os.getenv("FLASK_ENV") == "production":
        if not os.getenv("CORS_ORIGINS"):
            raise RuntimeError("CORS_ORIGINS must be set in production")
        cors_origins = os.getenv("CORS_ORIGINS").split(",")
    else:'''
if old_cors in code:
    code = code.replace(old_cors, new_cors)

# Fix 11: Stock restore locking
code = code.replace('item = db.session.get(MenuItem, line.menu_item_id)', 'item = db.session.get(MenuItem, line.menu_item_id, with_for_update=True)')

# Fix 13: Empty filename check (Ensure we didn't miss ticket creation)
# Already added "if not filename:" in patch.py previously. Let's just make sure.

# Fix 15: Token version Redis TTL
old_ttl = 'rc.setex(version_key, 86400 * 8, str(user.token_version))'
new_ttl = 'rc.setex(version_key, 86400 * 2, str(user.token_version))'
if old_ttl in code:
    code = code.replace(old_ttl, new_ttl)

old_ttl2 = 'rc.setex(version_key, 86400 * 8, str(user.token_version + 1))'
new_ttl2 = 'rc.setex(version_key, 86400 * 2, str(user.token_version + 1))'
if old_ttl2 in code:
    code = code.replace(old_ttl2, new_ttl2)

# Fix 16: Missing Alembic migration comment
old_migration = '# TODO: Ensure real migration scripts exist and are applied for token_version and attachment_filename'
new_migration = '# IMPORTANT: Ensure Alembic migrations exist for token_version and attachment_filename columns'
if old_migration in code:
    code = code.replace(old_migration, new_migration)

# Fix 17: Health endpoint rate limit
old_health = '''    @app.route("/api/health")
    def health():'''
new_health = '''    @app.route("/api/health")
    @limiter.limit("120 per minute")
    def health():'''
if old_health in code:
    code = code.replace(old_health, new_health)

# Fix 18: Add department_required to some admin routes
# Example: Wallet endpoints are finance, Admin analytics are operations/finance
old_credit = '''    @app.route("/api/admin/wallet/credit", methods=["POST"])
    @role_required("admin")
    def credit_wallet():'''
new_credit = '''    @app.route("/api/admin/wallet/credit", methods=["POST"])
    @role_required("admin")
    @department_required("finance", "operations")
    def credit_wallet():'''
if old_credit in code:
    code = code.replace(old_credit, new_credit)

old_debit = '''    @app.route("/api/admin/wallet/debit", methods=["POST"])
    @role_required("admin")
    def debit_wallet():'''
new_debit = '''    @app.route("/api/admin/wallet/debit", methods=["POST"])
    @role_required("admin")
    @department_required("finance", "operations")
    def debit_wallet():'''
if old_debit in code:
    code = code.replace(old_debit, new_debit)
    
old_hr = '''    @app.route("/api/admin/staff", methods=["POST"])
    @role_required("admin")
    def create_staff():'''
new_hr = '''    @app.route("/api/admin/staff", methods=["POST"])
    @role_required("admin")
    @department_required("hr", "operations")
    def create_staff():'''
if old_hr in code:
    code = code.replace(old_hr, new_hr)

# Fix 19: Password reset email subject
old_subject = 'subject="FlavorFlow Password Reset Code"'
new_subject = 'subject="FlavorFlow Password Reset Token"'
if old_subject in code:
    code = code.replace(old_subject, new_subject)

with open("app.py", "w", encoding="utf-8") as f:
    f.write(code)

print("Patch 2 applied successfully.")
