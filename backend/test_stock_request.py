from app import create_app
from models import db, StockRequest, OutletStock
app = create_app()
with app.app_context():
    # create a mock stock request
    req = StockRequest(outlet_id=1, menu_item_id=1, quantity=5, status="Pending", type="Restock")
    db.session.add(req)
    db.session.commit()
    print("Created mock stock request with id", req.id)
    
    # try updating it to In Progress
    req.status = "In Progress"
    db.session.commit()
    print("Updated to In Progress")
    
    # try updating it to Dispatched
    req.status = "Dispatched"
    stock = db.session.scalars(db.select(OutletStock).where(OutletStock.outlet_id == req.outlet_id, OutletStock.menu_item_id == req.menu_item_id)).first()
    if stock:
        stock.current_stock += req.quantity
    else:
        stock = OutletStock(outlet_id=req.outlet_id, menu_item_id=req.menu_item_id, current_stock=req.quantity)
        db.session.add(stock)
    db.session.commit()
    print("Updated to Dispatched and stock updated")
