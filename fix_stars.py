import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from app import create_app, db
from models import MenuItem

def add_stars():
    app = create_app()
    with app.app_context():
        items = MenuItem.query.all()
        for item in items:
            item.admin_rating = 4.0
        db.session.commit()
        print(f"Updated {len(items)} items to have 4 stars.")

if __name__ == '__main__':
    add_stars()
