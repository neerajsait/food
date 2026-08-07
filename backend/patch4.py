import sys

with open("app.py", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Public menu rate limit
if '@limiter.limit("60 per minute")' not in code.split('def get_foods_menu():')[0][-100:]:
    code = code.replace(
        '    @app.route("/api/foods/menu", methods=["GET"])\n    def get_foods_menu():',
        '    @app.route("/api/foods/menu", methods=["GET"])\n    @limiter.limit("60 per minute")\n    def get_foods_menu():'
    )
if '@limiter.limit("60 per minute")' not in code.split('def get_food_by_code(code):')[0][-100:]:
    code = code.replace(
        '    @app.route("/api/foods/menu/code/<code>", methods=["GET"])\n    def get_food_by_code(code):',
        '    @app.route("/api/foods/menu/code/<code>", methods=["GET"])\n    @limiter.limit("60 per minute")\n    def get_food_by_code(code):'
    )

# 2. Loyalty points floor
code = code.replace('customer.loyalty_points -= actual_redeem', 'customer.loyalty_points = max(0, (customer.loyalty_points or 0) - actual_redeem)')
# Any other subtraction? Let's check user.loyalty_points -= 
code = code.replace('user.loyalty_points -= ', 'user.loyalty_points = max(0, (user.loyalty_points or 0) - ')

# 3. Production CORS
old_cors = '''    cors_origins = os.getenv("CORS_ORIGINS")
    if cors_origins:
        origins = cors_origins.split(",")'''
new_cors = '''    cors_origins = os.getenv("CORS_ORIGINS")
    if os.getenv("FLASK_ENV") == "production" and not cors_origins:
        raise RuntimeError("CORS_ORIGINS must be set in production")
    if cors_origins:
        origins = cors_origins.split(",")'''
code = code.replace(old_cors, new_cors)

# 4. Normal email/password login progressive delay
old_login = '''        if not user or not getattr(user, 'password_hash', None) or not user.check_password(password):
            return jsonify({"error": "Unauthorized", "message": "Invalid email or password"}), 401'''
new_login = '''        if not user or not getattr(user, 'password_hash', None) or not user.check_password(password):
            from redis_client import get_redis
            rc = get_redis()
            if rc:
                fail_key = f"login_fail:{email}"
                fails = int(rc.get(fail_key) or 0) + 1
                rc.setex(fail_key, 300, fails)
                import time
                time.sleep(min(fails, 3))
            return jsonify({"error": "Unauthorized", "message": "Invalid email or password"}), 401
            
        from redis_client import get_redis
        rc = get_redis()
        if rc:
            rc.delete(f"login_fail:{email}")'''
code = code.replace(old_login, new_login)

# 5. Superadmin direct loyalty_points set log
old_loyalty_update = '''            elif key == "loyalty_points":
                user.loyalty_points = int(value)'''
new_loyalty_update = '''            elif key == "loyalty_points":
                old_points = user.loyalty_points or 0
                user.loyalty_points = int(value)
                log_admin_action(current_admin_id, "UPDATE_USER_LOYALTY", f"Loyalty points changed from {old_points} to {user.loyalty_points}")'''
code = code.replace(old_loyalty_update, new_loyalty_update)

with open("app.py", "w", encoding="utf-8") as f:
    f.write(code)

print("Patch applied.")
