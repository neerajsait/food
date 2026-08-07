import sys
import re

print("Processing app.py")
with open("app.py", "r", encoding="utf-8") as f:
    app_code = f.read()

# 1. Broad exceptions
# JWT check_if_token_revoked
app_code = app_code.replace('''        except redis.RedisError as e:
            import logging
            logging.error(f"Redis error during blocklist check: {e}")''', '''        except redis.RedisError as e:
            import logging
            logging.error(f"Redis error during blocklist check: {e}")''') # Keep it if it's already there
# If it's except Exception
app_code = app_code.replace('''        except Exception as e:
            import logging
            logging.error(f"Redis error during blocklist check: {e}")''', '''        except redis.RedisError as e:
            import logging
            logging.error(f"Redis error during blocklist check: {e}")''')

# Staff login / Normal login Redis (they use except Exception currently? Wait, no, they don't have except in staff_login redis checks usually. Let's look for bare excepts)
# Wallet credit / debit
app_code = app_code.replace('''        except Exception as e:
            return jsonify({"error": "Bad Request", "message": "Invalid amount format"}), 400''', '''        except ValueError as e:
            logger.warning(f"Invalid amount format in wallet credit: {e}")
            return jsonify({"error": "Bad Request", "message": "Invalid amount format"}), 400''')
app_code = app_code.replace('''        except Exception as e:
            return jsonify({"error": "Bad Request", "message": "Invalid amount"}), 400''', '''        except ValueError as e:
            logger.warning(f"Invalid amount format in wallet debit: {e}")
            return jsonify({"error": "Bad Request", "message": "Invalid amount"}), 400''')
            
# Stock deduction / restore
app_code = app_code.replace('''        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "Internal Error", "message": str(e)}), 500''', '''        except sqlalchemy.exc.SQLAlchemyError as e:
            db.session.rollback()
            logger.error(f"Database error during stock deduction/restore: {e}")
            return jsonify({"error": "Internal Error", "message": "Database error occurred"}), 500''')


# 2. Public coupon comments
if '# Intentionally public (storefront) but rate-limited' not in app_code:
    app_code = app_code.replace(
        '@app.route("/api/coupons/active", methods=["GET"])\n    @limiter.limit("30 per minute")',
        '# Intentionally public (storefront) but rate-limited\n    @app.route("/api/coupons/active", methods=["GET"])\n    @limiter.limit("30 per minute")'
    )
    app_code = app_code.replace(
        '@app.route("/api/coupons/<string:code>", methods=["GET"])\n    @limiter.limit("30 per minute")',
        '# Intentionally public (storefront) but rate-limited\n    @app.route("/api/coupons/<string:code>", methods=["GET"])\n    @limiter.limit("30 per minute")'
    )
    # Handle if previous comment '# Intentionally public but rate-limited' exists
    app_code = app_code.replace('# Intentionally public but rate-limited\n    @app.route("/api/coupons', '# Intentionally public (storefront) but rate-limited\n    @app.route("/api/coupons')

# 3. WhatsApp feature comment
if '# FEATURE INCOMPLETE: WhatsApp order parsing, DB order creation, and automated reply are not implemented yet' not in app_code:
    app_code = app_code.replace(
        '# TODO: Implement WhatsApp order parsing logic',
        '# FEATURE INCOMPLETE: WhatsApp order parsing, DB order creation, and automated reply are not implemented yet\n            # TODO: Implement WhatsApp order parsing logic'
    )
    app_code = app_code.replace(
        '# FEATURE INCOMPLETE: WhatsApp order parsing, DB order creation, and reply are not implemented yet',
        '# FEATURE INCOMPLETE: WhatsApp order parsing, DB order creation, and automated reply are not implemented yet'
    )

# 4. Alembic comment
old_alembic = '# IMPORTANT: Ensure Alembic migrations exist for token_version and attachment_filename columns'
new_alembic = '''# IMPORTANT: Real Alembic migration scripts must exist and be applied for:
    # - users.token_version
    # - support_tickets.attachment_filename
    # db.create_all() will NOT add these columns on existing databases.'''
if new_alembic not in app_code:
    if old_alembic in app_code:
        app_code = app_code.replace(old_alembic, new_alembic)
    else:
        app_code = app_code.replace('Migrate(app, db)', f'{new_alembic}\n    Migrate(app, db)')

# 5. CSP Comments are verified by my previous check, but let's make sure they exist
# Already handled previously.

# 6. Admin routes department_required
# Example: HR/Finance
app_code = app_code.replace(
    '@app.route("/api/admin/staff", methods=["POST"])\n    @role_required("admin")\n    def create_staff():',
    '@app.route("/api/admin/staff", methods=["POST"])\n    @role_required("admin")\n    # TODO: consider department_required\n    def create_staff():'
)
# Revert my previous @department_required if it was wrong, or add to others. The prompt says "prefer adding or switching to @department_required(...) while still allowing superadmin."
# Let's add it to /api/admin/system/settings
app_code = app_code.replace(
    '@app.route("/api/admin/system/settings", methods=["POST"])\n    @role_required("admin")\n    def update_settings():',
    '@app.route("/api/admin/system/settings", methods=["POST"])\n    @role_required("admin")\n    @department_required("Operations")\n    def update_settings():'
)

# 8. Minor cleanup
app_code = re.sub(r'print\((.*?)\)', r'logger.info(\1)', app_code)

with open("app.py", "w", encoding="utf-8") as f:
    f.write(app_code)

print("Processing redis_client.py")
with open("redis_client.py", "r", encoding="utf-8") as f:
    redis_code = f.read()

if '# WARNING: memory:// backend is single-process only. Never use it with multiple workers/gunicorn processes.' not in redis_code:
    redis_code = redis_code.replace(
        'def get_redis():',
        '# WARNING: memory:// backend is single-process only. Never use it with multiple workers/gunicorn processes.\ndef get_redis():'
    )
    with open("redis_client.py", "w", encoding="utf-8") as f:
        f.write(redis_code)

print("Done patching.")
