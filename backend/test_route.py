from app import create_app
from models import db, StockRequest
app = create_app()

with app.app_context():
    # Let's get a stock request
    req = db.session.scalars(db.select(StockRequest)).first()
    if not req:
        req = StockRequest(outlet_id=1, menu_item_id=1, quantity=5, status="Pending", type="Restock")
        db.session.add(req)
        db.session.commit()
        print("Created mock stock request with id", req.id)
    
    # Let's simulate a PUT request to /api/kitchen/stock-requests/{req.id}/status
    with app.test_client() as client:
        # Mock role_required decorator by creating a token
        from flask_jwt_extended import create_access_token
        token = create_access_token(identity="1", additional_claims={"role": "admin"})
        
        response = client.put(f"/api/kitchen/stock-requests/{req.id}/status", 
                              json={"status": "In Progress"},
                              headers={"Authorization": f"Bearer {token}"})
        print("Status Code:", response.status_code)
        print("Response:", response.json)
        
        response = client.put(f"/api/kitchen/stock-requests/{req.id}/status", 
                              json={"status": "Dispatched"},
                              headers={"Authorization": f"Bearer {token}"})
        print("Status Code:", response.status_code)
        print("Response:", response.json)
