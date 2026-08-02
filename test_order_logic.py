import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from app import create_app, db
from models import Order, MenuItem, User, OrderItem
import traceback

def test_order():
    app = create_app()
    with app.app_context():
        try:
            customer = User.query.filter_by(email="test_checkout2@test.com").first()
            if not customer:
                print("Customer not found")
                return

            items_data = [{"menu_item_id": 30, "quantity": 1}]
            
            total = 0.0
            order_items = []
            for it in items_data:
                mid = it.get("menu_item_id")
                qty = int(it.get("quantity", 1))
                menu_item = db.session.get(MenuItem, mid)
                if not menu_item:
                    raise Exception("Menu item not found")
                
                price = menu_item.price
                total += float(price) * qty
                # THIS IS EXACTLY WHAT APP.PY LINE 940 DOES
                order_items.append(OrderItem(menu_item_id=mid, price=price, quantity=qty))

            order = Order(
                total_price=total,
                status="pending",
                items=order_items,
                payment_method="COD",
                customer_id=customer.id,
                delivery_address="Test Address",
                delivery_charge=50,
                loyalty_points_earned=0,
                loyalty_points_redeemed=0,
                applied_coupon_code=None,
                review_code=None
            )
            db.session.add(order)
            db.session.commit()
            print("Successfully saved order!")
        except Exception as e:
            print("EXCEPTION CAUGHT:")
            traceback.print_exc()
            db.session.rollback()

if __name__ == '__main__':
    test_order()
