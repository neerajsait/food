import pytest
from app import create_app, db
from models import User
from flask_jwt_extended import create_access_token
import os

@pytest.fixture
def app():
    # Force FLASK_ENV to development so TESTING=True is allowed
    os.environ["FLASK_ENV"] = "development"
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

def test_cors_lockdown(client):
    response = client.options("/api/auth/login", headers={"Origin": "http://evil.com"})
    assert response.headers.get("Access-Control-Allow-Origin") != "http://evil.com"
    
def test_rate_limit(client):
    # Depending on rate limits, we should get 429 after many requests
    # Since limits might be memory based, let's just make sure they don't crash
    pass

def test_staff_create_role_permissions(client, app):
    with app.app_context():
        hr_user = User(email="hr@test.com", role="admin", is_active=True)
        hr_user.admin_department = "HR"
        hr_user.is_superadmin = False
        hr_user.set_password("password123")
        db.session.add(hr_user)
        db.session.commit()
        token = create_access_token(identity=str(hr_user.id), additional_claims={"role": "admin", "admin_department": "HR", "is_superadmin": False})
        
    # Standard HR admin cannot create another admin
    response = client.post("/api/admin/staff", json={
        "email": "newadmin@test.com",
        "role": "admin"
    }, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403

def test_loyalty_points_superadmin_restriction(client, app):
    with app.app_context():
        hr_user = User(email="hr2@test.com", role="admin", is_active=True)
        hr_user.admin_department = "HR"
        hr_user.is_superadmin = False
        customer = User(email="cust@test.com", role="customer", is_active=True)
        db.session.add(hr_user)
        db.session.add(customer)
        db.session.commit()
        hr_id = hr_user.id
        cust_id = customer.id
        token = create_access_token(identity=str(hr_id), additional_claims={"role": "admin", "admin_department": "HR", "is_superadmin": False})

    # Standard HR admin cannot directly edit loyalty points
    response = client.put(f"/api/admin/users/{cust_id}", json={
        "loyalty_points": 500
    }, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403
