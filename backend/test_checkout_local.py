from app import create_app
from models import db, User, MenuItem
app = create_app()

with app.app_context():
    customer = db.session.scalars(db.select(User).where(User.role == 'customer')).first()
    if not customer:
        print("No customer found!")
        exit(1)
        
    item = db.session.scalars(db.select(MenuItem)).first()
    
    with app.test_client() as client:
        from flask_jwt_extended import create_access_token
        token = create_access_token(identity=str(customer.id), additional_claims={"role": "customer"})
        
        response = client.post("/api/foods/order", 
                              json={
                                  "items": [{"menu_item_id": item.id, "quantity": 1}],
                                  "delivery_address": "123 Test St",
                                  "payment_method": "COD",
                                  "delivery_charge": 5.0
                              },
                              headers={"Authorization": f"Bearer {token}"})
        print("Status Code:", response.status_code)
        print("Response:", response.json)
        
        # Test DELETE address
        response2 = client.delete("/api/auth/addresses/99999", headers={"Authorization": f"Bearer {token}"})
        print("Delete Status:", response2.status_code)
        print("Delete Response:", response2.json)
