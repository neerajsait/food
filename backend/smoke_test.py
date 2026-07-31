import os
import logging
from app import create_app, db
from models import Admin, Customer, Staff, OutletOwner, Outlet
from flask_jwt_extended import create_access_token

logging.basicConfig(level=logging.WARNING)

def run_smoke_test():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "RATELIMIT_ENABLED": False,
        "SECRET_KEY": "smoke-test-secret",
        "JWT_SECRET_KEY": "smoke-test-jwt-secret"
    })
    
    with app.app_context():
        db.create_all()
        
        # Create some dummy data to avoid basic foreign key / missing entity errors
        outlet = Outlet(name="Smoke Test Outlet", address="123 Test")
        db.session.add(outlet)
        db.session.commit()
        
        from app import bcrypt
        admin = Admin(email="admin@smoke.test")
        admin.is_superadmin = True
        admin.set_password("adminpass", bcrypt)
        
        db.session.add(admin)
        db.session.commit()
        
        admin_token = create_access_token(identity=admin.id, additional_claims={"role": "admin", "is_superadmin": True})
        headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
        
        client = app.test_client()
        
        rules = list(app.url_map.iter_rules())
        crashed_endpoints = []
        stable_endpoints = []
        
        print(f"Starting smoke test on {len(rules)} endpoints...")
        
        for rule in rules:
            if rule.endpoint == 'static':
                continue
                
            methods = [m for m in rule.methods if m not in ['HEAD', 'OPTIONS']]
            if not methods:
                continue
                
            # Build dummy URL
            url = rule.rule
            url = url.replace("<int:address_id>", "1")
            url = url.replace("<int:menu_item_id>", "1")
            url = url.replace("<string:code>", "TESTCODE")
            url = url.replace("<int:order_id>", "1")
            url = url.replace("<int:ticket_id>", "1")
            url = url.replace("<int:item_id>", "1")
            url = url.replace("<int:outlet_id>", "1")
            url = url.replace("<int:user_id>", "1")
            url = url.replace("<int:id>", "1")
            url = url.replace("<int:sid>", "1")
            url = url.replace("<int:shift_id>", "1")
            url = url.replace("<int:review_id>", "1")
            url = url.replace("<path:filename>", "test.txt")
            
            # Since some endpoints might crash if the payload doesn't match expected schema,
            # we will send a basic dummy payload for POST/PUT.
            dummy_payload = {}
            
            for method in methods:
                try:
                    if method == 'GET':
                        res = client.get(url, headers=headers)
                    elif method == 'POST':
                        res = client.post(url, headers=headers, json=dummy_payload)
                    elif method == 'PUT':
                        res = client.put(url, headers=headers, json=dummy_payload)
                    elif method == 'DELETE':
                        res = client.delete(url, headers=headers)
                    elif method == 'PATCH':
                        res = client.patch(url, headers=headers, json=dummy_payload)
                    else:
                        continue
                        
                    if res.status_code >= 500:
                        crashed_endpoints.append(f"{method} {url} -> {res.status_code} CRASH")
                    else:
                        stable_endpoints.append(f"{method} {url} -> {res.status_code}")
                except Exception as e:
                    crashed_endpoints.append(f"{method} {url} -> CRASH (Exception: {str(e)})")

        print("========================================")
        print(f"Smoke Test Results: {len(stable_endpoints)} Stable | {len(crashed_endpoints)} Crashed")
        print("========================================")
        
        if crashed_endpoints:
            print("Crashed Endpoints:")
            for e in crashed_endpoints:
                print(f" - {e}")
        else:
            print("All tested endpoints are stable (No 500 Internal Server Errors).")

if __name__ == '__main__':
    run_smoke_test()
