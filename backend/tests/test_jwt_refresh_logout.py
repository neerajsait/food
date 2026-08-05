import pytest
from app import create_app, db

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            from models import User
            admin = User(email="test@admin.com", first_name="Test", last_name="Admin", role="admin")
            from app import bcrypt
            admin.set_password("admin", bcrypt)
            db.session.add(admin)
            db.session.commit()
            yield client
        with app.app_context():
            db.drop_all()

def test_refresh_and_logout(client):
    res = client.post('/api/auth/login', json={"email": "test@admin.com", "password": "admin"})
    assert res.status_code == 200
    data = res.get_json()
    access_token = data.get("access_token")
    refresh_token = data.get("refresh_token")
    assert access_token
    assert refresh_token

    # Refresh
    res2 = client.post('/api/auth/refresh', headers={"Authorization": f"Bearer {refresh_token}"})
    assert res2.status_code == 200
    assert "access_token" in res2.get_json()

    # Logout
    res3 = client.post('/api/auth/logout', headers={"Authorization": f"Bearer {access_token}"}, json={"refresh_token": refresh_token})
    assert res3.status_code == 200

    # Try to use access token again
    res4 = client.get('/api/auth/me', headers={"Authorization": f"Bearer {access_token}"})
    assert res4.status_code in [401, 422]
