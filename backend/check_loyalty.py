from app import create_app
from models import db, User
app = create_app()

with app.app_context():
    users = db.session.scalars(db.select(User).where(User.role == 'customer')).all()
    for u in users:
        print(f"Customer {u.id}: loyalty_points = {u.loyalty_points}")
