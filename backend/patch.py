import re

with open("app.py", "r", encoding="utf-8") as f:
    code = f.read()

# 1. WhatsApp Webhook (including fix 1, 7, and 12)
old_whatsapp = '''    @app.route("/api/whatsapp/webhook", methods=["GET", "POST"])
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
            # TODO: Implement proper X-Hub-Signature-256 verification from Meta
            # For now, reject empty payloads more strictly
            if not data:
                return "Bad Request", 400
            
            if data:
                # Placeholder logic to log the incoming payload
                logger.info(f"Received WhatsApp Webhook payload: {json.dumps(data)}")
                
                # TODO: Parse the data to extract customer phone, message/cart contents.
                # TODO: Create a new Order in the database with order_type='whatsapp'.
                # TODO: Send a reply back to the customer via WhatsApp API confirming the order.
                
                # Acknowledge receipt of the webhook to Meta
                return "EVENT_RECEIVED", 200
            return "Bad Request", 400'''

new_whatsapp = '''    @app.route("/api/whatsapp/webhook", methods=["GET", "POST"])
    @limiter.limit("30 per minute")
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
                return jsonify({"challenge": challenge}), 200
            else:
                return jsonify({"error": "Forbidden"}), 403
                
        elif request.method == "POST":
            # Receive incoming messages/orders
            
            signature = request.headers.get("X-Hub-Signature-256")
            if not signature:
                return jsonify({"error": "Forbidden", "message": "Missing signature"}), 403
                
            import hmac
            import hashlib
            expected_signature = 'sha256=' + hmac.new(
                os.getenv("APP_SECRET", app.config["SECRET_KEY"]).encode('utf-8'),
                request.get_data(),
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(signature, expected_signature):
                return jsonify({"error": "Forbidden", "message": "Invalid signature"}), 403
                
            data = request.get_json(silent=True)
            # TODO: Implement proper X-Hub-Signature-256 verification from Meta
            # For now, reject empty payloads more strictly
            if not data:
                return jsonify({"error": "Bad Request", "message": "Empty payload"}), 400
            
            if data:
                # Placeholder logic to log the incoming payload
                logger.info(f"Received WhatsApp Webhook payload: {json.dumps(data)}")
                
                # TODO: Parse the data to extract customer phone, message/cart contents.
                # TODO: Create a new Order in the database with order_type='whatsapp'.
                # TODO: Send a reply back to the customer via WhatsApp API confirming the order.
                
                # Acknowledge receipt of the webhook to Meta
                return jsonify({"status": "EVENT_RECEIVED"}), 200
            return jsonify({"error": "Bad Request"}), 400'''

if old_whatsapp in code:
    code = code.replace(old_whatsapp, new_whatsapp)

# 2. Rate limits for public coupon endpoints
code = code.replace(
    '@app.route("/api/coupons/active", methods=["GET"])\n    def get_active_coupons():',
    '@app.route("/api/coupons/active", methods=["GET"])\n    @limiter.limit("30 per minute")\n    def get_active_coupons():'
)
code = code.replace(
    '@app.route("/api/coupons/<string:code>", methods=["GET"])\n    def get_coupon(code):',
    '@app.route("/api/coupons/<string:code>", methods=["GET"])\n    @limiter.limit("30 per minute")\n    def get_coupon(code):'
)

# 3. Staff PIN brute-force protection
old_staff_login = '''        # Check if this is a staff login via staff_code
        staff_code = (data.get("staff_code") or "").strip()
        pin = data.get("pin", "")
        
        if staff_code and pin:
            user = db.session.scalars(select(User).where(User.staff_code == staff_code)).first()
            if not user or getattr(user, 'pin_hash', None) is None or not user.check_pin(pin, bcrypt):
                logger.warning(f"Failed staff login attempt for staff_code: {staff_code}")
                return jsonify({"error": "Unauthorized", "message": "Invalid staff code or PIN"}), 401'''

new_staff_login = '''        # Check if this is a staff login via staff_code
        staff_code = (data.get("staff_code") or "").strip()
        pin = data.get("pin", "")
        
        if staff_code and pin:
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
if old_staff_login in code:
    code = code.replace(old_staff_login, new_staff_login)

# 4. Wallet credit/debit reject invalid amounts
old_credit = '''        amount = data.get("amount")
        description = data.get("description", "Wallet Credit")
        if not user_id or not amount:
            return jsonify({"error": "Bad Request", "message": "user_id and amount are required"}), 400'''

new_credit = '''        amount = data.get("amount")
        description = data.get("description", "Wallet Credit")
        if not user_id or not amount:
            return jsonify({"error": "Bad Request", "message": "user_id and amount are required"}), 400
        try:
            amount = int(amount)
            if amount <= 0:
                raise ValueError()
        except ValueError:
            return jsonify({"error": "Bad Request", "message": "Amount must be a positive integer"}), 400'''
if old_credit in code:
    code = code.replace(old_credit, new_credit)

old_debit = '''        amount = data.get("amount")
        description = data.get("description", "Wallet Debit")
        if not user_id or not amount:
            return jsonify({"error": "Bad Request", "message": "user_id and amount are required"}), 400'''

new_debit = '''        amount = data.get("amount")
        description = data.get("description", "Wallet Debit")
        if not user_id or not amount:
            return jsonify({"error": "Bad Request", "message": "user_id and amount are required"}), 400
        try:
            amount = int(amount)
            if amount <= 0:
                raise ValueError()
        except ValueError:
            return jsonify({"error": "Bad Request", "message": "Amount must be a positive integer"}), 400'''
if old_debit in code:
    code = code.replace(old_debit, new_debit)

# 6. Reduce broad exception handling
code = code.replace("except:", "except Exception as e:")

# 7. Add rate limiting to other public endpoints
code = code.replace(
    '@app.route("/api/foods/menu", methods=["GET"])\n    def get_public_menu():',
    '@app.route("/api/foods/menu", methods=["GET"])\n    @limiter.limit("60 per minute")\n    def get_public_menu():'
)
code = code.replace(
    '@app.route("/api/foods/menu/code/<string:food_code>", methods=["GET"])\n    def get_public_food_by_code(food_code):',
    '@app.route("/api/foods/menu/code/<string:food_code>", methods=["GET"])\n    @limiter.limit("60 per minute")\n    def get_public_food_by_code(food_code):'
)

# 8. Prevent loyalty points from going negative
code = re.sub(r'user\.loyalty_points\s*-\s*(\w+)', r'max(0, (user.loyalty_points or 0) - \1)', code)
code = code.replace('user.loyalty_points = user.loyalty_points - loyalty_points_to_redeem', 'user.loyalty_points = max(0, (user.loyalty_points or 0) - loyalty_points_to_redeem)')

# 9. Stock restoration race condition
code = code.replace('Food.query.get(item.food_id)', 'db.session.get(Food, item.food_id, with_for_update=True)')
code = code.replace('db.session.get(Food, item.food_id)', 'db.session.get(Food, item.food_id, with_for_update=True)')
code = code.replace('db.session.get(Food, item["food_id"])', 'db.session.get(Food, item["food_id"], with_for_update=True)')

# 10. Wallet / admin loyalty direct set
old_loyalty_set = '''            elif key == "loyalty_points":
                user.loyalty_points = value'''
new_loyalty_set = '''            elif key == "loyalty_points":
                old_val = getattr(user, 'loyalty_points', 0)
                user.loyalty_points = value
                logger.info(f"Admin {current_admin_id} changed loyalty points for user {user.id} from {old_val} to {value}")'''
if old_loyalty_set in code:
    code = code.replace(old_loyalty_set, new_loyalty_set)

# 11. Add a check that after secure_filename() the filename is not empty before saving uploads
old_upload = '''                filename = secure_filename(file.filename)
                unique_name = f"{int(datetime.now().timestamp())}_{filename}"'''
new_upload = '''                filename = secure_filename(file.filename)
                if not filename:
                    return jsonify({"error": "Bad Request", "message": "Invalid filename"}), 400
                unique_name = f"{int(datetime.now().timestamp())}_{filename}"'''
if old_upload in code:
    code = code.replace(old_upload, new_upload)

# 13. Ensure CORS in production only uses the CORS_ORIGINS environment variable
old_cors = '''    if os.getenv("FLASK_ENV") == "production":
        cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    else:'''
new_cors = '''    if os.getenv("FLASK_ENV") == "production":
        cors_origins = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else []
    else:'''
if old_cors in code:
    code = code.replace(old_cors, new_cors)

# 14. Add a short comment near Flask-Migrate initialization
old_migrate = '''    migrate = Migrate(app, db)'''
new_migrate = '''    # TODO: Ensure real migration scripts exist and are applied for token_version and attachment_filename
    migrate = Migrate(app, db)'''
if old_migrate in code:
    code = code.replace(old_migrate, new_migrate)

with open("app.py", "w", encoding="utf-8") as f:
    f.write(code)

print("Patching complete.")
