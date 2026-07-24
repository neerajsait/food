"""
Migration: Add 'code' column to menu_items and 'tracking_link' column to orders.
Run once to alter existing database tables.
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import db
from sqlalchemy import text, inspect

def migrate():
    app = create_app()
    with app.app_context():
        inspector = inspect(db.engine)

        # --- menu_items.code ---
        menu_cols = [c["name"] for c in inspector.get_columns("menu_items")]
        if "code" not in menu_cols:
            db.session.execute(text("ALTER TABLE menu_items ADD COLUMN code VARCHAR(4) UNIQUE"))
            db.session.commit()
            print("Added 'code' column to menu_items table.")
        else:
            print("'code' column already exists in menu_items.")

        # --- orders.tracking_link ---
        order_cols = [c["name"] for c in inspector.get_columns("orders")]
        if "tracking_link" not in order_cols:
            db.session.execute(text("ALTER TABLE orders ADD COLUMN tracking_link VARCHAR(500)"))
            db.session.commit()
            print("Added 'tracking_link' column to orders table.")
        else:
            print("'tracking_link' column already exists in orders.")

    print("Migration complete.")

if __name__ == "__main__":
    migrate()
