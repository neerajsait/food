from app import create_app
from models import User, Admin, db
from sqlalchemy import select

app = create_app()
with app.app_context():
    admin = db.session.scalars(select(User).where(User.email == 'admin')).first()
    if admin:
        print(f"Admin Found: {admin.email}")
        print(f"Role: {admin.role}")
        print(f"Is Superadmin: {getattr(admin, 'is_superadmin', None)}")
        print(f"Department: {getattr(admin, 'admin_department', None)}")
        
        if not getattr(admin, 'is_superadmin', False):
            print("Fixing admin.is_superadmin...")
            admin.is_superadmin = True
            admin.admin_department = "SuperAdmin"
            db.session.commit()
            print("Fixed.")
    else:
        print("No admin user found")
