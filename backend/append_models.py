import os

append_content = """

# ---------------------------------------------------------------------------
# Market Purchases (B2B Admin Expenses)
# ---------------------------------------------------------------------------
class MarketPurchase(db.Model):
    __tablename__ = 'market_purchases'
    
    id = Column(Integer, primary_key=True)
    ingredient_name = Column(String(150), nullable=False)
    quantity = Column(Numeric(10, 2), nullable=True)
    unit = Column(String(20), nullable=True)
    cost = Column(Numeric(10, 2), nullable=False)
    notes = Column(Text, nullable=True)
    purchased_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    admin_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    
    admin = relationship('User', foreign_keys=[admin_id])

    def __init__(self, ingredient_name, cost, quantity=None, unit=None, notes=None, admin_id=None):
        self.ingredient_name = ingredient_name
        self.cost = cost
        self.quantity = quantity
        self.unit = unit
        self.notes = notes
        self.admin_id = admin_id

    def to_dict(self):
        return {
            "id": self.id,
            "ingredient_name": self.ingredient_name,
            "quantity": float(self.quantity) if self.quantity is not None else None,
            "unit": self.unit,
            "cost": float(self.cost),
            "notes": self.notes,
            "purchased_at": self.purchased_at.isoformat() if self.purchased_at else None,
            "admin_id": self.admin_id,
            "admin_email": getattr(self.admin, 'email', None) if getattr(self, 'admin', None) else None
        }
"""

with open('models.py', 'a', encoding='utf-8') as f:
    f.write(append_content)
    
print("Successfully appended MarketPurchase model to models.py")
