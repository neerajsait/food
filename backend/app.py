import os
import io
import json
import base64
import random
import logging
from datetime import datetime, timezone, timedelta
from functools import wraps
from decimal import Decimal
from sqlalchemy import select, func
from flask import Flask, request, jsonify, Request
from flask_bcrypt import Bcrypt
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, get_jwt, get_jwt_identity
)
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mail import Mail, Message
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
import qrcode
from flask_cors import CORS

from models import (
    db, User, Admin, Customer, Staff, OutletOwner, Outlet, MenuItem, OutletStock,
    Supplier, SupplierItem, StockAuditLog, ProductBatch,
    Order, OrderItem, Review, Coupon, StaffShift, Address, Favorite, AdminAuditLog,
    KitchenStaff, ProductionBatch
)
import bleach

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

bcrypt = Bcrypt()
jwt = JWTManager()
mail = Mail()
limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")


# ============================================================
# HELPERS
# ============================================================

def role_required(*roles):
    """Decorator: JWT required + role check."""
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            claims = get_jwt()
            if claims.get("role") not in roles:
                return jsonify({"error": "Forbidden", "message": "Insufficient permissions"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator

def sanitize_input(data, skip_keys=None):
    if skip_keys is None:
        skip_keys = ["password", "new_password", "old_password"]
        
    if isinstance(data, dict):
        return {k: (v if k in skip_keys else sanitize_input(v, skip_keys)) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_input(i, skip_keys) for i in data]
    elif isinstance(data, str):
        return bleach.clean(data)
    return data


def validate_phone(phone_str):
    """Sanitize and validate phone number to be exactly 10 digits."""
    if not phone_str:
        return True, None
    phone_str = str(phone_str).strip()
    if not phone_str:
        return True, None
    if not phone_str.isdigit() or len(phone_str) != 10:
        return False, None
    return True, phone_str


def log_stock_change(db_session, outlet_id, menu_item_id, change_qty, change_type,
                     stock_before=None, stock_after=None, reference_id=None,
                     performed_by=None, notes=None):
    """Helper to write a StockAuditLog entry."""
    entry = StockAuditLog(
        change_qty=change_qty,
        change_type=change_type,
        outlet_id=outlet_id,
        menu_item_id=menu_item_id,
        stock_before=stock_before,
        stock_after=stock_after,
        reference_id=reference_id,
        performed_by=performed_by,
        notes=notes
    )
    db_session.add(entry)

def log_admin_action(db_session, admin_id, action, target_entity=None, target_id=None, details=None):
    """Helper to write an AdminAuditLog entry."""
    entry = AdminAuditLog(
        admin_id=admin_id,
        action=action,
        target_entity=target_entity,
        target_id=target_id,
        details=details
    )
    db_session.add(entry)


def _generate_unique_code(db_session):
    """Generate a unique 4-digit numeric product code."""
    for _ in range(1000):
        code = f"{random.randint(1000, 9999)}"
        existing = db_session.scalars(
            select(MenuItem).where(MenuItem.code == code)
        ).first()
        if not existing:
            return code
    raise RuntimeError("Unable to generate a unique 4-digit product code after 1000 attempts")


def _generate_order_qr(app, order):
    """Generate a securely signed QR code for an order and save it as base64."""
    import hashlib, hmac
    qr_payload = {
        "action": "view_order",
        "order_id": order.id,
        "order_type": order.order_type
    }
    serialized = json.dumps(qr_payload, sort_keys=True)
    signature = hmac.new(app.config["SECRET_KEY"].encode(), serialized.encode(), hashlib.sha256).hexdigest()
    qr_payload["signature"] = signature
    
    try:
        payload_str = json.dumps(qr_payload)
        qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=4)
        qr.add_data(payload_str)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        # pyrefly: ignore [unexpected-keyword]
        img.save(buf, format="PNG")
        buf.seek(0)
        b64 = base64.b64encode(buf.read()).decode("utf-8")
        order.qr_code_base64 = f"data:image/png;base64,{b64}"
    except Exception as e:
        logger.error(f"QR generation failed for order {order.id}: {e}")


# ============================================================
# APP FACTORY
# ============================================================

class SanitizedRequest(Request):
    def get_json(self, *args, **kwargs):
        data = super().get_json(*args, **kwargs)
        if data:
            return sanitize_input(data)
        return data

def create_app(config_override=None):
    app = Flask(__name__)
    app.request_class = SanitizedRequest
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    CORS(app, resources={r"/api/*": {"origins": frontend_url}})

    # --- Config ---
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("werkzeug")
    
    @app.before_request
    def log_request_info():
        app.logger.info(f"Incoming Request: {request.method} {request.url}")

    @app.after_request
    def log_response_info(response):
        app.logger.info(f"Outgoing Response: {response.status} for {request.method} {request.url}")
        return response
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        h = os.getenv("MYSQL_HOST")
        u = os.getenv("MYSQL_USER")
        p = os.getenv("MYSQL_PASSWORD")
        d = os.getenv("MYSQL_DB")
        db_url = f"mysql+pymysql://{u}:{p}@{h}/{d}" if all([h, u, p, d]) else "sqlite:///food.db"

    app.config["SQLALCHEMY_DATABASE_URI"] = db_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_recycle": 280, "pool_pre_ping": True}
    
    secret_key = os.getenv("SECRET_KEY")
    jwt_secret_key = os.getenv("JWT_SECRET_KEY")
    if os.getenv("FLASK_ENV") == "production":
        if not secret_key:
            raise RuntimeError("SECRET_KEY must be set in production")
        if not jwt_secret_key:
            raise RuntimeError("JWT_SECRET_KEY must be set in production")
            
    app.config["SECRET_KEY"] = secret_key or os.urandom(24).hex()
    app.config["JWT_SECRET_KEY"] = jwt_secret_key or os.urandom(24).hex()
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=8)

    # Mail config
    app.config["MAIL_SERVER"] = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    app.config["MAIL_PORT"] = int(os.getenv("MAIL_PORT", 587))
    app.config["MAIL_USE_TLS"] = True
    app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME", "")
    app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD", "")
    app.config["MAIL_DEFAULT_SENDER"] = os.getenv("MAIL_USERNAME", "noreply@fooderp.local")
    app.config["ADMIN_EMAIL"] = os.getenv("ADMIN_EMAIL", "")

    if config_override:
        app.config.update(config_override)

    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)
    mail.init_app(app)
    limiter.init_app(app)

    # --- DB Init + Seed ---
    with app.app_context():
        db.create_all()
        _seed_admin(app)
        # Bootstrap: assign 4-digit codes to any existing MenuItems that lack one
        items_without_code = db.session.scalars(
            select(MenuItem).where(MenuItem.code.is_(None))
        ).all()
        for item in items_without_code:
            item.code = _generate_unique_code(db.session)
        if items_without_code:
            db.session.commit()
            logger.info(f"Assigned product codes to {len(items_without_code)} existing menu items.")

    # --- Scheduler ---
    if not app.config.get("TESTING"):
        _start_scheduler(app)

    # ============================================================
    # ROUTES
    # ============================================================

    # --- Global Error Handlers (always return JSON) ---
    from flask_limiter.errors import RateLimitExceeded

    @app.errorhandler(RateLimitExceeded)
    def handle_rate_limit(e):
        return jsonify({"error": "Too Many Requests", "message": str(e.description)}), 429

    @app.errorhandler(429)
    def handle_429(e):
        return jsonify({"error": "Too Many Requests", "message": "Rate limit exceeded. Please slow down."}), 429

    @app.errorhandler(404)
    def handle_404(e):
        return jsonify({"error": "Not Found", "message": str(e)}), 404

    @app.errorhandler(405)
    def handle_405(e):
        return jsonify({"error": "Method Not Allowed", "message": str(e)}), 405

    @app.errorhandler(Exception)
    def handle_exception(e):
        from werkzeug.exceptions import HTTPException
        if isinstance(e, HTTPException):
            return jsonify({"error": e.name, "message": e.description}), e.code
        logger.exception(f"Unhandled exception: {e}")
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500

    # ---------- Health ----------
    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}), 200

    # ============================================================
    # 1. AUTH ROUTES
    # ============================================================

    @app.route("/api/auth/register", methods=["POST"])
    @limiter.limit("10 per minute")
    def register():
        data = (sanitize_input(request.get_json(silent=True)) or {})
        
        email = (data.get("email") or "").strip().lower()
        password = data.get("password", "")
        role = data.get("role", "customer")
        
        TEMP_DOMAINS = ["temp-mail.org", "10minutemail.com", "guerrillamail.com", "mailinator.com"]
        domain = email.split("@")[-1] if "@" in email else ""
        if domain in TEMP_DOMAINS or "temp" in domain:
            return jsonify({"error": "Bad Request", "message": "This was caused due to temp mail use personal mail"}), 400
            
        # Self-registration forces non-customer/non-owner roles to customer
        if role not in ("customer", "outlet_owner"):
            role = "customer"
            
        first_name = (data.get("first_name") or "").strip()
        last_name = (data.get("last_name") or "").strip()
        phone_raw = data.get("phone")
        valid_phone, phone = validate_phone(phone_raw)
        if not valid_phone:
            return jsonify({"error": "Bad Request", "message": "Phone number must be exactly 10 digits"}), 400
        
        import re
        if first_name and not re.match(r"^[a-zA-Z\s\-']+$", first_name):
            return jsonify({"error": "Bad Request", "message": "First name contains invalid characters"}), 400
        if last_name and not re.match(r"^[a-zA-Z\s\-']+$", last_name):
            return jsonify({"error": "Bad Request", "message": "Last name contains invalid characters"}), 400

        if not email or not password:
            return jsonify({"error": "Bad Request", "message": "Email and password are required"}), 400
        if len(password) < 8 or not re.search(r'[A-Za-z]', password) or not re.search(r'[0-9]', password):
            return jsonify({"error": "Bad Request", "message": "Password must be at least 8 characters and contain a mix of letters and numbers"}), 400
        if db.session.scalars(select(User).where(User.email == email)).first():
            return jsonify({"error": "Conflict", "message": "Email already registered"}), 409

        if role == "customer":
            user = Customer(email=email, first_name=first_name or None, last_name=last_name or None, phone=phone or None)
        elif role == "outlet_owner":
            user = OutletOwner(email=email, first_name=first_name or None, last_name=last_name or None, phone=phone or None)
        else:
            user = Customer(email=email, first_name=first_name or None, last_name=last_name or None, phone=phone or None)
            
        user.set_password(password, bcrypt)
        db.session.add(user)
        db.session.commit()

        # Send welcome email if customer role
        if user.role == "customer":
            _send_welcome_email(app, user)

        return jsonify({"message": "Registered successfully", "user": user.to_dict()}), 201

    @app.route("/api/auth/login", methods=["POST"])
    @limiter.limit("10 per minute")
    def login():
        data = (sanitize_input(request.get_json(silent=True)) or {})
        email = (data.get("email") or "").strip().lower()
        password = data.get("password", "")

        if not email or not password:
            return jsonify({"error": "Bad Request", "message": "Email and password are required"}), 400

        user = db.session.scalars(select(User).where(User.email == email)).first()
        if not user or not user.check_password(password, bcrypt):
            return jsonify({"error": "Unauthorized", "message": "Invalid email or password"}), 401
        if getattr(user, 'deleted_at', None) is not None:
            return jsonify({"error": "Unauthorized", "message": "Account has been deleted"}), 401
        if getattr(user, 'is_banned', False):
            reason = getattr(user, 'ban_reason', 'No reason provided')
            return jsonify({"error": "Forbidden", "message": f"Account is banned: {reason}"}), 403
        if not user.is_active:
            return jsonify({"error": "Forbidden", "message": "Account is deactivated"}), 403

        additional_claims = {
            "role": user.role,
            "outlet_id": user.outlet_id,
            "user_id": user.id
        }
        token = create_access_token(identity=str(user.id), additional_claims=additional_claims)
        return jsonify({"access_token": token, "user": user.to_dict()}), 200

    @app.route("/api/auth/me", methods=["GET"])
    @jwt_required()
    def get_me():
        uid = int(get_jwt_identity())
        user = db.session.get(User, uid)
        if not user:
            return jsonify({"error": "Not Found"}), 404
        return jsonify(user.to_dict()), 200

    @app.route("/api/auth/forgot-password", methods=["POST"])
    @limiter.limit("5 per minute")
    def forgot_password():
        data = (sanitize_input(request.get_json(silent=True)) or {})
        email = (data.get("email") or "").strip().lower()
        if not email:
            return jsonify({"error": "Bad Request", "message": "Email is required"}), 400

        user = db.session.scalars(select(User).where(User.email == email)).first()
        if user:
            import secrets
            import string
            token = ''.join(secrets.choice(string.digits) for _ in range(6))
            user.password_reset_token = token
            user.password_reset_expiry = datetime.now(timezone.utc) + timedelta(hours=1)
            db.session.commit()

            sender = app.config.get("MAIL_DEFAULT_SENDER") or "noreply@fooderp.local"
            msg = Message(
                subject="FlavorFlow Password Reset Code",
                sender=sender,
                recipients=[email]
            )
            msg.body = f"""Hi {user.first_name or 'User'},

You have requested to reset your password for your FlavorFlow account.
Please use the following 6-digit code in the password reset form:

Reset Code: {token}

This code is valid for 1 hour. If you did not request this, please ignore this email.

Best regards,
FlavorFlow Team
"""
            try:
                mail.send(msg)
                logger.info(f"Password reset email sent to {email}")
            except Exception as e:
                logger.error(f"Failed to send password reset email: {str(e)}")
                print(f"\n[DEVELOPMENT FALLBACK] PASSWORD RESET TOKEN FOR {email}: {token}\n")

        return jsonify({"message": "If the email is registered, you will receive a reset token shortly."}), 200

    @app.route("/api/auth/reset-password", methods=["POST"])
    @limiter.limit("5 per minute")
    def reset_password():
        data = (sanitize_input(request.get_json(silent=True)) or {})
        email = (data.get("email") or "").strip().lower()
        token = (data.get("token") or "").strip()
        new_password = data.get("new_password", "")

        if not email or not token or not new_password:
            return jsonify({"error": "Bad Request", "message": "Email, token, and new password are required"}), 400
        import re
        if len(new_password) < 8 or not re.search(r'[A-Za-z]', new_password) or not re.search(r'[0-9]', new_password):
            return jsonify({"error": "Bad Request", "message": "Password must be at least 8 characters and contain a mix of letters and numbers"}), 400

        user = db.session.scalars(select(User).where(User.email == email)).first()
        if not user or user.password_reset_token != token:
            return jsonify({"error": "Unauthorized", "message": "Invalid or expired token"}), 401

        if not user.password_reset_expiry:
            return jsonify({"error": "Unauthorized", "message": "Invalid token state"}), 401

        expiry = user.password_reset_expiry
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        
        if datetime.now(timezone.utc) > expiry:
            return jsonify({"error": "Unauthorized", "message": "Token has expired"}), 401

        user.set_password(new_password, bcrypt)
        user.password_reset_token = None
        user.password_reset_expiry = None
        user.is_first_login = False
        db.session.commit()

        return jsonify({"message": "Password has been reset successfully"}), 200

    @app.route("/api/auth/change-password", methods=["POST"])
    @jwt_required()
    def change_password():
        uid = int(get_jwt_identity())
        user = db.session.get(User, uid)
        if not user:
            return jsonify({"error": "Not Found", "message": "User not found"}), 404

        data = (sanitize_input(request.get_json(silent=True)) or {})
        new_password = data.get("new_password", "")
        import re
        if not new_password or len(new_password) < 8 or not re.search(r'[A-Za-z]', new_password) or not re.search(r'[0-9]', new_password):
            return jsonify({"error": "Bad Request", "message": "Password must be at least 8 characters and contain a mix of letters and numbers"}), 400

        user.set_password(new_password, bcrypt)
        user.is_first_login = False
        db.session.commit()

        return jsonify({"message": "Password changed successfully"}), 200

    @app.route("/api/auth/profile", methods=["PUT"])
    @jwt_required()
    def update_profile():
        uid = int(get_jwt_identity())
        user = db.session.get(User, uid)
        if not user:
            return jsonify({"error": "Not Found", "message": "User not found"}), 404
            
        data = (sanitize_input(request.get_json(silent=True)) or {})
        user.first_name = data.get("first_name", user.first_name)
        user.last_name = data.get("last_name", user.last_name)
        if "phone" in data:
            valid_phone, phone_clean = validate_phone(data["phone"])
            if not valid_phone:
                return jsonify({"error": "Bad Request", "message": "Phone number must be exactly 10 digits"}), 400
            user.phone = phone_clean
        
        # Address only exists on User model if it was added (we added it!)
        if "address" in data:
            user.address = data["address"]
            
        import re
        if "password" in data:
            if len(data["password"]) >= 8 and re.search(r'[A-Za-z]', data["password"]) and re.search(r'[0-9]', data["password"]):
                user.set_password(data["password"], bcrypt)
            else:
                return jsonify({"error": "Bad Request", "message": "Password must be at least 8 characters and contain both letters and numbers."}), 400

        db.session.commit()
        return jsonify({"message": "Profile updated successfully", "user": user.to_dict()}), 200

    @app.route("/api/auth/profile", methods=["DELETE"])
    @jwt_required()
    def delete_profile():
        uid = int(get_jwt_identity())
        user = db.session.get(User, uid)
        if not user:
            return jsonify({"error": "Not Found", "message": "User not found"}), 404
        
        user.deleted_at = datetime.now(timezone.utc)
        user.is_active = False
        db.session.commit()
        return jsonify({"message": "Account deleted successfully"}), 200

    @app.route("/api/auth/verify-email", methods=["POST"])
    @jwt_required()
    def verify_email():
        uid = int(get_jwt_identity())
        user = db.session.get(User, uid)
        if not user:
            return jsonify({"error": "Not Found"}), 404
        
        user.is_email_verified = True
        db.session.commit()
        return jsonify({"message": "Email verified successfully"}), 200

    # --- Address Book ---
    @app.route("/api/auth/addresses", methods=["GET"])
    @jwt_required()
    def get_addresses():
        uid = int(get_jwt_identity())
        addresses = db.session.scalars(select(Address).where(Address.user_id == uid)).all()
        return jsonify([addr.to_dict() for addr in addresses]), 200

    @app.route("/api/auth/addresses", methods=["POST"])
    @jwt_required()
    def add_address():
        uid = int(get_jwt_identity())
        data = sanitize_input(request.get_json(silent=True)) or {}
        
        title = data.get("title", "").strip()
        address_line = data.get("address_line", "").strip()
        is_default = data.get("is_default", False)
        
        if not title or not address_line:
            return jsonify({"error": "Bad Request", "message": "Title and address line are required"}), 400
            
        if is_default:
            # Remove default from old addresses
            db.session.execute(
                db.update(Address).where(Address.user_id == uid).values(is_default=False)
            )
            
        new_addr = Address(user_id=uid, title=title, address_line=address_line, is_default=is_default)
        db.session.add(new_addr)
        db.session.commit()
        return jsonify({"message": "Address added", "address": new_addr.to_dict()}), 201

    @app.route("/api/auth/addresses/<int:address_id>", methods=["DELETE"])
    @jwt_required()
    def delete_address(address_id):
        uid = int(get_jwt_identity())
        addr = db.session.get(Address, address_id)
        if not addr or addr.user_id != uid:
            return jsonify({"error": "Not Found"}), 404
            
        db.session.delete(addr)
        db.session.commit()
        return jsonify({"message": "Address deleted"}), 200


    # ============================================================
    # 2. CUSTOMER ROUTES (role: customer)
    # ============================================================
    
    # --- Favorites ---
    @app.route("/api/foods/favorites", methods=["GET"])
    @jwt_required()
    def get_favorites():
        uid = int(get_jwt_identity())
        favs = db.session.scalars(select(Favorite).where(Favorite.customer_id == uid)).all()
        return jsonify([f.to_dict() for f in favs]), 200

    @app.route("/api/foods/favorites", methods=["POST"])
    @jwt_required()
    def add_favorite():
        uid = int(get_jwt_identity())
        data = sanitize_input(request.get_json(silent=True)) or {}
        menu_item_id = data.get("menu_item_id")
        
        if not menu_item_id:
            return jsonify({"error": "Bad Request", "message": "menu_item_id is required"}), 400
            
        existing = db.session.scalar(
            select(Favorite).where(Favorite.customer_id == uid, Favorite.menu_item_id == menu_item_id)
        )
        if existing:
            return jsonify({"message": "Already in favorites", "favorite": existing.to_dict()}), 200
            
        fav = Favorite(customer_id=uid, menu_item_id=menu_item_id)
        db.session.add(fav)
        db.session.commit()
        return jsonify({"message": "Added to favorites", "favorite": fav.to_dict()}), 201

    @app.route("/api/foods/favorites/<int:menu_item_id>", methods=["DELETE"])
    @jwt_required()
    def remove_favorite(menu_item_id):
        uid = int(get_jwt_identity())
        fav = db.session.scalar(
            select(Favorite).where(Favorite.customer_id == uid, Favorite.menu_item_id == menu_item_id)
        )
        if not fav:
            return jsonify({"error": "Not Found", "message": "Not in favorites"}), 404
            
        db.session.delete(fav)
        db.session.commit()
        return jsonify({"message": "Removed from favorites"}), 200


    @app.route("/api/foods/menu", methods=["GET"])
    def get_foods_menu():
        """Public: home foods menu."""
        items = db.session.scalars(
            select(MenuItem).where(
                MenuItem.is_active == True,
                MenuItem.business_type.in_(["home_foods", "both"])
            ).order_by(MenuItem.category, MenuItem.name)
        ).all()
        return jsonify([i.to_dict() for i in items]), 200

    @app.route("/api/foods/menu/code/<code>", methods=["GET"])
    def get_food_by_code(code):
        """Public: get a menu item by its code"""
        item = db.session.scalars(
            select(MenuItem).where(MenuItem.code == code)
        ).first()
        if not item:
            return jsonify({"error": "Not Found", "message": "Item not found with this code"}), 404
        return jsonify(item.to_dict()), 200

    @app.route("/api/foods/order", methods=["POST"])
    @role_required("customer", "outlet_owner")
    def place_order():
        customer_id = int(get_jwt_identity())
        customer = db.session.get(User, customer_id)
        if customer and not getattr(customer, 'is_email_verified', False):
            return jsonify({"error": "Forbidden", "message": "Please verify your email before placing an order."}), 403

        data = (sanitize_input(request.get_json(silent=True)) or {})
        items_data = data.get("items", [])
        delivery_address = data.get("delivery_address")
        payment_method = data.get("payment_method", "COD")
        coupon_code = data.get("coupon_code")

        if not items_data:
            return jsonify({"error": "Bad Request", "message": "No items in order"}), 400

        total = Decimal("0.00")
        order_items = []
        for it in items_data:
            mid = it.get("menu_item_id")
            qty = int(it.get("quantity", 1))
            if qty < 1:
                continue
            menu_item = db.session.get(MenuItem, mid)
            if not menu_item or not menu_item.is_active:
                return jsonify({"error": "Bad Request", "message": f"Item ID {mid} not found"}), 404
            if menu_item.business_type not in ("home_foods", "both"):
                return jsonify({"error": "Bad Request", "message": f"Item '{menu_item.name}' is not available for B2C order"}), 400
            
            if menu_item.global_stock is not None:
                if menu_item.global_stock < qty:
                    db.session.rollback()
                    return jsonify({"error": "Bad Request", "message": f"Item '{menu_item.name}' is out of stock (only {menu_item.global_stock} left)"}), 400
                menu_item.global_stock -= qty

            price = menu_item.price
            total += price * qty
            order_items.append(OrderItem(menu_item_id=mid, price=price, quantity=qty))

        discount_pct = 0
        coupon = None
        if coupon_code:
            coupon = db.session.scalars(
                select(Coupon).where(Coupon.code == coupon_code.upper().strip(), Coupon.is_active == True)
            ).first()
            if coupon:
                if coupon.expiry_date and coupon.expiry_date < datetime.now(timezone.utc).date():
                    return jsonify({"error": "Bad Request", "message": "Coupon has expired"}), 400
                if coupon.usage_limit and coupon.usage_count >= coupon.usage_limit:
                    return jsonify({"error": "Bad Request", "message": "Coupon usage limit reached"}), 400

                # Check if this user already used this coupon
                used = db.session.scalars(select(Order).where(Order.customer_id == customer_id, Order.applied_coupon_code == coupon.code)).first()
                if used:
                    return jsonify({"error": "Bad Request", "message": "You have already used this coupon. Sorry, try other options."}), 400

                discount_pct = coupon.discount_pct
                coupon.usage_count += 1

        if discount_pct > 0:
            discount_pct = min(100, discount_pct)
            total = total * Decimal(str((100 - discount_pct) / 100))

        order = Order(
            customer_id=customer_id, 
            total_price=total, 
            items=order_items, 
            delivery_address=delivery_address, 
            payment_method=payment_method,
            applied_coupon_code=coupon.code if coupon else None
        )
        db.session.add(order)
        db.session.flush() # ensure we have order.id
        
        _generate_order_qr(app, order)
        db.session.commit()

        # Send order confirmation email to customer
        customer = db.session.get(User, customer_id)
        if customer and customer.email:
            _send_order_placed_email(app, order, customer)

        return jsonify({"message": "Order placed", "order": order.to_dict()}), 201

    @app.route("/api/foods/orders", methods=["GET"])
    @role_required("customer", "outlet_owner")
    def get_order_history():
        customer_id = int(get_jwt_identity())
        orders = db.session.scalars(
            select(Order).where(Order.customer_id == customer_id)
            .order_by(Order.created_at.desc())
        ).unique().all()
        return jsonify([o.to_dict() for o in orders]), 200

    @app.route("/api/foods/orders/<int:order_id>/cancel", methods=["POST"])
    @role_required("customer", "outlet_owner")
    def cancel_order(order_id):
        customer_id = int(get_jwt_identity())
        data = (sanitize_input(request.get_json(silent=True)) or {})
        reason = data.get("reason", "Cancelled by customer")

        order = db.session.get(Order, order_id)
        if not order:
            return jsonify({"error": "Not Found", "message": "Order not found"}), 404
        if order.customer_id != customer_id:
            return jsonify({"error": "Forbidden"}), 403
        if order.status not in ("pending", "processing"):
            return jsonify({"error": "Bad Request", "message": f"Cannot cancel order with status '{order.status}'"}), 400

        order.status = "cancelled"
        order.cancel_reason = reason
        
        # Restore stock and coupon
        for item in order.items:
            menu_item = db.session.get(MenuItem, item.menu_item_id)
            if menu_item and menu_item.global_stock is not None:
                menu_item.global_stock += item.quantity
        
        if order.applied_coupon_code:
            coupon = db.session.scalars(select(Coupon).where(Coupon.code == order.applied_coupon_code)).first()
            if coupon and coupon.usage_count > 0:
                coupon.usage_count -= 1

        db.session.commit()
        return jsonify({"message": "Order cancelled", "order": order.to_dict()}), 200

    @app.route("/api/foods/orders/<int:order_id>/confirm", methods=["POST"])
    @role_required("customer", "outlet_owner")
    def confirm_receipt(order_id):
        customer_id = int(get_jwt_identity())
        data = (sanitize_input(request.get_json(silent=True)) or {})
        code = (data.get("tracking_code") or "").strip()

        order = db.session.get(Order, order_id)
        if not order or order.customer_id != customer_id:
            return jsonify({"error": "Not Found"}), 404
        if order.status != "shipped":
            return jsonify({"error": "Bad Request", "message": "Order is not in shipped status"}), 400
        if order.tracking_code != code:
            return jsonify({"error": "Unauthorized", "message": "Tracking code does not match"}), 401

        order.is_received = True
        order.status = "delivered"
        db.session.commit()
        return jsonify({"message": "Order confirmed as delivered", "order": order.to_dict()}), 200

    @app.route("/api/foods/orders/<int:order_id>/feedback", methods=["POST"])
    @role_required("customer", "outlet_owner")
    def submit_feedback(order_id):
        customer_id = int(get_jwt_identity())
        data = (sanitize_input(request.get_json(silent=True)) or {})

        order = db.session.get(Order, order_id)
        if not order or order.customer_id != customer_id:
            return jsonify({"error": "Not Found"}), 404
        if not order.is_received:
            return jsonify({"error": "Forbidden", "message": "Feedback form is locked until receipt confirmation"}), 403
        if order.review:
            return jsonify({"error": "Conflict", "message": "Feedback already submitted"}), 409

        rating = int(data.get("rating", 5))
        if not 1 <= rating <= 5:
            return jsonify({"error": "Bad Request", "message": "Rating must be 1–5"}), 400

        fb = Review(order_id=order_id, customer_id=customer_id,
                      rating=rating, comment=data.get("comment"))
        db.session.add(fb)
        db.session.commit()
        return jsonify({"message": "Feedback submitted", "feedback": fb.to_dict()}), 201

    # ============================================================
    # 3. ADMIN ROUTES
    # ============================================================

    # --- Menu Items ---
    @app.route("/api/admin/menu", methods=["GET"])
    @role_required("admin")
    def admin_get_menu():
        items = db.session.scalars(select(MenuItem).where(MenuItem.is_active == True).order_by(MenuItem.business_type, MenuItem.name)).all()
        return jsonify([i.to_dict() for i in items]), 200

    @app.route("/api/admin/menu", methods=["POST"])
    @role_required("admin")
    def admin_add_menu():
        data = (sanitize_input(request.get_json(silent=True)) or {})
        name = (data.get("name") or "").strip()
        price = data.get("price")
        btype = data.get("business_type", "home_foods")

        if not name or price is None:
            return jsonify({"error": "Bad Request", "message": "name and price are required"}), 400
        if btype not in ("home_foods", "snack_supply", "both"):
            return jsonify({"error": "Bad Request", "message": "Invalid business_type"}), 400

        # Check if an item with the same name already exists (case-insensitive)
        existing = db.session.scalars(
            select(MenuItem).where(func.lower(MenuItem.name) == name.lower())
        ).first()
        if existing:
            # Reuse existing item — reactivate and update fields
            existing.price = Decimal(str(price))
            existing.business_type = btype
            existing.description = data.get("description") or existing.description
            existing.category = data.get("category") or existing.category
            existing.image_url = data.get("image_url") or existing.image_url
            if "global_stock" in data:
                existing.global_stock = data.get("global_stock")
            existing.is_active = True
            if "code" in data and data["code"]:
                existing.code = data["code"].strip()
            elif not existing.code:
                existing.code = _generate_unique_code(db.session)
            db.session.commit()
            return jsonify({"message": "Existing item reactivated", "item": existing.to_dict()}), 200

        code = (data.get("code") or "").strip()
        item = MenuItem(
            name=name, price=Decimal(str(price)), business_type=btype, code=code if code else _generate_unique_code(db.session),
            description=data.get("description"), category=data.get("category"),
            image_url=data.get("image_url"), global_stock=data.get("global_stock")
        )
        if not item.code:
            item.code = _generate_unique_code(db.session)
        db.session.add(item)
        db.session.commit()
        admin_id = int(get_jwt_identity())
        log_admin_action(db.session, admin_id, "Create Menu Item", "MenuItem", item.id, f"Created {item.name}")
        db.session.commit()
        return jsonify({"message": "Item created", "item": item.to_dict()}), 201

    @app.route("/api/admin/menu/<int:item_id>", methods=["PUT"])
    @role_required("admin")
    def admin_edit_menu(item_id):
        item = db.session.get(MenuItem, item_id)
        if not item:
            return jsonify({"error": "Not Found"}), 404
        data = (sanitize_input(request.get_json(silent=True)) or {})
        for field in ("name", "code", "description", "category", "image_url", "global_stock"):
            if field in data:
                setattr(item, field, data[field])
        if "price" in data and data["price"] is not None:
            item.price = Decimal(str(data["price"]))
        if "business_type" in data and data["business_type"] in ("home_foods", "snack_supply", "both"):
            item.business_type = data["business_type"]
        if "is_active" in data:
            item.is_active = bool(data["is_active"])
        db.session.commit()
        return jsonify({"message": "Updated", "item": item.to_dict()}), 200

    @app.route("/api/admin/menu/<int:item_id>", methods=["DELETE", "POST"])
    @role_required("admin")
    def admin_delete_menu(item_id):
        item = db.session.get(MenuItem, item_id)
        if not item:
            return jsonify({"error": "Not Found"}), 404
        item.is_active = False
        db.session.commit()
        admin_id = int(get_jwt_identity())
        log_admin_action(db.session, admin_id, "Deactivate Menu Item", "MenuItem", item.id, f"Deactivated {item.name}")
        db.session.commit()
        return jsonify({"message": "Item deactivated"}), 200

    # --- Outlets ---
    @app.route("/api/admin/outlets", methods=["GET"])
    @role_required("admin")
    def admin_get_outlets():
        outlets = db.session.scalars(select(Outlet).order_by(Outlet.name)).all()
        return jsonify([o.to_dict() for o in outlets]), 200

    @app.route("/api/admin/outlets", methods=["POST"])
    @role_required("admin")
    def admin_add_outlet():
        data = (sanitize_input(request.get_json(silent=True)) or {})
        name = (data.get("name") or "").strip()
        address = (data.get("address") or "").strip()
        if not name or not address:
            return jsonify({"error": "Bad Request", "message": "name and address required"}), 400
        outlet = Outlet(name=name, address=address,
                        latitude=data.get("latitude"), longitude=data.get("longitude"),
                        owner_id=data.get("owner_id"))
        db.session.add(outlet)
        db.session.flush()

        items_data = data.get("items", [])
        for it in items_data:
            mid = it.get("menu_item_id")
            if not mid:
                continue
            exists = db.session.scalars(
                select(OutletStock).filter_by(outlet_id=outlet.id, menu_item_id=mid)
            ).first()
            if not exists:
                stock = OutletStock(outlet_id=outlet.id, menu_item_id=mid,
                                    current_stock=int(it.get("initial_stock", 0)),
                                    restock_limit=int(it.get("threshold", 10)))
                db.session.add(stock)
        db.session.commit()
        return jsonify({"message": "Outlet created", "outlet": outlet.to_dict()}), 201

    @app.route("/api/admin/outlets/<int:outlet_id>", methods=["PUT"])
    @role_required("admin")
    def admin_edit_outlet(outlet_id):
        outlet = db.session.get(Outlet, outlet_id)
        if not outlet:
            return jsonify({"error": "Not Found"}), 404
        data = (sanitize_input(request.get_json(silent=True)) or {})
        for field in ("name", "address", "latitude", "longitude", "owner_id"):
            if field in data:
                setattr(outlet, field, data[field])
        db.session.commit()
        return jsonify({"message": "Updated", "outlet": outlet.to_dict()}), 200

    @app.route("/api/admin/outlets/<int:outlet_id>", methods=["DELETE", "POST"])
    @role_required("admin")
    def admin_delete_outlet(outlet_id):
        outlet = db.session.get(Outlet, outlet_id)
        if not outlet:
            return jsonify({"error": "Not Found"}), 404
        # Bypass ORM-level cascades to prevent IntegrityErrors with nullable=False relationships
        # Relying on DB-level ON DELETE CASCADE constraints instead
        Outlet.query.filter_by(id=outlet_id).delete(synchronize_session=False)
        db.session.commit()
        return jsonify({"message": "Outlet deleted"}), 200

    # --- Outlet Stock Management ---
    @app.route("/api/admin/outlets/<int:outlet_id>/stock", methods=["POST"])
    @role_required("admin")
    def admin_add_outlet_stock(outlet_id):
        outlet = db.session.get(Outlet, outlet_id)
        if not outlet:
            return jsonify({"error": "Not Found"}), 404
        data = (sanitize_input(request.get_json(silent=True)) or {})
        mid = data.get("menu_item_id")
        if not mid:
            return jsonify({"error": "Bad Request", "message": "menu_item_id required"}), 400
        exists = db.session.scalars(
            select(OutletStock).filter_by(outlet_id=outlet_id, menu_item_id=mid)
        ).first()
        if exists:
            return jsonify({"error": "Conflict", "message": "Item already assigned"}), 409
        stock = OutletStock(outlet_id=outlet_id, menu_item_id=mid,
                            current_stock=int(data.get("initial_stock", 0)),
                            restock_limit=int(data.get("threshold", 10)))
        db.session.add(stock)
        db.session.commit()
        log_stock_change(db.session, outlet_id=outlet_id, menu_item_id=mid,
                         change_qty=stock.current_stock, change_type="assign",
                         stock_before=0, stock_after=stock.current_stock,
                         notes="Admin assigned item to outlet")
        db.session.commit()
        return jsonify({"message": "Stock item added", "stock": stock.to_dict()}), 201

    # FIX: Added /items alias route to match frontend call
    @app.route("/api/admin/outlets/<int:outlet_id>/items", methods=["POST"])
    @role_required("admin")
    def admin_add_outlet_item(outlet_id):
        """Alias for /stock endpoint — used by the frontend assign-item-to-outlet flow."""
        outlet = db.session.get(Outlet, outlet_id)
        if not outlet:
            return jsonify({"error": "Not Found"}), 404
        data = (sanitize_input(request.get_json(silent=True)) or {})
        mid = data.get("menu_item_id")
        if not mid:
            return jsonify({"error": "Bad Request", "message": "menu_item_id required"}), 400

        exists = db.session.scalars(
            select(OutletStock).filter_by(outlet_id=outlet_id, menu_item_id=mid)
        ).first()
        if exists:
            # Update existing stock if already assigned
            before = exists.current_stock
            if "current_stock" in data:
                exists.current_stock = int(data["current_stock"])
            if "restock_limit" in data:
                exists.restock_limit = int(data["restock_limit"])
            db.session.commit()
            log_stock_change(db.session, outlet_id=outlet_id, menu_item_id=mid,
                             change_qty=exists.current_stock - before, change_type="edit",
                             stock_before=before, stock_after=exists.current_stock,
                             notes="Admin edited stock via UI")
            return jsonify({"message": "Stock updated", "stock": exists.to_dict()}), 200

        stock = OutletStock(outlet_id=outlet_id, menu_item_id=mid,
                            current_stock=int(data.get("current_stock", 0)),
                            restock_limit=int(data.get("restock_limit", 10)))
        db.session.add(stock)
        db.session.commit()
        log_stock_change(db.session, outlet_id=outlet_id, menu_item_id=mid,
                         change_qty=stock.current_stock, change_type="assign",
                         stock_before=0, stock_after=stock.current_stock,
                         notes="Admin assigned item to outlet via UI")
        db.session.commit()
        return jsonify({"message": "Stock item added", "stock": stock.to_dict()}), 201

    # FIX: Added DELETE /items/<menu_item_id> route for frontend remove functionality
    @app.route("/api/admin/outlets/<int:outlet_id>/items/<int:menu_item_id>", methods=["DELETE"])
    @role_required("admin")
    def admin_remove_outlet_item(outlet_id, menu_item_id):
        """Remove a specific item from an outlet's stock."""
        stock = db.session.scalars(
            select(OutletStock).filter_by(outlet_id=outlet_id, menu_item_id=menu_item_id)
        ).first()
        if not stock:
            return jsonify({"error": "Not Found", "message": "Item not assigned to this outlet"}), 404
        db.session.delete(stock)
        db.session.commit()
        return jsonify({"message": "Item removed from outlet"}), 200

    @app.route("/api/admin/outlets/<int:outlet_id>/restock", methods=["POST"])
    @role_required("admin")
    def admin_restock_outlet(outlet_id):
        claims = get_jwt()
        admin_id = claims.get("user_id")
        data = (sanitize_input(request.get_json(silent=True)) or {})
        mid = data.get("menu_item_id")
        qty = int(data.get("qty", 0))
        if qty <= 0:
            return jsonify({"error": "Bad Request", "message": "qty must be > 0"}), 400
        stock = db.session.scalars(
            select(OutletStock).filter_by(outlet_id=outlet_id, menu_item_id=mid)
        ).first()
        if not stock:
            return jsonify({"error": "Not Found"}), 404
        before = stock.current_stock
        stock.current_stock += qty
        log_stock_change(db.session, outlet_id=outlet_id, menu_item_id=mid,
                         change_qty=qty, change_type="manual",
                         stock_before=before, stock_after=stock.current_stock,
                         performed_by=admin_id, notes="Admin manual restock")
        db.session.commit()
        return jsonify({"message": f"+{qty} stocked", "new_stock": stock.current_stock}), 200

    # --- Orders (admin) ---
    @app.route("/api/admin/orders", methods=["GET"])
    @role_required("admin")
    def admin_get_orders():
        orders = db.session.scalars(
            select(Order).order_by(Order.created_at.desc()).limit(200)
        ).unique().all()
        return jsonify([o.to_dict() for o in orders]), 200

    @app.route("/api/admin/orders/<int:order_id>", methods=["PUT"])
    @role_required("admin")
    def admin_update_order(order_id):
        order = db.session.get(Order, order_id)
        if not order:
            return jsonify({"error": "Not Found"}), 404
        data = (sanitize_input(request.get_json(silent=True)) or {})
        valid = ("pending", "processing", "shipped", "delivered", "cancelled")
        if "status" in data and data["status"] in valid:
            old_status = order.status
            order.status = data["status"]
            if old_status != "cancelled" and order.status == "cancelled":
                for item in order.items:
                    menu_item = db.session.get(MenuItem, item.menu_item_id)
                    if menu_item and menu_item.global_stock is not None:
                        menu_item.global_stock += item.quantity
                if order.applied_coupon_code:
                    coupon = db.session.scalars(select(Coupon).where(Coupon.code == order.applied_coupon_code)).first()
                    if coupon and coupon.usage_count > 0:
                        coupon.usage_count -= 1
        if "tracking_code" in data:
            order.tracking_code = data["tracking_code"]
        db.session.commit()
        return jsonify({"message": "Updated", "order": order.to_dict()}), 200

    @app.route("/api/admin/orders/<int:order_id>/ship", methods=["PUT"])
    @role_required("admin")
    def admin_ship_order(order_id):
        """Mark order as shipped with a tracking code and optional label upload."""
        order = db.session.get(Order, order_id)
        if not order:
            return jsonify({"error": "Not Found"}), 404
        data = (sanitize_input(request.get_json(silent=True)) or {})
        tracking_code = (data.get("tracking_code") or "").strip()
        tracking_label = data.get("tracking_label")
        if not tracking_code:
            return jsonify({"error": "Bad Request", "message": "tracking_code is required"}), 400
        order.status = "shipped"
        order.tracking_code = tracking_code
        if tracking_label:
            order.tracking_label = tracking_label
        tracking_link = (data.get("tracking_link") or "").strip()
        if tracking_link:
            order.tracking_link = tracking_link
        db.session.commit()

        # Send order shipped email to customer
        customer = db.session.get(User, order.customer_id)
        if customer and customer.email:
            _send_order_shipped_email(app, order, customer, tracking_code)

        return jsonify({"message": "Order marked as shipped", "order": order.to_dict()}), 200

    # --- Staff Management ---
    @app.route("/api/admin/staff", methods=["GET"])
    @role_required("admin")
    def admin_get_staff():
        staff = db.session.scalars(
            select(User).where(User.role.in_(["staff", "outlet_owner", "kitchen"])).order_by(User.created_at.desc())
        ).all()
        return jsonify([u.to_dict() for u in staff]), 200

    @app.route("/api/admin/staff", methods=["POST"])
    @role_required("admin")
    def admin_create_staff():
        data = (sanitize_input(request.get_json(silent=True)) or {})
        email = (data.get("email") or "").strip().lower()
        password = data.get("password", "staff1234")
        outlet_id = data.get("outlet_id")
        first_name = data.get("first_name")
        last_name = data.get("last_name")
        valid_phone, phone = validate_phone(data.get("phone"))
        if not valid_phone:
            return jsonify({"error": "Bad Request", "message": "Phone number must be exactly 10 digits"}), 400
        role = (data.get("role") or "staff").strip().lower()

        if role not in ("staff", "admin", "outlet_owner", "kitchen"):
            return jsonify({"error": "Bad Request", "message": "Invalid role"}), 400

        if not email:
            return jsonify({"error": "Bad Request", "message": "email required"}), 400
        if db.session.scalars(select(User).where(User.email == email)).first():
            return jsonify({"error": "Conflict", "message": "Email already exists"}), 409

        if role == "admin":
            admin_count = db.session.scalar(
                select(func.count(User.id)).where(User.role == "admin")
            )
            if admin_count >= 3:
                return jsonify({"error": "Conflict", "message": "Maximum of 3 admin accounts allowed."}), 409

        if role == "admin":
            user = Admin(email=email, first_name=first_name, last_name=last_name, phone=phone)
        elif role == "staff":
            user = Staff(email=email, first_name=first_name, last_name=last_name, phone=phone, outlet_id=outlet_id)
        elif role == "outlet_owner":
            # pyrefly: ignore [unexpected-keyword]
            user = OutletOwner(email=email, first_name=first_name, last_name=last_name, phone=phone, outlet_id=outlet_id)
        elif role == "kitchen":
            user = KitchenStaff(email=email, first_name=first_name, last_name=last_name, phone=phone, outlet_id=outlet_id)
        elif role == "customer":
            user = Customer(email=email, first_name=first_name, last_name=last_name, phone=phone)
        else:
            return jsonify({"error": "Bad Request", "message": "Invalid role"}), 400
        user.set_password(password, bcrypt)
        # Set optional 4-digit PIN for clock-in
        pin = (data.get("pin") or "").strip()
        if pin:
            if not pin.isdigit() or len(pin) != 4:
                return jsonify({"error": "Bad Request", "message": "PIN must be exactly 4 digits"}), 400
            user.set_pin(pin, bcrypt)
        db.session.add(user)
        db.session.commit()

        if role in ("staff", "outlet_owner"):
            outlet = db.session.get(Outlet, outlet_id) if outlet_id else None
            _send_staff_created_email(app, user, password, outlet)
        else:
            _send_admin_created_email(app, user, password)

        return jsonify({"message": f"{role.capitalize()} created", "user": user.to_dict(), "default_password": password}), 201

    @app.route("/api/admin/staff/<int:user_id>", methods=["PUT"])
    @role_required("admin")
    def admin_edit_staff(user_id):
        user = db.session.get(User, user_id)
        if not user or user.role not in ("staff", "admin", "outlet_owner"):
            return jsonify({"error": "Not Found"}), 404
        if getattr(user, 'is_superadmin', False):
            return jsonify({"error": "Forbidden", "message": "Cannot modify a super-admin."}), 403
        data = (sanitize_input(request.get_json(silent=True)) or {})
        for field in ("first_name", "last_name"):
            if field in data:
                setattr(user, field, data[field])
        if "phone" in data:
            valid_phone, phone_clean = validate_phone(data["phone"])
            if not valid_phone:
                return jsonify({"error": "Bad Request", "message": "Phone number must be exactly 10 digits"}), 400
            user.phone = phone_clean
        if "outlet_id" in data:
            user.outlet_id = data["outlet_id"]
        if "is_active" in data:
            user.is_active = bool(data["is_active"])
        if "pin" in data:
            pin = (data["pin"] or "").strip()
            if pin:
                if not pin.isdigit() or len(pin) != 4:
                    return jsonify({"error": "Bad Request", "message": "PIN must be exactly 4 digits"}), 400
                user.set_pin(pin, bcrypt)
            else:
                # Empty string = remove PIN
                user.pin_hash = None
        password_changed = False
        import re
        if "password" in data:
            if len(data["password"]) >= 8 and re.search(r'[A-Za-z]', data["password"]) and re.search(r'[0-9]', data["password"]):
                user.set_password(data["password"], bcrypt)
                password_changed = True
            else:
                return jsonify({"error": "Bad Request", "message": "Password must be at least 8 characters and contain both letters and numbers."}), 400
            
        db.session.commit()

        if password_changed and user.role == "admin" and user.email:
            _send_admin_password_changed_email(app, user, data["password"])

        return jsonify({"message": "Updated", "user": user.to_dict()}), 200

    @app.route("/api/admin/staff/<int:user_id>", methods=["DELETE", "POST"])
    @role_required("admin")
    def admin_delete_staff(user_id):
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({"error": "Not Found"}), 404

        if getattr(user, 'is_superadmin', False):
            return jsonify({"error": "Forbidden", "message": "Cannot delete a super-admin."}), 403

        if user.role == "admin":
            admin_count = db.session.scalar(select(func.count(User.id)).where(User.role == "admin"))
            if admin_count <= 1:
                return jsonify({"error": "Conflict", "message": "Cannot delete the last admin account."}), 409

        db.session.delete(user)
        db.session.commit()
        return jsonify({"message": "Staff deleted permanently"}), 200

    # --- Coupons (Admin) ---
    @app.route("/api/admin/coupons", methods=["GET"])
    @role_required("admin", "outlet_owner")
    def admin_get_coupons():
        coupons = db.session.scalars(select(Coupon).order_by(Coupon.created_at.desc())).all()
        return jsonify([c.to_dict() for c in coupons]), 200

    @app.route("/api/admin/coupons", methods=["POST"])
    @role_required("admin")
    def admin_add_coupon():
        data = (sanitize_input(request.get_json(silent=True)) or {})
        code = (data.get("code") or "").strip()
        pct = data.get("discount_pct")
        if not code or pct is None:
            return jsonify({"error": "Bad Request"}), 400
        
        expiry_date = None
        if data.get("expiry_date"):
            expiry_date = datetime.strptime(data.get("expiry_date"), "%Y-%m-%d").date()
            
        coupon = Coupon(code=code, discount_pct=pct, expiry_date=expiry_date, usage_limit=data.get("usage_limit"))
        db.session.add(coupon)
        db.session.commit()
        return jsonify({"message": "Coupon created", "coupon": coupon.to_dict()}), 201

    @app.route("/api/admin/coupons/<int:id>", methods=["PUT"])
    @role_required("admin")
    def admin_edit_coupon(id):
        coupon = db.session.get(Coupon, id)
        if not coupon:
            return jsonify({"error": "Not Found"}), 404
        data = (sanitize_input(request.get_json(silent=True)) or {})
        if "discount_pct" in data:
            coupon.discount_pct = data["discount_pct"]
        if "expiry_date" in data:
            if data["expiry_date"]:
                coupon.expiry_date = datetime.strptime(data["expiry_date"], "%Y-%m-%d").date()
            else:
                coupon.expiry_date = None
        if "usage_limit" in data:
            coupon.usage_limit = data["usage_limit"]
        if "is_active" in data:
            coupon.is_active = bool(data["is_active"])
        db.session.commit()
        return jsonify({"message": "Coupon updated", "coupon": coupon.to_dict()}), 200

    @app.route("/api/admin/coupons/<int:id>", methods=["DELETE"])
    @role_required("admin")
    def admin_delete_coupon(id):
        coupon = db.session.get(Coupon, id)
        if not coupon:
            return jsonify({"error": "Not Found"}), 404
        db.session.delete(coupon)
        db.session.commit()
        return jsonify({"message": "Coupon deleted"}), 200

    # --- Suppliers ---
    @app.route("/api/admin/suppliers", methods=["GET"])
    @role_required("admin")
    def admin_get_suppliers():
        suppliers = db.session.scalars(select(Supplier).order_by(Supplier.name)).all()
        return jsonify([s.to_dict() for s in suppliers]), 200

    @app.route("/api/admin/suppliers", methods=["POST"])
    @role_required("admin")
    def admin_add_supplier():
        data = (sanitize_input(request.get_json(silent=True)) or {})
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Bad Request", "message": "name required"}), 400
        valid_phone, phone_clean = validate_phone(data.get("phone"))
        if not valid_phone:
            return jsonify({"error": "Bad Request", "message": "Phone number must be exactly 10 digits"}), 400
        s = Supplier(name=name, contact_name=data.get("contact_name"),
                     phone=phone_clean, email=data.get("email"),
                     address=data.get("address"), notes=data.get("notes"))
        db.session.add(s)
        db.session.commit()
        return jsonify({"message": "Supplier created", "supplier": s.to_dict()}), 201

    @app.route("/api/admin/suppliers/<int:sid>", methods=["PUT"])
    @role_required("admin")
    def admin_edit_supplier(sid):
        s = db.session.get(Supplier, sid)
        if not s:
            return jsonify({"error": "Not Found"}), 404
        data = (sanitize_input(request.get_json(silent=True)) or {})
        for f in ("name", "contact_name", "email", "address", "notes", "is_active"):
            if f in data:
                setattr(s, f, data[f])
        if "phone" in data:
            valid_phone, phone_clean = validate_phone(data["phone"])
            if not valid_phone:
                return jsonify({"error": "Bad Request", "message": "Phone number must be exactly 10 digits"}), 400
            s.phone = phone_clean
        db.session.commit()
        return jsonify({"message": "Updated", "supplier": s.to_dict()}), 200

    @app.route("/api/admin/suppliers/<int:sid>", methods=["DELETE"])
    @role_required("admin")
    def admin_delete_supplier(sid):
        s = db.session.get(Supplier, sid)
        if not s:
            return jsonify({"error": "Not Found"}), 404
        db.session.delete(s)
        db.session.commit()
        return jsonify({"message": "Supplier deleted"}), 200

    @app.route("/api/admin/suppliers/<int:sid>/items", methods=["POST"])
    @role_required("admin")
    def admin_link_supplier_item(sid):
        s = db.session.get(Supplier, sid)
        if not s:
            return jsonify({"error": "Not Found"}), 404
        data = (sanitize_input(request.get_json(silent=True)) or {})
        mid = data.get("menu_item_id")
        if not mid:
            return jsonify({"error": "Bad Request", "message": "menu_item_id required"}), 400
        exists = db.session.scalars(
            select(SupplierItem).filter_by(supplier_id=sid, menu_item_id=mid)
        ).first()
        if exists:
            return jsonify({"error": "Conflict", "message": "Already linked"}), 409
        si = SupplierItem(supplier_id=sid, menu_item_id=mid,
                          cost_price=data.get("cost_price"),
                          lead_days=int(data.get("lead_days", 1)))
        db.session.add(si)
        db.session.commit()
        return jsonify({"message": "Linked", "item": si.to_dict()}), 201
    # ============================================================
    # 2.5. KITCHEN ROUTES (role: kitchen)
    # ============================================================
    
    @app.route("/api/kitchen/orders", methods=["GET"])
    @role_required("kitchen", "admin")
    def kitchen_get_orders():
        # Get all online orders that need preparation
        orders = db.session.scalars(
            select(Order)
            .where(Order.order_type == "online", Order.status.in_(["pending", "processing"]))
            .order_by(Order.created_at.asc())
        ).unique().all()
        return jsonify([o.to_dict() for o in orders]), 200

    @app.route("/api/kitchen/orders/<int:order_id>/status", methods=["PUT"])
    @role_required("kitchen", "admin")
    def kitchen_update_order_status(order_id):
        order = db.session.get(Order, order_id)
        if not order:
            return jsonify({"error": "Not Found"}), 404
            
        data = sanitize_input(request.get_json(silent=True)) or {}
        status = data.get("status")
        if status not in ["pending", "processing", "ready"]:
            return jsonify({"error": "Bad Request", "message": "Invalid status"}), 400
            
        order.status = status
        db.session.commit()
        return jsonify({"message": "Status updated", "order": order.to_dict()}), 200

    @app.route("/api/kitchen/restock-requests", methods=["GET"])
    @role_required("kitchen", "admin")
    def kitchen_get_restock_requests():
        # Find all outlet stocks that need restocking
        low_stock = db.session.scalars(
            select(OutletStock)
            .where(OutletStock.current_stock <= OutletStock.restock_limit)
        ).unique().all()
        result = []
        for s in low_stock:
            d = s.to_dict()
            if s.outlet:
                d["outlet_name"] = s.outlet.name
            result.append(d)
        return jsonify(result), 200

    @app.route("/api/kitchen/produce", methods=["POST"])
    @role_required("kitchen", "admin")
    def kitchen_produce_batch():
        import hashlib, hmac
        uid = int(get_jwt_identity())
        data = sanitize_input(request.get_json(silent=True)) or {}
        
        menu_item_id = data.get("menu_item_id")
        quantity = data.get("quantity")
        expiry_date_str = data.get("expiry_date")
        
        if not menu_item_id or not quantity or not expiry_date_str:
            return jsonify({"error": "Bad Request", "message": "Missing required fields"}), 400
            
        try:
            expiry_date = datetime.strptime(expiry_date_str, "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "Bad Request", "message": "Invalid expiry_date format. Use YYYY-MM-DD"}), 400
            
        # Generate batch number
        batch_number = f"B-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{random.randint(100, 999)}"
        
        batch = ProductionBatch(
            menu_item_id=menu_item_id,
            batch_number=batch_number,
            quantity_produced=quantity,
            expiry_date=expiry_date,
            produced_by=uid
        )
        
        db.session.add(batch)
        db.session.flush() # get batch ID
        
        # Generate QR Code Payload
        qr_payload = {
            "action": "receive_batch",
            "batch_number": batch_number,
            "menu_item_id": menu_item_id,
            "quantity": quantity,
            "expiry_date": expiry_date_str
        }
        
        # Sign payload
        serialized = json.dumps(qr_payload, sort_keys=True)
        signature = hmac.new(app.config["SECRET_KEY"].encode(), serialized.encode(), hashlib.sha256).hexdigest()
        qr_payload["signature"] = signature
        
        try:
            payload_str = json.dumps(qr_payload)
            qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=4)
            qr.add_data(payload_str)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            buf = io.BytesIO()
            # pyrefly: ignore [unexpected-keyword]
            img.save(buf, format="PNG")
            buf.seek(0)
            b64 = base64.b64encode(buf.read()).decode("utf-8")
            
            # Save QR to DB
            batch.qr_code_base64 = f"data:image/png;base64,{b64}"
            
        except Exception as e:
            logger.error(f"QR generation failed in kitchen_produce_batch: {e}")
            
        db.session.commit()
        
        return jsonify({
            "message": "Batch produced successfully", 
            "batch": batch.to_dict()
        }), 201


    # ============================================================
    # 3. ADMIN ROUTES
    # ============================================================

    # --- Analytics ---
    @app.route("/api/admin/analytics", methods=["GET"])
    @role_required("admin", "outlet_owner")
    def admin_analytics():
        claims = get_jwt()
        role = claims.get("role")
        user_outlet_id = claims.get("outlet_id")

        days = int(request.args.get("days", 30))
        since = datetime.now(timezone.utc) - timedelta(days=days)

        # Base conditions
        b2c_conditions = [Order.created_at >= since, Order.order_type == "online", Order.status != "cancelled"]
        pos_conditions = [Order.created_at >= since, Order.order_type == "pos", Order.status != "cancelled"]
        
        if role == "outlet_owner" and user_outlet_id:
            b2c_conditions.append(Order.outlet_id == user_outlet_id)
            pos_conditions.append(Order.outlet_id == user_outlet_id)

        # B2C revenue
        b2c_rev = db.session.scalar(
            select(func.sum(Order.total_price)).where(*b2c_conditions)
        ) or 0

        # POS revenue
        pos_rev = db.session.scalar(
            select(func.sum(Order.total_price)).where(*pos_conditions)
        ) or 0

        # Orders count
        b2c_count = db.session.scalar(
            select(func.count(Order.id)).where(*b2c_conditions)
        ) or 0
        pos_count = db.session.scalar(
            select(func.count(Order.id)).where(*pos_conditions)
        ) or 0

        # Top B2C items
        top_b2c = db.session.execute(
            select(MenuItem.name, func.sum(OrderItem.quantity).label("qty"))
            .join(OrderItem, OrderItem.menu_item_id == MenuItem.id)
            .join(Order, Order.id == OrderItem.order_id)
            .where(*b2c_conditions)
            .group_by(MenuItem.name).order_by(func.sum(OrderItem.quantity).desc()).limit(5)
        ).fetchall()

        # Top POS items
        top_pos = db.session.execute(
            select(MenuItem.name, func.sum(OrderItem.quantity).label("qty"))
            .join(OrderItem, OrderItem.menu_item_id == MenuItem.id)
            .join(Order, Order.id == OrderItem.order_id)
            .where(*pos_conditions)
            .group_by(MenuItem.name).order_by(func.sum(OrderItem.quantity).desc()).limit(5)
        ).fetchall()

        # Outlet revenue
        outlet_rev = db.session.execute(
            select(Outlet.name, func.sum(Order.total_price).label("rev"))
            .join(Order, Order.outlet_id == Outlet.id)
            .where(*pos_conditions)
            .group_by(Outlet.name).order_by(func.sum(Order.total_price).desc())
        ).fetchall()

        # Daily B2C & POS revenue (last 7 days)
        daily_data = []
        for i in range(6, -1, -1):
            day = datetime.now(timezone.utc) - timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            d_b2c_cond = [Order.created_at >= day_start, Order.created_at < day_end, Order.order_type == "online", Order.status != "cancelled"]
            d_pos_cond = [Order.created_at >= day_start, Order.created_at < day_end, Order.order_type == "pos", Order.status != "cancelled"]
            if role == "outlet_owner" and user_outlet_id:
                d_b2c_cond.append(Order.outlet_id == user_outlet_id)
                d_pos_cond.append(Order.outlet_id == user_outlet_id)
                
            rev = db.session.scalar(
                select(func.sum(Order.total_price)).where(*d_b2c_cond)
            ) or 0
            
            pos_day = db.session.scalar(
                select(func.sum(Order.total_price)).where(*d_pos_cond)
            ) or 0
            
            daily_data.append({
                "date": day_start.strftime("%d/%m"),
                "b2c": float(rev),
                "pos": float(pos_day)
            })

        # Low stock
        low_stock_cond = [OutletStock.current_stock <= OutletStock.restock_limit]
        if role == "outlet_owner" and user_outlet_id:
            low_stock_cond.append(OutletStock.outlet_id == user_outlet_id)
            
        low_stock = db.session.scalars(
            select(OutletStock).where(*low_stock_cond)
        ).all()

        # Expiring batches (within 3 days)
        from datetime import date as date_cls
        today = date_cls.today()
        expiring_cond = [ProductBatch.expiry_date != None, ProductBatch.expiry_date <= today + timedelta(days=3)]
        if role == "outlet_owner" and user_outlet_id:
            expiring_cond.append(ProductBatch.outlet_id == user_outlet_id)
            
        expiring = db.session.scalars(
            select(ProductBatch).where(*expiring_cond)
        ).all()

        return jsonify({
            "summary": {
                "b2c_revenue": float(b2c_rev),
                "pos_revenue": float(pos_rev),
                "total_revenue": float(b2c_rev) + float(pos_rev),
                "b2c_orders": b2c_count,
                "pos_sales": pos_count
            },
            "daily": daily_data,
            "top_b2c_items": [{"name": r.name, "qty": r.qty} for r in top_b2c],
            "top_pos_items": [{"name": r.name, "qty": r.qty} for r in top_pos],
            "outlet_revenue": [{"name": r.name, "revenue": float(r.rev)} for r in outlet_rev],
            "low_stock_count": len(low_stock),
            "expiring_count": len(expiring)
        }), 200

    # --- Stock Audit Log ---
    @app.route("/api/admin/audit-log", methods=["GET"])
    @role_required("admin")
    def admin_audit_log():
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 50))
        logs = db.session.scalars(
            select(StockAuditLog)
            .order_by(StockAuditLog.created_at.desc())
            .limit(per_page).offset((page - 1) * per_page)
        ).all()
        total = db.session.scalar(select(func.count(StockAuditLog.id))) or 0
        return jsonify({"logs": [l.to_dict() for l in logs], "total": total, "page": page}), 200

    # --- Demand Forecast ---
    @app.route("/api/admin/forecast", methods=["GET"])
    @role_required("admin")
    def admin_forecast():
        since = datetime.now(timezone.utc) - timedelta(days=30)
        results = []
        stocks = db.session.scalars(select(OutletStock)).all()
        for s in stocks:
            sold = db.session.scalar(
                select(func.sum(OrderItem.quantity))
                .join(Order, Order.id == OrderItem.order_id)
                .where(Order.outlet_id == s.outlet_id,
                       OrderItem.menu_item_id == s.menu_item_id,
                       Order.created_at >= since,
                       Order.order_type == "pos",
                       Order.status != "cancelled")
            ) or 0
            daily_rate = round(sold / 30, 2)
            days_left = round(s.current_stock / daily_rate, 1) if daily_rate > 0 else None
            results.append({
                "outlet_id": s.outlet_id,
                "outlet_name": s.outlet.name if s.outlet else None,
                "menu_item_id": s.menu_item_id,
                "menu_item_name": s.menu_item.name if s.menu_item else None,
                "current_stock": s.current_stock,
                "sold_30d": int(sold),
                "daily_rate": daily_rate,
                "days_to_stockout": days_left,
                "restock_urgency": "HIGH" if days_left is not None and days_left < 3
                                   else "MEDIUM" if days_left is not None and days_left < 7
                                   else "LOW"
            })
        results.sort(key=lambda x: (x["days_to_stockout"] is None, x["days_to_stockout"] or 9999))
        return jsonify(results), 200

    # --- Product Batches ---
    @app.route("/api/admin/batches", methods=["GET"])
    @role_required("admin")
    def admin_get_batches():
        batches = db.session.scalars(
            select(ProductBatch).order_by(ProductBatch.expiry_date.is_(None), ProductBatch.expiry_date.asc())
        ).all()
        return jsonify([b.to_dict() for b in batches]), 200

    # --- QR Code ---
    @app.route("/api/admin/generate-qr", methods=["POST"])
    @role_required("admin")
    def admin_generate_qr():
        data = (sanitize_input(request.get_json(silent=True)) or {})
        if not data:
            return jsonify({"error": "Bad Request", "message": "Payload required"}), 400
        try:
            # Cryptographically sign the payload for security/authenticity
            sig_payload = {
                "order_id": data.get("order_id"),
                "type": data.get("type"),
                "item": data.get("item"),
                "qty": data.get("qty"),
                "outlet_id": data.get("outlet_id"),
                "destination": data.get("destination"),
                "batch_number": data.get("batch_number"),
                "expiry_date": data.get("expiry_date")
            }
            import hmac
            import hashlib
            serialized = json.dumps(sig_payload, sort_keys=True)
            signature = hmac.new(app.config["SECRET_KEY"].encode(), serialized.encode(), hashlib.sha256).hexdigest()
            data["signature"] = signature

            payload_str = json.dumps(data)
            qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=4)
            qr.add_data(payload_str)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            buf = io.BytesIO()
            # pyrefly: ignore [unexpected-keyword]
            img.save(buf, format="PNG")
            buf.seek(0)
            b64 = base64.b64encode(buf.read()).decode("utf-8")
            return jsonify({"qr_image": f"data:image/png;base64,{b64}", "payload": data}), 200
        except Exception as e:
            logger.error(f"QR generation failed: {e}")
            return jsonify({"error": "Server Error", "message": str(e)}), 500

    # --- Users list ---
    @app.route("/api/admin/users", methods=["GET"])
    @role_required("admin")
    def admin_get_users():
        users = db.session.scalars(
            select(User).order_by(User.created_at.desc())
        ).all()
        return jsonify([u.to_dict() for u in users]), 200

    @app.route("/api/admin/users/<int:user_id>", methods=["PUT"])
    @role_required("admin")
    def admin_update_user(user_id):
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({"error": "Not Found", "message": "User not found"}), 404

        if getattr(user, 'is_superadmin', False):
            return jsonify({"error": "Forbidden", "message": "Cannot modify a super-admin."}), 403

        data = (sanitize_input(request.get_json(silent=True)) or {})
        if "is_active" in data:
            user.is_active = bool(data["is_active"])
        if "role" in data:
            new_role = data["role"]
            if new_role in ("customer", "staff", "outlet_owner", "admin"):
                if new_role == "admin":
                    admin_count = db.session.scalar(
                        select(func.count(User.id)).where(User.role == "admin")
                    )
                    if admin_count >= 3:
                        return jsonify({"error": "Conflict", "message": "Maximum of 3 admin accounts allowed."}), 409
                user.role = new_role
        if "outlet_id" in data:
            oid = data["outlet_id"]
            user.outlet_id = int(oid) if oid is not None else None
        
        password_changed = False
        import re
        if "password" in data:
            if len(data["password"]) >= 8 and re.search(r'[A-Za-z]', data["password"]) and re.search(r'[0-9]', data["password"]):
                user.set_password(data["password"], bcrypt)
                password_changed = True
            else:
                return jsonify({"error": "Bad Request", "message": "Password must be at least 8 characters and contain both letters and numbers."}), 400

        db.session.commit()

        if password_changed and user.role == "admin" and user.email:
            _send_admin_password_changed_email(app, user, data["password"])

        return jsonify({"message": "User updated successfully", "user": user.to_dict()}), 200

    @app.route("/api/admin/users/<int:user_id>", methods=["DELETE", "POST"])
    @role_required("admin")
    def admin_delete_user(user_id):
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({"error": "Not Found", "message": "User not found"}), 404

        if getattr(user, 'is_superadmin', False):
            return jsonify({"error": "Forbidden", "message": "Cannot delete a super-admin."}), 403

        if user.role == "admin":
            admin_count = db.session.scalar(select(func.count(User.id)).where(User.role == "admin"))
            if admin_count <= 1:
                return jsonify({"error": "Conflict", "message": "Cannot delete the last admin account."}), 409

        db.session.delete(user)
        db.session.commit()
        return jsonify({"message": "User deleted successfully"}), 200

    # ============================================================
    # 4. STAFF / POS ROUTES
    # ============================================================

    @app.route("/api/pos/outlet", methods=["GET"])
    @role_required("staff")
    def pos_get_outlet():
        claims = get_jwt()
        oid = claims.get("outlet_id")
        if not oid:
            return jsonify({"error": "Forbidden", "message": "No outlet assigned"}), 403
        outlet = db.session.get(Outlet, int(oid))
        if not outlet:
            return jsonify({"error": "Not Found"}), 404
        return jsonify(outlet.to_dict()), 200

    # FIX: Added /api/pos/menu route — returns items assigned to the staff's outlet
    @app.route("/api/pos/menu", methods=["GET"])
    @role_required("staff")
    def pos_get_menu():
        """Returns the outlet stock items (with price & current_stock) for the POS register."""
        claims = get_jwt()
        oid = claims.get("outlet_id")
        if not oid:
            return jsonify({"error": "Forbidden", "message": "No outlet assigned"}), 403
        oid = int(oid)
        stocks = db.session.scalars(
            select(OutletStock).where(OutletStock.outlet_id == oid)
        ).all()
        result = []
        for s in stocks:
            if s.menu_item and s.menu_item.is_active:
                result.append({
                    "id": s.menu_item.id,
                    "name": s.menu_item.name,
                    "price": float(s.menu_item.price),
                    "description": s.menu_item.description,
                    "category": s.menu_item.category,
                    "current_stock": s.current_stock,
                    "restock_limit": s.restock_limit,
                    "needs_restock": s.needs_restock
                })
        return jsonify(result), 200

    # FIX: Added /api/pos/sell alias that frontend uses
    @app.route("/api/pos/sell", methods=["POST"])
    @role_required("staff")
    def pos_sell():
        """Alias endpoint for pos_complete_sale — frontend calls /api/pos/sell."""
        return pos_complete_sale()

    @app.route("/api/pos/sale", methods=["POST"])
    @role_required("staff")
    def pos_complete_sale():
        claims = get_jwt()
        staff_id = int(get_jwt_identity())
        oid = claims.get("outlet_id")
        if not oid:
            return jsonify({"error": "Forbidden", "message": "No outlet assigned"}), 403
        oid = int(oid)
        data = (sanitize_input(request.get_json(silent=True)) or {})
        items_data = data.get("items", [])
        payment_method = data.get("payment_method", "cash")
        coupon_code = data.get("coupon_code")
        # CRM: optional customer email to link the sale for loyalty tracking
        customer_email = (data.get("customer_email") or "").strip().lower()
        # Loyalty: optional points to redeem (staff toggles this per customer request)
        redeem_points = int(data.get("redeem_loyalty_points") or 0)

        if not items_data:
            return jsonify({"error": "Bad Request", "message": "No items"}), 400

        # Resolve customer (optional)
        customer = None
        if customer_email:
            customer = db.session.scalars(
                select(User).where(User.email == customer_email, User.role == "customer")
            ).first()
            # Silently ignore if not found — sale still proceeds

        total = Decimal("0.00")
        sale_items = []
        for it in items_data:
            mid = int(it.get("menu_item_id"))
            qty = int(it.get("quantity", 1))
            stock = db.session.scalars(
                select(OutletStock).filter_by(outlet_id=oid, menu_item_id=mid)
            ).first()
            if not stock:
                db.session.rollback()
                return jsonify({"error": "Not Found", "message": f"Item {mid} not assigned to outlet"}), 404
            if stock.current_stock < qty:
                db.session.rollback()
                mi = db.session.get(MenuItem, mid)
                return jsonify({"error": "Conflict", "message": f"Insufficient stock for {mi.name if mi else mid}"}), 409
            before = stock.current_stock
            stock.current_stock -= qty
            price = stock.menu_item.price
            total += price * qty
            sale_items.append(OrderItem(menu_item_id=mid, price=price, quantity=qty))
            log_stock_change(db.session, outlet_id=oid, menu_item_id=mid,
                             change_qty=-qty, change_type="sale",
                             stock_before=before, stock_after=stock.current_stock,
                             performed_by=staff_id)

        discount_pct = 0
        coupon = None
        if coupon_code:
            coupon = db.session.scalars(
                select(Coupon).where(Coupon.code == coupon_code.upper().strip(), Coupon.is_active == True)
            ).first()
            if coupon:
                if coupon.expiry_date and coupon.expiry_date < datetime.now(timezone.utc).date():
                    return jsonify({"error": "Bad Request", "message": "Coupon has expired"}), 400
                if coupon.usage_limit and coupon.usage_count >= coupon.usage_limit:
                    return jsonify({"error": "Bad Request", "message": "Coupon usage limit reached"}), 400
                
                # Check if this customer already used it
                if customer:
                    used = db.session.scalars(select(Order).where(Order.customer_id == customer.id, Order.applied_coupon_code == coupon.code)).first()
                    if used:
                        return jsonify({"error": "Bad Request", "message": "the coupon u already used sorry try other options"}), 400

                discount_pct = coupon.discount_pct
                coupon.usage_count += 1

        if discount_pct > 0:
            discount_pct = min(100, discount_pct)
            total = total * Decimal(str((100 - discount_pct) / 100))

        # Loyalty points: redemption (1 point = ₹1 discount)
        points_redeemed = 0
        if customer and redeem_points > 0:
            max_redeemable = min(redeem_points, customer.loyalty_points, int(total))
            if max_redeemable > 0:
                total -= Decimal(str(max_redeemable))
                total = max(Decimal("0.00"), total)
                customer.loyalty_points -= max_redeemable
                points_redeemed = max_redeemable

        # Loyalty points: earning (1 point per ₹100 spent, rounded down)
        points_earned = 0
        if customer:
            points_earned = int(total) // 100
            customer.loyalty_points = (customer.loyalty_points or 0) + points_earned

        sale = Order(
            order_type='pos',
            outlet_id=oid,
            staff_id=staff_id,
            total_price=total,
            status='completed',
            payment_method=payment_method,
            items=sale_items,
            customer_id=customer.id if customer else None,
            loyalty_points_earned=points_earned,
            loyalty_points_redeemed=points_redeemed,
            applied_coupon_code=coupon.code if coupon else None
        )
        db.session.add(sale)
        db.session.flush() # ensure we have sale.id
        
        _generate_order_qr(app, sale)
        db.session.commit()

        # Send email alerts if low stock threshold is reached
        _check_and_send_alert(app, oid)

        # Check if any item is now below restock limit
        outlet_obj = db.session.get(Outlet, oid)
        restock_alert = outlet_obj.needs_restock if outlet_obj else False

        return jsonify({
            "message": "Sale recorded",
            "sale": sale.to_dict(),
            "remaining_stock": outlet_obj.current_stock if outlet_obj else 0,
            "restock_alert": restock_alert,
            "loyalty_points_earned": points_earned,
            "loyalty_points_redeemed": points_redeemed,
            "customer_loyalty_balance": customer.loyalty_points if customer else None
        }), 201

    # --- POS: Staff Shift (Clock-In / Clock-Out) ---
    @app.route("/api/pos/shift/clock-in", methods=["POST"])
    @role_required("staff")
    def pos_clock_in():
        """Verify staff email + PIN and open a new shift. Reject if shift already active."""
        claims = get_jwt()
        staff_id = int(get_jwt_identity())
        oid = claims.get("outlet_id")
        if not oid:
            return jsonify({"error": "Forbidden", "message": "No outlet assigned"}), 403
        oid = int(oid)

        data = (sanitize_input(request.get_json(silent=True)) or {})
        email = (data.get("email") or "").strip().lower()
        pin = (data.get("pin") or "").strip()

        if not email or not pin:
            return jsonify({"error": "Bad Request", "message": "Email and PIN are required"}), 400

        # Validate PIN belongs to the currently logged-in staff
        staff = db.session.get(User, staff_id)
        if not staff or staff.email.lower() != email:
            return jsonify({"error": "Unauthorized", "message": "Email does not match your account"}), 401

        if not staff.pin_hash:
            return jsonify({"error": "Forbidden", "message": "No PIN set. Contact your administrator."}), 403

        if not staff.check_pin(pin, bcrypt):
            return jsonify({"error": "Unauthorized", "message": "Incorrect PIN"}), 401

        # Check for already active shift
        active = db.session.scalars(
            select(StaffShift).where(
                StaffShift.staff_id == staff_id,
                StaffShift.status == "active"
            )
        ).first()
        if active:
            return jsonify({
                "error": "Conflict",
                "message": "You already have an active shift. Please clock out first.",
                "shift": active.to_dict()
            }), 409

        shift = StaffShift(staff_id=staff_id, outlet_id=oid)
        db.session.add(shift)
        db.session.commit()
        return jsonify({"message": "Clocked in successfully", "shift": shift.to_dict()}), 201

    @app.route("/api/pos/shift/active", methods=["GET"])
    @role_required("staff")
    def pos_get_active_shift():
        """Returns the currently active shift for this staff, or null."""
        staff_id = int(get_jwt_identity())
        shift = db.session.scalars(
            select(StaffShift).where(
                StaffShift.staff_id == staff_id,
                StaffShift.status == "active"
            )
        ).first()
        return jsonify({"shift": shift.to_dict() if shift else None}), 200

    @app.route("/api/pos/shift/clock-out", methods=["POST"])
    @role_required("staff")
    def pos_clock_out():
        """Close the active shift; record cash drawer count and compute discrepancy."""
        staff_id = int(get_jwt_identity())
        claims = get_jwt()
        oid = int(claims.get("outlet_id", 0))

        data = (sanitize_input(request.get_json(silent=True)) or {})
        actual_cash_raw = data.get("actual_cash")
        if actual_cash_raw is None:
            return jsonify({"error": "Bad Request", "message": "actual_cash is required"}), 400
        try:
            actual_cash = Decimal(str(actual_cash_raw))
            if actual_cash < 0:
                raise ValueError()
        except (ValueError, Exception):
            return jsonify({"error": "Bad Request", "message": "actual_cash must be a non-negative number"}), 400

        shift = db.session.scalars(
            select(StaffShift).where(
                StaffShift.staff_id == staff_id,
                StaffShift.status == "active"
            )
        ).first()
        if not shift:
            return jsonify({"error": "Not Found", "message": "No active shift found"}), 404

        # Sum cash sales made during this shift
        expected_cash = db.session.scalar(
            select(func.sum(Order.total_price)).where(
                Order.staff_id == staff_id,
                Order.outlet_id == oid,
                Order.payment_method.in_(["cash", "Cash", "CASH"]),
                Order.created_at >= shift.clock_in_time,
                Order.order_type == "pos",
                Order.status != "cancelled"
            )
        ) or Decimal("0.00")

        shift.close_shift(actual_cash=actual_cash, expected_cash=expected_cash)
        if data.get("notes"):
            shift.notes = str(data["notes"])[:500]
        db.session.commit()

        return jsonify({
            "message": "Shift closed successfully",
            "shift": shift.to_dict()
        }), 200

    # --- POS: Customer CRM Lookup ---
    @app.route("/api/pos/customer/lookup", methods=["GET"])
    @role_required("staff")
    def pos_customer_lookup():
        """Look up a customer by email: returns profile, loyalty balance, and top items."""
        email = (request.args.get("email") or "").strip().lower()
        if not email:
            return jsonify({"error": "Bad Request", "message": "email query param required"}), 400

        customer = db.session.scalars(
            select(User).where(User.email == email, User.role == "customer")
        ).first()
        if not customer:
            return jsonify({"error": "Not Found", "message": "Customer not found"}), 404

        # Get purchase history (top 5 items by frequency from both POS and B2C orders)
        from sqlalchemy import desc
        pos_items = db.session.execute(
            select(OrderItem.menu_item_id, func.sum(OrderItem.quantity).label("qty"))
            .join(Order, OrderItem.order_id == Order.id)
            .where(Order.customer_id == customer.id, Order.status != "cancelled")
            .group_by(OrderItem.menu_item_id)
            .order_by(desc("qty"))
            .limit(5)
        ).all()

        top_items = []
        for mid, qty in pos_items:
            mi = db.session.get(MenuItem, mid)
            if mi:
                top_items.append({"name": mi.name, "total_ordered": int(qty), "price": float(mi.price)})

        return jsonify({
            "customer": {
                "id": customer.id,
                "email": customer.email,
                "name": f"{customer.first_name or ''} {customer.last_name or ''}".strip() or customer.email,
                "loyalty_points": customer.loyalty_points or 0,
            },
            "top_items": top_items
        }), 200

    # --- Admin: Staff Timesheets ---
    @app.route("/api/admin/shifts", methods=["GET"])
    @role_required("admin")
    def admin_get_shifts():
        """Returns all staff shifts for timesheet management."""
        shifts = db.session.scalars(
            select(StaffShift).order_by(StaffShift.clock_in_time.desc())
        ).all()
        return jsonify([s.to_dict() for s in shifts]), 200

    @app.route("/api/admin/shifts/<int:shift_id>", methods=["DELETE"])
    @role_required("admin")
    def admin_delete_shift(shift_id):
        shift = db.session.get(StaffShift, shift_id)
        if not shift:
            return jsonify({"error": "Not Found"}), 404
        db.session.delete(shift)
        db.session.commit()
        return jsonify({"message": "Shift record deleted"}), 200

    @app.route("/api/pos/scan-arrival", methods=["POST"])
    @role_required("staff")
    def pos_scan_arrival():
        claims = get_jwt()
        staff_id = int(get_jwt_identity())
        oid = claims.get("outlet_id")
        if not oid:
            return jsonify({"error": "Forbidden", "message": "No outlet assigned"}), 403
        oid = int(oid)
        data = (sanitize_input(request.get_json(silent=True)) or {})
        qr_raw = data.get("qr_data", "")
        batch_number = data.get("batch_number")
        expiry_date_str = data.get("expiry_date")

        try:
            payload = json.loads(qr_raw)
        except (json.JSONDecodeError, TypeError):
            return jsonify({"error": "Bad Request", "message": "Invalid QR — not a dispatch label"}), 400

        # Cryptographically verify the QR code signature to prevent forgery
        sig = payload.get("signature")
        if not sig:
            return jsonify({"error": "Bad Request", "message": "Untrusted QR code — missing signature"}), 400
        
        sig_payload = {
            "order_id": payload.get("order_id"),
            "type": payload.get("type"),
            "item": payload.get("item"),
            "qty": payload.get("qty"),
            "outlet_id": payload.get("outlet_id"),
            "destination": payload.get("destination"),
            "batch_number": payload.get("batch_number"),
            "expiry_date": payload.get("expiry_date")
        }
        import hmac
        import hashlib
        serialized = json.dumps(sig_payload, sort_keys=True)
        computed = hmac.new(app.config["SECRET_KEY"].encode(), serialized.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, computed):
            return jsonify({"error": "Bad Request", "message": "Untrusted QR code — invalid signature"}), 400

        item_name = payload.get("item")
        qty = payload.get("qty")
        if not item_name or not qty:
            return jsonify({"error": "Bad Request", "message": "QR missing item or qty"}), 400
        try:
            qty = int(qty)
        except (ValueError, TypeError):
            return jsonify({"error": "Bad Request", "message": "qty must be a number"}), 400

        menu_item = db.session.scalars(
            select(MenuItem).where(MenuItem.name.ilike(item_name))
        ).first()
        if not menu_item:
            return jsonify({"error": "Not Found", "message": f"Item '{item_name}' not in catalog"}), 404

        stock = db.session.scalars(
            select(OutletStock).filter_by(outlet_id=oid, menu_item_id=menu_item.id)
        ).first()
        if not stock:
            return jsonify({"error": "Not Found", "message": f"'{item_name}' not assigned to your outlet"}), 404

        before = stock.current_stock
        stock.current_stock += qty
        log_stock_change(db.session, outlet_id=oid, menu_item_id=menu_item.id,
                         change_qty=qty, change_type="qr_arrival",
                         stock_before=before, stock_after=stock.current_stock,
                         performed_by=staff_id, notes=f"QR scan arrival, batch={batch_number}")

        # Record batch if expiry provided
        expiry_date = None
        if expiry_date_str:
            try:
                from datetime import date as date_cls
                expiry_date = date_cls.fromisoformat(expiry_date_str)
            except ValueError:
                pass

        batch = ProductBatch(outlet_stock_id=stock.id, outlet_id=oid,
                             menu_item_id=menu_item.id, qty=qty,
                             batch_number=batch_number, expiry_date=expiry_date,
                             received_by=staff_id)
        db.session.add(batch)
        db.session.commit()

        return jsonify({
            "message": f"+{qty} units of '{menu_item.name}' added",
            "item": menu_item.name,
            "qty_added": qty,
            "new_stock": stock.current_stock,
            "batch_id": batch.id
        }), 200

    @app.route("/api/pos/batches", methods=["GET"])
    @role_required("staff")
    def pos_get_batches():
        claims = get_jwt()
        oid = claims.get("outlet_id")
        if not oid:
            return jsonify({"error": "Forbidden"}), 403
        batches = db.session.scalars(
            select(ProductBatch).where(ProductBatch.outlet_id == int(oid))
            .order_by(ProductBatch.expiry_date.is_(None), ProductBatch.expiry_date.asc())
        ).all()
        return jsonify([b.to_dict() for b in batches]), 200

    @app.route("/api/pos/disposal", methods=["POST"])
    @role_required("staff")
    def pos_log_disposal():
        claims = get_jwt()
        oid = claims.get("outlet_id")
        staff_id = int(get_jwt_identity())
        if not oid:
            return jsonify({"error": "Forbidden", "message": "Staff not assigned to any outlet"}), 403

        data = (sanitize_input(request.get_json(silent=True)) or {})
        mid = data.get("menu_item_id")
        qty = data.get("quantity")
        reason = (data.get("reason") or "damaged").strip()

        if not mid or qty is None or int(qty) <= 0:
            return jsonify({"error": "Bad Request", "message": "menu_item_id and positive quantity are required"}), 400

        qty = int(qty)
        stock = db.session.scalars(
            select(OutletStock).filter_by(outlet_id=int(oid), menu_item_id=int(mid))
        ).first()

        if not stock:
            return jsonify({"error": "Not Found", "message": "Item not found in outlet inventory"}), 404

        if stock.current_stock < qty:
            return jsonify({"error": "Bad Request", "message": f"Insufficient stock to dispose. Available: {stock.current_stock}"}), 400

        before = stock.current_stock
        stock.current_stock -= qty
        log_stock_change(db.session, outlet_id=int(oid), menu_item_id=int(mid),
                         change_qty=-qty, change_type="waste",
                         stock_before=before, stock_after=stock.current_stock,
                         performed_by=staff_id, notes=f"Disposal: {reason}")
        db.session.commit()
        _check_and_send_alert(app, int(oid))
        return jsonify({"message": f"Successfully logged disposal of {qty} units", "new_stock": stock.current_stock}), 200


    @app.route("/api/pos/sales/history", methods=["GET"])
    @role_required("staff")
    def pos_sales_history():
        claims = get_jwt()
        oid = claims.get("outlet_id")
        if not oid:
            return jsonify({"error": "Forbidden"}), 403
        sales = db.session.scalars(
            select(Order).where(Order.outlet_id == int(oid), Order.order_type == 'pos')
            .order_by(Order.created_at.desc()).limit(50)
        ).unique().all()
        return jsonify([s.to_dict() for s in sales]), 200



    # ============================================================
    # 5. OUTLET OWNER ROUTES
    # ============================================================

    @app.route("/api/owner/dashboard", methods=["GET"])
    @role_required("outlet_owner")
    def owner_dashboard():
        uid = int(get_jwt_identity())
        outlets = db.session.scalars(
            select(Outlet).where(Outlet.owner_id == uid)
        ).all()
        return jsonify([o.to_dict() for o in outlets]), 200

    @app.route("/api/owner/outlets", methods=["POST"])
    @role_required("outlet_owner")
    def owner_create_outlet():
        uid = int(get_jwt_identity())
        data = (sanitize_input(request.get_json(silent=True)) or {})
        name = (data.get("name") or "").strip()
        address = (data.get("address") or "").strip()
        if not name or not address:
            return jsonify({"error": "Bad Request", "message": "name and address required"}), 400
        outlet = Outlet(name=name, address=address,
                        latitude=data.get("latitude"), longitude=data.get("longitude"),
                        owner_id=uid)
        db.session.add(outlet)
        db.session.commit()
        return jsonify({"message": "Outlet registered", "outlet": outlet.to_dict()}), 201

    @app.route("/api/owner/outlets/<int:outlet_id>", methods=["PUT"])
    @role_required("outlet_owner")
    def owner_edit_outlet(outlet_id):
        uid = int(get_jwt_identity())
        outlet = db.session.get(Outlet, outlet_id)
        if not outlet or outlet.owner_id != uid:
            return jsonify({"error": "Not Found"}), 404
        data = (sanitize_input(request.get_json(silent=True)) or {})
        for f in ("name", "address", "latitude", "longitude"):
            if f in data:
                setattr(outlet, f, data[f])
        db.session.commit()
        return jsonify({"message": "Updated", "outlet": outlet.to_dict()}), 200

    @app.route("/api/owner/outlets/<int:outlet_id>/stock", methods=["GET"])
    @role_required("outlet_owner")
    def owner_get_stock(outlet_id):
        uid = int(get_jwt_identity())
        outlet = db.session.get(Outlet, outlet_id)
        if not outlet or outlet.owner_id != uid:
            return jsonify({"error": "Not Found"}), 404
        return jsonify(outlet.to_dict()), 200

    # ============================================================
    # 6. DAILY REPORT (triggered manually or scheduled)
    # ============================================================

    @app.route("/api/foods/menu-items/<int:item_id>/reviews", methods=["GET"])
    def get_menu_item_reviews(item_id):
        reviews = db.session.scalars(
            select(Review).where(Review.menu_item_id == item_id).order_by(Review.created_at.desc())
        ).all()
        return jsonify([r.to_dict() for r in reviews]), 200

    @app.route("/api/foods/menu-items/<int:item_id>/reviews", methods=["POST"])
    @jwt_required()
    def create_menu_item_review(item_id):
        uid = int(get_jwt_identity())
        user = db.session.get(User, uid)
        if not user or user.role != "customer":
            return jsonify({"error": "Forbidden", "message": "Only customers can submit reviews"}), 403
        
        item = db.session.get(MenuItem, item_id)
        if not item:
            return jsonify({"error": "Not Found", "message": "Menu item not found"}), 404
        
        data = (sanitize_input(request.get_json(silent=True)) or {})
        rating = data.get("rating")
        comment = data.get("comment", "")
        
        if rating is None:
            return jsonify({"error": "Bad Request", "message": "Rating is required"}), 400
        try:
            rating_val = int(rating)
            if not (1 <= rating_val <= 5):
                raise ValueError()
        except ValueError:
            return jsonify({"error": "Bad Request", "message": "Rating must be between 1 and 5"}), 400
        
        # Ensure user has actually ordered this item before
        has_ordered = db.session.scalars(
            select(Order).join(OrderItem).where(
                Order.customer_id == uid,
                OrderItem.menu_item_id == item_id,
                Order.is_received == True
            )
        ).first()
        if not has_ordered:
            return jsonify({"error": "Forbidden", "message": "You must order this product before you can write a review for it."}), 403
        
        review = Review(menu_item_id=item_id, customer_id=uid, rating=rating_val, comment=comment)
        db.session.add(review)
        db.session.commit()
        return jsonify({"message": "Review submitted successfully", "review": review.to_dict()}), 201

    @app.route("/api/admin/reviews", methods=["GET"])
    @role_required("admin")
    def admin_get_reviews():
        reviews = db.session.scalars(
            select(Review).order_by(Review.created_at.desc())
        ).all()
        return jsonify([r.to_dict() for r in reviews]), 200

    @app.route("/api/admin/reviews/<int:review_id>", methods=["PATCH", "PUT"])
    @role_required("admin")
    def admin_update_review(review_id):
        review = db.session.get(Review, review_id)
        if not review:
            return jsonify({"error": "Not Found", "message": "Review not found"}), 404
        
        data = (sanitize_input(request.get_json(silent=True)) or {})
        if "is_hidden" in data:
            review.is_hidden = bool(data["is_hidden"])
        if "admin_reply" in data:
            review.admin_reply = data["admin_reply"]
            
        db.session.commit()
        return jsonify({"message": "Review updated successfully", "review": review.to_dict()}), 200

    @app.route("/api/admin/reviews/<int:review_id>", methods=["DELETE"])
    @role_required("admin")
    def admin_delete_review(review_id):
        review = db.session.get(Review, review_id)
        if not review:
            return jsonify({"error": "Not Found", "message": "Review not found"}), 404
        db.session.delete(review)
        db.session.commit()
        return jsonify({"message": "Review deleted successfully"}), 200

    @app.route("/api/whatsapp/webhook", methods=["GET", "POST"])
    def whatsapp_webhook():
        """
        Endpoint for WhatsApp Business API integration.
        GET: Handles Meta's webhook verification challenge.
        POST: Handles incoming messages/orders from WhatsApp.
        """
        if request.method == "GET":
            # Meta verification challenge
            mode = request.args.get("hub.mode")
            token = request.args.get("hub.verify_token")
            challenge = request.args.get("hub.challenge")
            
            # Verify against token in Meta Dashboard (via env vars)
            if mode == "subscribe" and token == os.getenv("WHATSAPP_VERIFY_TOKEN"):
                return challenge, 200
            else:
                return "Forbidden", 403
                
        elif request.method == "POST":
            # Receive incoming messages/orders
            data = request.get_json(silent=True)
            if data:
                # Placeholder logic to log the incoming payload
                logger.info(f"Received WhatsApp Webhook payload: {json.dumps(data)}")
                
                # TODO: Parse the data to extract customer phone, message/cart contents.
                # TODO: Create a new Order in the database with order_type='whatsapp'.
                # TODO: Send a reply back to the customer via WhatsApp API confirming the order.
                
                # Acknowledge receipt of the webhook to Meta
                return "EVENT_RECEIVED", 200
            return "Bad Request", 400


    @app.route("/api/coupons/<string:code>", methods=["GET"])
    def get_coupon(code):
        """Validate and return coupon details."""
        coupon = db.session.scalars(
            select(Coupon).where(Coupon.code == code.upper().strip(), Coupon.is_active == True)
        ).first()
        if not coupon:
            return jsonify({"error": "Not Found", "message": "Invalid or inactive coupon code"}), 404
        return jsonify(coupon.to_dict()), 200

    return app


# ============================================================
# PRIVATE HELPERS
# ============================================================

def _seed_admin(app):
    with app.app_context():
        # 1. Seed Admin
        admin = db.session.scalars(select(User).where(User.email == "admin")).first()
        if not admin:
            admin = User(email="admin", role="admin", first_name="System", last_name="Admin")
            admin.set_password("admin", bcrypt)
            admin.is_first_login = True
            db.session.add(admin)
            db.session.commit()
            logger.info("Admin account seeded: admin / admin (first login reset forced)")
        else:
            if admin.check_password("admin", bcrypt) and not admin.is_first_login:
                admin.is_first_login = True
                db.session.commit()
                logger.info("Forced is_first_login = True on admin because default password is still active")

        # 1.5. Seed Coupons
        if db.session.scalar(select(func.count(Coupon.id))) == 0:
            coupons_to_seed = [
                Coupon(code="WELCOME10", discount_pct=10),
                Coupon(code="FESTIVE20", discount_pct=20),
                Coupon(code="HALFOFF", discount_pct=50)
            ]
            for c in coupons_to_seed:
                db.session.add(c)
            db.session.commit()
            logger.info("Default discount coupons seeded")

        # 2. Seed Outlets if none exist
        if db.session.scalar(select(func.count(Outlet.id))) == 0:
            outlets_to_seed = [
                Outlet(name="Outlet 1: Connaught Place Corner", address="Connaught Place, New Delhi", latitude=28.6304, longitude=77.2177),
                Outlet(name="Outlet 2: Vashi Express Supply", address="Vashi, Navi Mumbai", latitude=19.0748, longitude=73.0011),
                Outlet(name="Outlet 3: Indiranagar Stall", address="Indiranagar, Bengaluru", latitude=12.9719, longitude=77.6412),
            ]
            for o in outlets_to_seed:
                db.session.add(o)
            db.session.commit()
            logger.info("Default outlets seeded")

        # 3. Seed MenuItems if Kobbari Karam is missing
        if not db.session.scalars(select(MenuItem).where(MenuItem.name == "Kobbari Karam 250g")).first():
            menu_items = [
                # Spice Powders
                MenuItem(name="Kobbari Karam 250g", price=Decimal("200.00"), business_type="home_foods", category="Spice Powders", description="Homemade Kobbari Karam — rich coconut spice powder made from fresh coconut and red chillies.", image_url="https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=200&q=80"),
                MenuItem(name="Pappula Podi 250g", price=Decimal("159.00"), business_type="home_foods", category="Spice Powders", description="Homemade Pappula Podi — traditional lentil spice powder for rice and idli.", image_url="https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=200&q=80"),
                MenuItem(name="Karvepaku Karram 250g", price=Decimal("159.00"), business_type="home_foods", category="Spice Powders", description="Karivepaku Karam — authentic curry leaf spice powder with a pungent aroma.", image_url="https://images.unsplash.com/photo-1599909613253-f3b3a5f7b33f?w=200&q=80"),
                MenuItem(name="Nuvvula Podi 250g", price=Decimal("169.00"), business_type="home_foods", category="Spice Powders", description="Nuvvula Podi (Roasted Sesame Powder) — nutrient-rich sesame spice blend.", image_url="https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=200&q=80"),
                MenuItem(name="Munagaku Podi 250g", price=Decimal("160.00"), business_type="home_foods", category="Spice Powders", description="Suggula's Kitchen Munagaku Podi — drumstick leaves powder packed with nutrients.", image_url="https://images.unsplash.com/photo-1583394293214-0b3f8ed6e0ab?w=200&q=80"),
                MenuItem(name="Kandi Podi 250g", price=Decimal("179.00"), business_type="home_foods", category="Spice Powders", description="సాంప్రదాయ రుచికి అసలైన కందిపప్పు పొడి — traditional toor dal spice powder.", image_url="https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=200&q=80"),
                MenuItem(name="Curry Leaves Herbal Powder 250g", price=Decimal("289.00"), business_type="home_foods", category="Spice Powders", description="Curry Leaves Herbal Powder — natural health supplement and flavour enhancer.", image_url="https://images.unsplash.com/photo-1591189824344-d7e6c2440e4a?w=200&q=80"),
                MenuItem(name="Andhra Nallakaram Podi 250g", price=Decimal("140.00"), business_type="home_foods", category="Spice Powders", description="Experience the authentic Andhra Nallakaram podi — fiery and aromatic.", image_url="https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=200&q=80"),
                MenuItem(name="Andhra Koora Karam 250g", price=Decimal("120.00"), business_type="home_foods", category="Spice Powders", description="అమ్మ చేతి కూర కారం — the special Andhra vegetable spice blend.", image_url="https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=200&q=80"),
                MenuItem(name="Pallila Karam 250g", price=Decimal("180.00"), business_type="home_foods", category="Spice Powders", description="నాన్నేమైన వేరుసేనగలు, సం... — peanut-based Andhra spice powder.", image_url="https://images.unsplash.com/photo-1599909613253-f3b3a5f7b33f?w=200&q=80"),

                # Pickles
                MenuItem(name="Pandu Mirchi Gongura 250g", price=Decimal("199.00"), business_type="home_foods", category="Pickles", description="Traditional Andhra Pandu Mirchi Gongura pickle — tangy red chilli sorrel blend.", image_url="https://images.unsplash.com/photo-1567982047351-76b6f93e38ee?w=200&q=80"),
                MenuItem(name="Pandumirchi Tamota Pickle 250g", price=Decimal("199.00"), business_type="home_foods", category="Pickles", description="Traditional Andhra Pandumirchi Tomato pickle — a classic tangy combination.", image_url="https://images.unsplash.com/photo-1567982047351-76b6f93e38ee?w=200&q=80"),
                MenuItem(name="Allam Pandumirchi Pickle 250g", price=Decimal("199.00"), business_type="home_foods", category="Pickles", description="Traditional Andhra Allam Chilli pickle — spicy ginger and chilli blend.", image_url="https://images.unsplash.com/photo-1589916836867-5208c1f74e23?w=200&q=80"),
                MenuItem(name="Pandu Mirchi Pickle 250g", price=Decimal("229.00"), business_type="home_foods", category="Pickles", description="పండిన ఎర్ర మిర్చితో, నాన్చు... — slow-fermented red chilli pickle.", image_url="https://images.unsplash.com/photo-1567982047351-76b6f93e38ee?w=200&q=80"),
                MenuItem(name="Kothimera Pickle 250g", price=Decimal("189.00"), business_type="home_foods", category="Pickles", description="తాజా కొత్తిమేర సువాస... — fresh coriander leaves pickle.", image_url="https://images.unsplash.com/photo-1589916836867-5208c1f74e23?w=200&q=80"),
                MenuItem(name="Classic Avakaya 250g", price=Decimal("299.00"), business_type="home_foods", category="Pickles", description="అసలైన ఆంధ్ర ఆవకాయ... — the king of Andhra pickles, raw mango.", image_url="https://images.unsplash.com/photo-1567982047351-76b6f93e38ee?w=200&q=80"),

                # Snacks & Savories
                MenuItem(name="Challa Chakralu 250g", price=Decimal("120.00"), business_type="home_foods", category="Snacks & Savories", description="Traditional Challa Chakralu — crispy butter rice rings, a timeless Andhra snack.", image_url="https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80"),
                MenuItem(name="Rice Vadiyalu 250g", price=Decimal("120.00"), business_type="home_foods", category="Snacks & Savories", description="సాంప్రదాయ ఆంధ్ర రుచితో... — traditional sun-dried rice crackers.", image_url="https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80"),
                MenuItem(name="Chekkarala Vadiyalu 250g", price=Decimal("150.00"), business_type="home_foods", category="Snacks & Savories", description="అమ్మ చేతి రుచితో, సాంప్రదా... — handmade chekkarala vadiyalu.", image_url="https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80"),
                MenuItem(name="Sagubiyam Vadiyalu 250g", price=Decimal("120.00"), business_type="home_foods", category="Snacks & Savories", description="ఎండలో సహజంగా ఆరబెట్టి... — sago sun-dried crackers.", image_url="https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80"),
                MenuItem(name="Bellam Gavvalu 250g", price=Decimal("195.00"), business_type="home_foods", category="Snacks & Savories", description="Fresh & Crunchy Bellam Gavvalu — sweet jaggery shells, a traditional treat.", image_url="https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80"),
                MenuItem(name="Karram Gavvalu 250g", price=Decimal("159.00"), business_type="home_foods", category="Snacks & Savories", description="Karam Gavvalu — spicy shell-shaped crispy snack from Andhra.", image_url="https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80"),

                # Sweets & Treats
                MenuItem(name="Palli Patti 250g", price=Decimal("169.00"), business_type="home_foods", category="Sweets & Treats", description="Peanut Chikki / Palli Patti — crunchy peanut brittle with jaggery.", image_url="https://images.unsplash.com/photo-1551024601-bec78aea704b?w=200&q=80"),
                MenuItem(name="Pala Penilu 250g", price=Decimal("249.00"), business_type="home_foods", category="Sweets & Treats", description="Experience the authentic taste of Pala Penilu — milk-based traditional sweet.", image_url="https://images.unsplash.com/photo-1551024601-bec78aea704b?w=200&q=80"),
                MenuItem(name="Royal Honey Cashew 250g", price=Decimal("319.00"), business_type="home_foods", category="Sweets & Treats", description="Every bite is rich, crunchy, and coated in pure honey — premium cashew delight.", image_url="https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=200&q=80"),
                MenuItem(name="Gondhu Laddu 250g", price=Decimal("319.00"), business_type="home_foods", category="Sweets & Treats", description="ఈ గొంధు (కృఫ్ల్) నెయ్యిలో... — traditional Gondhu Laddu with pure ghee.", image_url="https://images.unsplash.com/photo-1551024601-bec78aea704b?w=200&q=80"),
                MenuItem(name="Suggula's Kitchen Sweet 250g", price=Decimal("369.00"), business_type="home_foods", category="Sweets & Treats", description="Suggula's Kitchen Sweet & Special — traditional handmade sweet boxes.", image_url="https://images.unsplash.com/photo-1551024601-bec78aea704b?w=200&q=80"),

                # Mixes & Instant
                MenuItem(name="Instant Rasam Mix 250g", price=Decimal("140.00"), business_type="home_foods", category="Mixes & Instant", description="Instant Rasam Mix — Bring the warmth of homemade rasam to your table instantly.", image_url="https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200&q=80"),
                MenuItem(name="Karram Charu Mix 250g", price=Decimal("165.00"), business_type="home_foods", category="Mixes & Instant", description="Karam Charu Mix (Instant Rasam Powder) — spicy pepper rasam mix.", image_url="https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200&q=80"),
                MenuItem(name="Chinthapandu Pulihora Mix 250g", price=Decimal("165.00"), business_type="home_foods", category="Mixes & Instant", description="Chinthapandu Pulihora Mix — tamarind rice spice blend for perfect pulihora.", image_url="https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200&q=80"),
                MenuItem(name="Instant Gravy Mix 250g", price=Decimal("149.00"), business_type="home_foods", category="Mixes & Instant", description="రెస్తారెంట్ స్టైల్ కర్రీ... — restaurant-style instant curry gravy mix.", image_url="https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200&q=80"),

                # Special Products
                MenuItem(name="Suggula's Kitchen Traditional 250g", price=Decimal("349.00"), business_type="home_foods", category="Special Products", description="Suggula's Kitchen Traditional — handcrafted special recipe from grandma's kitchen.", image_url="https://images.unsplash.com/photo-1606914501449-5a96b6ce24ca?w=200&q=80"),
                MenuItem(name="Ashadam Special Neeyi Annam Podi 250g", price=Decimal("449.00"), business_type="home_foods", category="Special Products", description="Neeyi Annam Podi Ashadam Special — pure ghee rice powder for festive occasions.", image_url="https://images.unsplash.com/photo-1606914501449-5a96b6ce24ca?w=200&q=80"),
                MenuItem(name="Saddu Baby Bottu 5g", price=Decimal("99.00"), business_type="home_foods", category="Special Products", description="Saddu Baby Bottu — traditional herbal bottu for infants, a heritage product.", image_url="https://images.unsplash.com/photo-1606914501449-5a96b6ce24ca?w=200&q=80"),
                MenuItem(name="Herbal Sunnipindi 250g", price=Decimal("299.00"), business_type="home_foods", category="Special Products", description="Sunni Pindi Herbal Bath Powder — natural herbal body cleansing powder.", image_url="https://images.unsplash.com/photo-1606914501449-5a96b6ce24ca?w=200&q=80"),
                MenuItem(name="Snack Supply Samosa 250g", price=Decimal("20.00"), business_type="snack_supply", category="Snacks & Savories", description="Crisp pastry filled with spiced potatoes and peas — B2B2C snack supply.", image_url="https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80"),
            ]
            for m in menu_items:
                db.session.add(m)
            db.session.commit()
            logger.info("Menu catalog items seeded successfully")

        # 4. Seed Staff & Customer Users if missing
        staff_user = db.session.scalars(select(User).where(User.email == "staff@brand.com")).first()
        if not staff_user:
            staff_user = Staff(email="staff@brand.com", outlet_id=1, first_name="Alex", last_name="Staff", phone="9848022338")
            staff_user.set_password("staff", bcrypt)
            db.session.add(staff_user)
            db.session.commit()
            logger.info("Default staff seeded: staff@brand.com / staff")

        cust_user = db.session.scalars(select(User).where(User.email == "customer@gmail.com")).first()
        if not cust_user:
            cust_user = Customer(email="customer@gmail.com", first_name="Sarah", last_name="Customer", phone="9999999999")
            cust_user.set_password("customer", bcrypt)
            db.session.add(cust_user)
            db.session.commit()
            logger.info("Default customer seeded: customer@gmail.com / customer")

        owner_user = db.session.scalars(select(User).where(User.email == "owner@brand.com")).first()
        if not owner_user:
            owner_user = User(email="owner@brand.com", role="outlet_owner", first_name="Rajesh", last_name="Owner", phone="9848022339")
            owner_user.set_password("owner", bcrypt)
            db.session.add(owner_user)
            db.session.commit()
            logger.info("Default owner seeded: owner@brand.com / owner")

        # Associate existing outlets to this owner if they aren't owned yet
        if owner_user:
            o1 = db.session.get(Outlet, 1)
            o2 = db.session.get(Outlet, 2)
            if o1 and o1.owner_id is None:
                o1.owner_id = owner_user.id
            if o2 and o2.owner_id is None:
                o2.owner_id = owner_user.id
            db.session.commit()

        # 5. Seed stock items to Outlet 1 if empty
        if db.session.scalar(select(func.count(OutletStock.id))) == 0:
            samosa = db.session.scalars(select(MenuItem).where(MenuItem.name == "Snack Supply Samosa 250g")).first()
            chakralu = db.session.scalars(select(MenuItem).where(MenuItem.name == "Challa Chakralu 250g")).first()
            if samosa and chakralu:
                db.session.add(OutletStock(outlet_id=1, menu_item_id=samosa.id, current_stock=20, restock_limit=10))
                db.session.add(OutletStock(outlet_id=1, menu_item_id=chakralu.id, current_stock=15, restock_limit=10))
                db.session.commit()
                logger.info("Default outlet stocks seeded for Outlet 1")



def _check_and_send_alert(app, outlet_id):
    """Send low-stock email alert if configured."""
    try:
        admin_email = app.config.get("ADMIN_EMAIL")
        if not admin_email or not app.config.get("MAIL_USERNAME"):
            return
        low = db.session.scalars(
            select(OutletStock).where(
                OutletStock.outlet_id == outlet_id,
                OutletStock.current_stock <= OutletStock.restock_limit
            )
        ).all()
        if low:
            outlet = db.session.get(Outlet, outlet_id)
            lines = [f"  - {s.menu_item.name}: {s.current_stock}/{s.restock_limit}" for s in low]
            body = f"⚠️ Low Stock Alert — {outlet.name if outlet else outlet_id}\n\n" + "\n".join(lines)
            msg = Message(subject=f"Low Stock Alert: {outlet.name if outlet else outlet_id}",
                          recipients=[admin_email], body=body)
            mail.send(msg)
    except Exception as e:
        logger.warning(f"Alert email failed: {e}")


def _get_email_html_wrapper(title, content):
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f7f9fc;
                color: #2D3748;
                margin: 0;
                padding: 40px 20px;
            }}
            .card {{
                max-width: 600px;
                margin: 0 auto;
                background: #ffffff;
                border-radius: 16px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                overflow: hidden;
                border: 1px solid #E2E8F0;
            }}
            .header {{
                background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
                padding: 30px;
                text-align: center;
                color: white;
            }}
            .header h1 {{
                margin: 0;
                font-size: 24px;
                font-weight: 800;
                letter-spacing: 0.5px;
            }}
            .body {{
                padding: 40px 30px;
                line-height: 1.6;
                font-size: 15px;
            }}
            .footer {{
                background: #f1f5f9;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #64748b;
                border-top: 1px solid #E2E8F0;
            }}
            .btn {{
                display: inline-block;
                padding: 12px 24px;
                background-color: #f97316;
                color: #ffffff !important;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                margin-top: 20px;
            }}
            .table-container {{
                margin-top: 20px;
                border: 1px solid #E2E8F0;
                border-radius: 8px;
                overflow: hidden;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
            }}
            th {{
                background-color: #f8fafc;
                text-align: left;
                padding: 10px 15px;
                font-size: 13px;
                color: #64748b;
                border-bottom: 1px solid #E2E8F0;
            }}
            td {{
                padding: 12px 15px;
                font-size: 14px;
                border-bottom: 1px solid #F1F5F9;
            }}
            .total-row {{
                font-weight: bold;
                background-color: #f8fafc;
            }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <h1>🍱 FlavorFlow</h1>
            </div>
            <div class="body">
                {content}
            </div>
            <div class="footer">
                &copy; {datetime.now().year} FlavorFlow ERP. All rights reserved.<br>
                This is an automated operational email.
            </div>
        </div>
    </body>
    </html>
    """


def _send_welcome_email(app, user):
    try:
        sender = app.config.get("MAIL_DEFAULT_SENDER") or "noreply@fooderp.local"
        msg = Message(subject="Welcome to FlavorFlow! 🧡", sender=sender, recipients=[user.email])
        content = f"""
        <h2 style="color: #f97316; margin-top: 0;">Welcome to the Family, {user.first_name or 'Friend'}! 👋</h2>
        <p>We are absolutely thrilled to welcome you to <strong>FlavorFlow</strong>! Thank you for signing up and joining our community of food lovers.</p>
        <p>Our kitchen is always busy preparing the warmest, freshest, and most delicious home-cooked meals, ready to be delivered straight to your doorstep.</p>
        <p>Here are your account details:</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
            <strong>Email/Username:</strong> {user.email}<br>
            <strong>Role:</strong> B2C Customer
        </div>
        <p>Go ahead and browse our kitchen catalog to place your very first order!</p>
        <div style="text-align: center;">
            <a href="http://localhost:5173" class="btn">Explore the Shop</a>
        </div>
        """
        msg.html = _get_email_html_wrapper("Welcome", content)
        mail.send(msg)
    except Exception as e:
        logger.warning(f"Failed to send welcome email: {e}")


def _send_order_placed_email(app, order, customer):
    try:
        sender = app.config.get("MAIL_DEFAULT_SENDER") or "noreply@fooderp.local"
        msg = Message(subject=f"We've Received Your Order! #{order.id} 🍕", sender=sender, recipients=[customer.email])
        
        rows = ""
        for it in order.items:
            rows += f"""
            <tr>
                <td>{it.menu_item.name}</td>
                <td>{it.quantity}</td>
                <td>₹{it.price * it.quantity:.2f}</td>
            </tr>
            """
        
        content = f"""
        <h2 style="color: #f97316; margin-top: 0;">Thank you for your order! 🧡</h2>
        <p>Hi {customer.first_name or 'there'}, we've received your order and our chefs are already prepping it with love.</p>
        <p>Here is your order summary:</p>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price</th>
                    </tr>
                </thead>
                <tbody>
                    {rows}
                    <tr class="total-row">
                        <td colspan="2">Total Amount</td>
                        <td>₹{order.total_price:.2f}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <h3 style="margin-top: 25px; color: #1e293b;">Delivery Information</h3>
        <p style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 14px;">
            <strong>Deliver To:</strong> {order.delivery_address or 'Not specified'}<br>
            <strong>Payment Method:</strong> {order.payment_method}
        </p>
        <p>We'll notify you as soon as your delicious box is dispatched and on its way!</p>
        """
        msg.html = _get_email_html_wrapper("Order Confirmed", content)
        mail.send(msg)
    except Exception as e:
        logger.warning(f"Failed to send order placed email: {e}")


def _send_order_shipped_email(app, order, customer, tracking_code):
    try:
        sender = app.config.get("MAIL_DEFAULT_SENDER") or "noreply@fooderp.local"
        msg = Message(subject="Your FlavorFlow Box is on its way! 🚚", sender=sender, recipients=[customer.email])
        content = f"""
        <h2 style="color: #f97316; margin-top: 0;">Your food is on the way! 🚚</h2>
        <p>Hi {customer.first_name or 'there'}, your order #{order.id} has been packed, handed over to our delivery partner, and is officially en route!</p>
        <p>Get ready for a warm, delightful feast.</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 25px; text-align: center;">
            <div style="font-size: 13px; color: #64748b;">SHIPPING TRACKING CODE</div>
            <div style="font-size: 22px; font-weight: 800; color: #f97316; letter-spacing: 1px; margin: 5px 0;">{tracking_code}</div>
            <div style="font-size: 12px; color: #94a3b8;">Use this code to track delivery with our logistics partner.</div>
        </div>
        
        <p>If you have any questions or need to make last-minute changes, please contact our support team immediately.</p>
        """
        msg.html = _get_email_html_wrapper("Order Shipped", content)
        mail.send(msg)
    except Exception as e:
        logger.warning(f"Failed to send order shipped email: {e}")


def _send_admin_created_email(app, admin, temp_password):
    try:
        sender = app.config.get("MAIL_DEFAULT_SENDER") or "noreply@fooderp.local"
        msg = Message(subject="Welcome to FlavorFlow Admin Team! 🛡️", sender=sender, recipients=[admin.email])
        content = f"""
        <h2 style="color: #f97316; margin-top: 0;">Welcome to the Admin Team, {admin.first_name or 'Admin'}! 🛡️</h2>
        <p>Your administrator profile has been successfully set up on the FlavorFlow ERP platform.</p>
        <p>Here are your credentials to log in to the admin panel:</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; line-height: 1.8;">
            <strong>Role:</strong> Administrator<br>
            <strong>Username/Email:</strong> {admin.email}<br>
            <strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 14px;">{temp_password}</code>
        </div>
        
        <div style="text-align: center;">
            <a href="http://localhost:5173" class="btn">Launch Admin Dashboard</a>
        </div>
        """
        msg.html = _get_email_html_wrapper("Admin Onboarding", content)
        mail.send(msg)
    except Exception as e:
        logger.warning(f"Failed to send admin onboarding email: {e}")


def _send_admin_password_changed_email(app, admin, new_password):
    try:
        sender = app.config.get("MAIL_DEFAULT_SENDER") or "noreply@fooderp.local"
        msg = Message(subject="FlavorFlow Admin Password Update 🔐", sender=sender, recipients=[admin.email])
        content = f"""
        <h2 style="color: #f97316; margin-top: 0;">Password Successfully Updated 🔐</h2>
        <p>Hi {admin.first_name or 'Admin'}, the password for your FlavorFlow administrator account has been changed.</p>
        <p>Here is your new password:</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; line-height: 1.8;">
            <strong>Username/Email:</strong> {admin.email}<br>
            <strong>New Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 14px;">{new_password}</code>
        </div>
        
        <p>If you did not request this change, please contact support immediately.</p>
        """
        msg.html = _get_email_html_wrapper("Password Changed", content)
        mail.send(msg)
    except Exception as e:
        logger.warning(f"Failed to send password changed email: {e}")


def _send_staff_created_email(app, staff, temp_password, outlet):
    try:
        sender = app.config.get("MAIL_DEFAULT_SENDER") or "noreply@fooderp.local"
        msg = Message(subject="Welcome to FlavorFlow POS Team! 🏪", sender=sender, recipients=[staff.email])
        content = f"""
        <h2 style="color: #f97316; margin-top: 0;">Welcome to the Team, {staff.first_name or 'Partner'}! 🏪</h2>
        <p>Your cashier profile has been successfully set up on the FlavorFlow ERP platform.</p>
        <p>Here are your temporary credentials to log in and access your terminal:</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; line-height: 1.8;">
            <strong>Assigned Outlet:</strong> {outlet.name if outlet else 'Not Assigned'}<br>
            <strong>Username/Email:</strong> {staff.email}<br>
            <strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 14px;">{temp_password}</code>
        </div>
        
        <p style="font-size: 13px; color: #64748b; font-style: italic;">* Note: You will be prompted to set a secure password of your own upon your very first login.</p>
        
        <div style="text-align: center;">
            <a href="http://localhost:5173" class="btn">Launch Cashier POS Terminal</a>
        </div>
        """
        msg.html = _get_email_html_wrapper("Staff Onboarding", content)
        mail.send(msg)
    except Exception as e:
        logger.warning(f"Failed to send staff onboarding email: {e}")


def _send_daily_digest_email(app, report, email_address):
    try:
        sender = app.config.get("MAIL_DEFAULT_SENDER") or "noreply@fooderp.local"
        msg = Message(subject=f"Daily Revenue Digest — {report.get('date')} 📈", sender=sender, recipients=[email_address])
        content = f"""
        <h2 style="color: #f97316; margin-top: 0;">Operational Daily Report</h2>
        <p>Here is the business performance summary for today, <strong>{report.get('date')}</strong>:</p>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>🛒 B2C Orders Placed</td>
                        <td>{report.get('b2c_orders')} orders</td>
                    </tr>
                    <tr>
                        <td>🥡 B2C Sales Revenue</td>
                        <td>₹{report.get('b2c_revenue'):.2f}</td>
                    </tr>
                    <tr>
                        <td>🏪 POS Outlet Revenue</td>
                        <td>₹{report.get('pos_revenue'):.2f}</td>
                    </tr>
                    <tr class="total-row">
                        <td>📈 Combined Total Revenue</td>
                        <td>₹{report.get('total_revenue'):.2f}</td>
                    </tr>
                    <tr>
                        <td>⚠️ Low Stock Warnings</td>
                        <td style="color: { '#ef4444' if report.get('low_stock_items', 0) > 0 else '#10b981' }; font-weight: 600;">
                            {report.get('low_stock_items')} items need attention
                        </td>
                    </tr>
                    <tr>
                        <td>🕒 Expiring Batches</td>
                        <td style="color: { '#f59e0b' if report.get('expiring_batches', 0) > 0 else '#10b981' }; font-weight: 600;">
                            {report.get('expiring_batches')} batches expiring soon
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <p style="margin-top: 25px;">Please check the central admin console for specific inventory and auditing reports.</p>
        """
        msg.html = _get_email_html_wrapper("Daily Digest", content)
        mail.send(msg)
    except Exception as e:
        logger.warning(f"Failed to send daily digest email: {e}")


def _generate_daily_report():
    """Generate a daily report dict and optionally save to file."""
    try:
        from datetime import date as date_cls
        today = date_cls.today()
        since = datetime.now(timezone.utc) - timedelta(hours=24)

        b2c_rev = db.session.scalar(
            select(func.sum(Order.total_price)).where(
                Order.created_at >= since, Order.status != "cancelled"
            )
        ) or 0
        pos_rev = db.session.scalar(
            select(func.sum(Order.total_price)).where(
                Order.created_at >= since,
                Order.order_type == "pos",
                Order.status != "cancelled"
            )
        ) or 0 or 0
        b2c_cnt = db.session.scalar(
            select(func.count(Order.id)).where(Order.created_at >= since, Order.status != "cancelled")
        ) or 0
        low_stock = db.session.scalars(
            select(OutletStock).where(OutletStock.current_stock <= OutletStock.restock_limit)
        ).all()
        expiring = db.session.scalars(
            select(ProductBatch).where(
                ProductBatch.expiry_date != None,
                ProductBatch.expiry_date <= today + timedelta(days=3)
            )
        ).all()

        report = {
            "date": today.isoformat(),
            "b2c_revenue": float(b2c_rev),
            "pos_revenue": float(pos_rev),
            "total_revenue": float(b2c_rev) + float(pos_rev),
            "b2c_orders": b2c_cnt,
            "low_stock_items": len(low_stock),
            "expiring_batches": len(expiring)
        }

        # Save to file
        os.makedirs("reports", exist_ok=True)
        with open(f"reports/daily_{today.isoformat()}.json", "w") as f:
            json.dump(report, f, indent=2)

        # Send daily digest email to admin
        admin_email = app.config.get("ADMIN_EMAIL")
        if admin_email:
            _send_daily_digest_email(app, report, admin_email)
        
        # Send daily digest email to all outlet owners
        owners = db.session.scalars(select(User).where(User.role == "outlet_owner")).all()
        for owner in owners:
            if owner.email:
                _send_daily_digest_email(app, report, owner.email)

        logger.info(f"Daily report generated: {report}")
        return report
    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        return {"error": str(e)}


def _start_scheduler(app):
    scheduler = BackgroundScheduler(timezone="Asia/Kolkata")

    def run_report():
        with app.app_context():
            _generate_daily_report()

    scheduler.add_job(run_report, "cron", hour=22, minute=0, id="daily_report")
    scheduler.start()
    logger.info("Scheduler started — daily report at 22:00 IST")


if __name__ == "__main__":
    app = create_app()
    debug_mode = os.environ.get("FLASK_ENV", "production") == "development"
    app.run(debug=debug_mode, port=5000)
