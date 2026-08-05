import re

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

old_claims = '''        additional_claims = {
            "role": user.role,
            "outlet_id": user.outlet_id if hasattr(user, 'outlet_id') else None,
            "admin_department": getattr(user, 'admin_department', None),
            "is_superadmin": getattr(user, 'is_superadmin', False)
        }
        token = create_access_token(identity=str(user.id), additional_claims=additional_claims)'''

new_claims = '''        additional_claims = {
            "role": user.role,
            "outlet_id": getattr(user, 'outlet_id', None),
            "admin_department": getattr(user, 'admin_department', None),
            "is_superadmin": getattr(user, 'is_superadmin', False),
            "token_version": getattr(user, 'token_version', 0)
        }
        token = create_access_token(identity=str(user.id), additional_claims=additional_claims)
        refresh_token = create_refresh_token(identity=str(user.id), additional_claims=additional_claims)'''

if old_claims in content:
    content = content.replace(old_claims, new_claims)
else:
    print("WARNING: old_claims not found")

old_return = 'return jsonify({"access_token": token, "user": user.to_dict()}), 200'
new_return = 'return jsonify({"access_token": token, "refresh_token": refresh_token, "user": user.to_dict()}), 200'
content = content.replace(old_return, new_return)

routes = '''
    @app.route("/api/auth/refresh", methods=["POST"])
    @limiter.limit("30 per minute")
    @jwt_required(refresh=True)
    def refresh():
        identity = get_jwt_identity()
        claims = get_jwt()
        
        additional_claims = {
            "role": claims.get("role"),
            "outlet_id": claims.get("outlet_id"),
            "admin_department": claims.get("admin_department"),
            "is_superadmin": claims.get("is_superadmin", False),
            "token_version": claims.get("token_version", 0)
        }
        
        access_token = create_access_token(identity=identity, additional_claims=additional_claims)
        return jsonify({"access_token": access_token}), 200

    @app.route("/api/auth/logout", methods=["POST"])
    @jwt_required()
    def logout():
        jti = get_jwt()["jti"]
        from datetime import datetime, timezone
        from redis_client import get_redis
        
        redis_client = get_redis()
        if redis_client:
            exp = get_jwt().get("exp")
            now = int(datetime.now(timezone.utc).timestamp())
            ttl = max(1, exp - now) if exp else 3600
            redis_client.setex(f"revoked:{jti}", ttl, "1")
            
            data = sanitize_input(request.get_json(silent=True)) or {}
            refresh_token = data.get("refresh_token")
            if refresh_token:
                from flask_jwt_extended import decode_token
                try:
                    rt_claims = decode_token(refresh_token)
                    rt_jti = rt_claims["jti"]
                    rt_exp = rt_claims["exp"]
                    rt_ttl = max(1, rt_exp - now)
                    redis_client.setex(f"revoked:{rt_jti}", rt_ttl, "1")
                except Exception:
                    pass

        return jsonify({"message": "Logged out"}), 200
'''

content = content.replace('@app.route("/api/auth/me"', routes + '\n    @app.route("/api/auth/me"')

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched auth routes")
