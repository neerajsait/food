import re
import os

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
imports = """
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, get_jwt, get_jwt_identity, create_refresh_token
)
from redis_client import get_redis
"""
content = re.sub(r'from flask_jwt_extended import \(\s*JWTManager, create_access_token, jwt_required, get_jwt, get_jwt_identity\s*\)', imports.strip(), content)

# 2. limiter storage_uri
content = content.replace('storage_uri="memory://"', 'storage_uri=os.getenv("REDIS_URL") or "memory://"')

# 3. JWT config
jwt_old = 'app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=8)'
jwt_new = '''app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=15)
    app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=7)'''
content = content.replace(jwt_old, jwt_new)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched basic stuff")
