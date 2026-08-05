import re

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

loader_code = """
jwt = JWTManager()

@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload):
    import os
    from redis_client import get_redis
    jti = jwt_payload["jti"]
    token_version = jwt_payload.get("token_version", 0)
    user_id = jwt_payload.get("sub")
    
    redis_client = get_redis()
    if redis_client:
        try:
            token_in_redis = redis_client.get(f"revoked:{jti}")
            if token_in_redis is not None:
                return True
        except Exception as e:
            import logging
            logging.error(f"Redis error during blocklist check: {e}")
            if os.getenv("FLASK_ENV") == "production":
                return True
    elif os.getenv("FLASK_ENV") == "production":
        return True

    from models import User
    from sqlalchemy import select
    # Use db.session.get for primary key
    user = db.session.get(User, int(user_id)) if user_id else None
    if user:
        if getattr(user, 'token_version', 0) != token_version:
            return True
        if getattr(user, 'is_banned', False) or getattr(user, 'deleted_at', None) is not None:
            return True
    else:
        return True # User doesn't exist

    return False
"""

content = content.replace("jwt = JWTManager()", loader_code)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Added JWT blocklist loader")
