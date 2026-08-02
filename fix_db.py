import os
import sys

# Add the root directory to path so we can import backend
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from backend.app import create_app, db
from sqlalchemy import text

app = create_app()
with app.app_context():
    try:
        db.session.execute(text("ALTER TABLE orders ADD COLUMN delivery_charge DECIMAL(10, 2) DEFAULT 0.00 NOT NULL"))
        db.session.commit()
        print("Successfully added delivery_charge column to orders table.")
    except Exception as e:
        print("Error:", e)
