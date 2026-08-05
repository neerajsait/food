import re

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. place_order (MenuItem global_stock)
old_place_order = '''            if menu_item.global_stock is not None:
                if menu_item.global_stock < qty:
                    db.session.rollback()
                    return jsonify({"error": "Bad Request", "message": f"Item '{menu_item.name}' is out of stock (only {menu_item.global_stock} left)"}), 400
                menu_item.global_stock -= qty
                
                if menu_item.global_stock == 0:
                    print(f"[NOTIFICATION] KITCHEN/ADMIN: Item '{menu_item.name}' is now SOLD OUT!", flush=True)'''

new_place_order = '''            if menu_item.global_stock is not None:
                from sqlalchemy import update
                result = db.session.execute(
                    update(MenuItem).where(MenuItem.id == mid, MenuItem.global_stock >= qty)
                    .values(global_stock=MenuItem.global_stock - qty)
                )
                if result.rowcount != 1:
                    db.session.rollback()
                    return jsonify({"error": "Conflict", "message": f"Item '{menu_item.name}' is out of stock"}), 409
                db.session.refresh(menu_item)
                
                if menu_item.global_stock == 0:
                    print(f"[NOTIFICATION] KITCHEN/ADMIN: Item '{menu_item.name}' is now SOLD OUT!", flush=True)'''

content = content.replace(old_place_order, new_place_order)


# 2. pos_sale (OutletStock current_stock)
old_pos = '''            if stock.current_stock < qty:
                db.session.rollback()
                mi = db.session.get(MenuItem, mid)
                return jsonify({"error": "Conflict", "message": f"Insufficient stock for {mi.name if mi else mid}"}), 409
            before = stock.current_stock
            stock.current_stock -= qty'''

new_pos = '''            before = stock.current_stock
            from sqlalchemy import update
            result = db.session.execute(
                update(OutletStock).where(OutletStock.outlet_id == oid, OutletStock.menu_item_id == mid, OutletStock.current_stock >= qty)
                .values(current_stock=OutletStock.current_stock - qty)
            )
            if result.rowcount != 1:
                db.session.rollback()
                mi = db.session.get(MenuItem, mid)
                return jsonify({"error": "Conflict", "message": f"Insufficient stock for {mi.name if mi else mid}"}), 409
            db.session.refresh(stock)'''

content = content.replace(old_pos, new_pos)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched stock race conditions")
