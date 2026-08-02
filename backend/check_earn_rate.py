from app import create_app
from models import db, StoreSetting
app = create_app()
with app.app_context():
    earn = db.session.scalars(db.select(StoreSetting).where(StoreSetting.setting_key == 'loyalty_earn_rate')).first()
    print("earn_rate:", earn.setting_value if earn else "None")
