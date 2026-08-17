import os
from app import create_app
from models import db, WhatsAppMessage

app = create_app()
with app.app_context():
    WhatsAppMessage.__table__.create(db.engine, checkfirst=True)
    print("WhatsAppMessage table created successfully.")
