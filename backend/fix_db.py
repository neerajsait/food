from app import create_app, db
from sqlalchemy import text

app = create_app()
with app.app_context():
    try:
        db.session.execute(text("ALTER TABLE orders ADD COLUMN delivery_charge DECIMAL(10, 2) DEFAULT 0.00 NOT NULL"))
        db.session.commit()
        print("Successfully added delivery_charge column to orders table.")
    except Exception as e:
        print("Error:", e)
