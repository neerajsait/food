from app import create_app, db, bcrypt
from models import User, Outlet

app = create_app()

with app.app_context():
    # check if outlet exists
    outlet = Outlet.query.first()
    if not outlet:
        outlet = Outlet(name="Test Outlet", location="Test Location", code="TST")
        db.session.add(outlet)
        db.session.commit()
    
    # check if user exists
    user = User.query.filter_by(staff_code="3134").first()
    if not user:
        user = User(email="staff@example.com", role="staff", outlet_id=outlet.id, staff_code="3134")
        user.set_pin("1234", bcrypt)
        # give a default password just in case
        user.set_password("staffpass", bcrypt)
        db.session.add(user)
        db.session.commit()
        print("Staff user 3134 seeded!")
    else:
        user.set_pin("1234", bcrypt)
        db.session.commit()
        print("Staff user 3134 updated!")
