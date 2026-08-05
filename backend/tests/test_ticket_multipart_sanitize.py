import pytest
import io
from app import create_app, db

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            from models import Customer
            c = Customer(email="test@cust.com", first_name="Test", last_name="Cust")
            c.set_password("custpass", app.extensions['bcrypt'])
            db.session.add(c)
            db.session.commit()
            
        yield client
        with app.app_context():
            db.drop_all()

def test_ticket_upload_security(client):
    # Login to get token
    res = client.post('/api/auth/login', json={"email": "test@cust.com", "password": "custpass"})
    token = res.get_json()["access_token"]
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 1: disallowed extension
    data = {
        "issue_type": "<script>alert(1)</script>",
        "description": "I have an issue",
        "attachment": (io.BytesIO(b"malicious script"), "hack.sh")
    }
    
    res = client.post('/api/tickets', headers=headers, data=data, content_type='multipart/form-data')
    assert res.status_code == 400
    assert "Disallowed file extension" in res.get_json().get("message", "")

    # Test 2: allowed extension but with XSS in issue_type
    data2 = {
        "issue_type": "<script>alert(1)</script>",
        "description": "I have an issue",
        "attachment": (io.BytesIO(b"fake image"), "image.png")
    }
    
    res2 = client.post('/api/tickets', headers=headers, data=data2, content_type='multipart/form-data')
    # Should succeed or return 201
    assert res2.status_code in [200, 201]
    
    # Check XSS sanitization
    ticket_id = res2.get_json().get("ticket", {}).get("id")
    res3 = client.get(f'/api/tickets/{ticket_id}', headers=headers)
    
    issue_type = res3.get_json().get("issue_type", "")
    assert "<script>" not in issue_type
    assert "&lt;script&gt;" in issue_type or "alert(1)" in issue_type or issue_type == "" # bleached

