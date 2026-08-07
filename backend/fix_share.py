import sys
with open("app.py", "r", encoding="utf-8") as f:
    code = f.read()

old_analytics = '''    @app.route("/api/admin/analytics", methods=["GET"])
    @role_required("admin", "outlet_owner")
    def admin_analytics():
        claims = get_jwt()
        role = claims.get("role")
        user_outlet_id = claims.get("outlet_id")

        days = int(request.args.get("days", 30))
        since = datetime.now(timezone.utc) - timedelta(days=days)

        # Base conditions
        b2c_conditions = [Order.created_at >= since, Order.order_type == "online", Order.status != "cancelled"]
        pos_conditions = [Order.created_at >= since, Order.order_type == "pos", Order.status != "cancelled"]
        
        if role == "outlet_owner" and user_outlet_id:
            b2c_conditions.append(Order.outlet_id == user_outlet_id)
            pos_conditions.append(Order.outlet_id == user_outlet_id)'''

new_analytics = '''    @app.route("/api/admin/analytics", methods=["GET"])
    @role_required("admin", "outlet_owner")
    def admin_analytics():
        claims = get_jwt()
        role = claims.get("role")
        user_outlet_id = claims.get("outlet_id")
        share_pct = 0.0

        days = int(request.args.get("days", 30))
        since = datetime.now(timezone.utc) - timedelta(days=days)

        # Base conditions
        b2c_conditions = [Order.created_at >= since, Order.order_type == "online", Order.status != "cancelled"]
        pos_conditions = [Order.created_at >= since, Order.order_type == "pos", Order.status != "cancelled"]
        
        if role == "outlet_owner" and user_outlet_id:
            b2c_conditions.append(Order.outlet_id == user_outlet_id)
            pos_conditions.append(Order.outlet_id == user_outlet_id)
            outlet_obj = db.session.get(Outlet, user_outlet_id)
            if outlet_obj and outlet_obj.revenue_share_percentage:
                share_pct = float(outlet_obj.revenue_share_percentage)'''

code = code.replace(old_analytics, new_analytics)
code = code.replace("and 'share_pct' in locals():", ":")

with open("app.py", "w", encoding="utf-8") as f:
    f.write(code)
