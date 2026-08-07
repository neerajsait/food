import sys
import re

print('Processing backend/app.py...')
with open('app.py', 'r', encoding='utf-8') as f:
    app_code = f.read()

# 4. WhatsApp placeholder comment
old_wa = '# TODO: Implement WhatsApp order parsing logic'
new_wa = '# FEATURE INCOMPLETE: WhatsApp order parsing, DB order creation, and reply are not implemented yet\n            # TODO: Implement WhatsApp order parsing logic'
app_code = app_code.replace(old_wa, new_wa)

# 7. Token version Redis TTL in app.py
app_code = app_code.replace('8 * 86400', '2 * 86400')

# 9. Admin direct set of loyalty_points
old_loyalty_update = '''            elif key == "loyalty_points":
                old_val = getattr(user, 'loyalty_points', 0)
                user.loyalty_points = value
                logger.info(f"Admin {current_admin_id} changed loyalty points for user {user.id} from {old_val} to {value}")
                log_admin_action(current_admin_id, "UPDATE_USER_LOYALTY", f"Changed from {old_val} to {value}")'''
new_loyalty_update = '''            elif key == "loyalty_points":
                old_points = user.loyalty_points or 0
                user.loyalty_points = int(value)
                log_admin_action(current_admin_id, "UPDATE_USER_LOYALTY", details=f"Loyalty points changed from {old_points} to {user.loyalty_points}")
                logger.info(f"Admin {current_admin_id} changed loyalty points for user {user.id} from {old_points} to {user.loyalty_points}")'''
app_code = app_code.replace(old_loyalty_update, new_loyalty_update)

# 10. Stock restore locking
app_code = app_code.replace('item = db.session.get(MenuItem, line.menu_item_id)', 'item = db.session.get(MenuItem, line.menu_item_id, with_for_update=True)')
app_code = app_code.replace('item = db.session.get(MenuItem, order_item.menu_item_id)', 'item = db.session.get(MenuItem, order_item.menu_item_id, with_for_update=True)')
app_code = app_code.replace('item = db.session.get(MenuItem, item_data["menu_item_id"])', 'item = db.session.get(MenuItem, item_data["menu_item_id"], with_for_update=True)')

# 13. Progressive delay on normal email/password login
old_login = '''        if not user or not user.check_password(password):
            return jsonify({"error": "Unauthorized", "message": "Invalid credentials"}), 401'''
new_login = '''        if not user or not user.check_password(password):
            from redis_client import get_redis
            rc = get_redis()
            failed_count = 1
            if rc:
                lock_key = f"login_attempts:{email}"
                failed_count = int(rc.get(lock_key) or 0) + 1
                rc.setex(lock_key, 300, failed_count)
            import time
            time.sleep(min(failed_count, 3))
            return jsonify({"error": "Unauthorized", "message": "Invalid credentials"}), 401
            
        from redis_client import get_redis
        rc = get_redis()
        if rc:
            rc.delete(f"login_attempts:{email}")'''
if old_login in app_code:
    app_code = app_code.replace(old_login, new_login)

# 20. Replace print with logger.info / logger.warning
app_code = re.sub(r"print\((.*?)\)", r"logger.info(\1)", app_code)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(app_code)

print('Processing backend/models.py...')
with open('models.py', 'r', encoding='utf-8') as f:
    models_code = f.read()
models_code = models_code.replace('8 * 86400', '2 * 86400')
with open('models.py', 'w', encoding='utf-8') as f:
    f.write(models_code)

print('Processing backend/redis_client.py...')
with open('redis_client.py', 'r', encoding='utf-8') as f:
    redis_code = f.read()
if '# WARNING: memory:// backend is single-process only' not in redis_code:
    redis_code = redis_code.replace('def get_redis():', '# WARNING: memory:// backend is single-process only. Never use it with multiple workers/gunicorn processes.\ndef get_redis():')
with open('redis_client.py', 'w', encoding='utf-8') as f:
    f.write(redis_code)

print('Done.')
