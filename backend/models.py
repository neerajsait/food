from datetime import datetime, timezone
from decimal import Decimal
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Numeric, Boolean, Float, Date
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property

db = SQLAlchemy()


# ---------------------------------------------------------------------------
# Outlet — physical snack supply station
# ---------------------------------------------------------------------------
class Outlet(db.Model):
    __tablename__ = 'outlets'

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    address = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    owner_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL', use_alter=True, name='fk_outlet_owner_id'), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship('User', foreign_keys=[owner_id], backref='owned_outlets')

    def __init__(self, name, address, latitude=None, longitude=None, owner_id=None):
        self.name = name
        self.address = address
        self.latitude = latitude
        self.longitude = longitude
        self.owner_id = owner_id

    @property
    def current_stock(self):
        return sum(s.current_stock for s in self.stocks)

    @property
    def needs_restock(self):
        return any(s.needs_restock for s in self.stocks)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "address": self.address,
            "current_stock": self.current_stock,
            "needs_restock": self.needs_restock,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "owner_id": self.owner_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "items": [s.to_dict() for s in self.stocks]
        }


# ---------------------------------------------------------------------------
# User — admin / customer / staff / outlet_owner
# ---------------------------------------------------------------------------
class User(db.Model):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    email = Column(String(120), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default='customer')
    first_name = Column(String(50), nullable=True)
    last_name = Column(String(50), nullable=True)
    phone = Column(String(20), nullable=True)
    outlet_id = Column(Integer, ForeignKey('outlets.id', ondelete='SET NULL'), nullable=True)
    is_active = Column(Boolean, default=True)
    password_reset_token = Column(String(255), nullable=True)
    password_reset_expiry = Column(DateTime, nullable=True)
    is_first_login = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    outlet = relationship('Outlet', foreign_keys=[outlet_id], backref='staff')

    def __init__(self, email, role='customer', first_name=None, last_name=None, phone=None, outlet_id=None):
        self.email = email
        self.role = role
        self.first_name = first_name
        self.last_name = last_name
        self.phone = phone
        self.outlet_id = outlet_id
        self.is_first_login = False

    def set_password(self, password: str, bcrypt):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password: str, bcrypt) -> bool:
        return bcrypt.check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "role": self.role,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "phone": self.phone,
            "outlet_id": self.outlet_id,
            "outlet_name": self.outlet.name if self.outlet else None,
            "is_active": self.is_active,
            "is_first_login": self.is_first_login,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


# ---------------------------------------------------------------------------
# MenuItem — global food catalog
# ---------------------------------------------------------------------------
class MenuItem(db.Model):
    __tablename__ = 'menu_items'

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    business_type = Column(String(20), nullable=False)  # 'home_foods', 'snack_supply', 'both'
    category = Column(String(50), nullable=True)
    image_url = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def __init__(self, name, price, business_type, description=None, category=None, image_url=None, is_active=True):
        self.name = name
        self.price = price
        self.business_type = business_type
        self.description = description
        self.category = category
        self.image_url = image_url
        self.is_active = is_active

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "price": float(self.price),
            "business_type": self.business_type,
            "category": self.category,
            "image_url": self.image_url,
            "is_active": self.is_active
        }


# ---------------------------------------------------------------------------
# OutletStock — per-item inventory at each outlet
# ---------------------------------------------------------------------------
class OutletStock(db.Model):
    __tablename__ = 'outlet_stocks'

    id = Column(Integer, primary_key=True)
    outlet_id = Column(Integer, ForeignKey('outlets.id', ondelete='CASCADE'), nullable=False)
    menu_item_id = Column(Integer, ForeignKey('menu_items.id', ondelete='CASCADE'), nullable=False)
    current_stock = Column(Integer, nullable=False, default=0)
    restock_limit = Column(Integer, nullable=False, default=10)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    outlet = relationship('Outlet', backref=db.backref('stocks', cascade='all, delete-orphan'))
    menu_item = relationship('MenuItem', backref='outlet_stocks', lazy='joined')

    def __init__(self, outlet_id, menu_item_id, current_stock=0, restock_limit=10):
        self.outlet_id = outlet_id
        self.menu_item_id = menu_item_id
        self.current_stock = current_stock
        self.restock_limit = restock_limit

    @property
    def needs_restock(self):
        return self.current_stock <= self.restock_limit

    def to_dict(self):
        return {
            "id": self.id,
            "outlet_id": self.outlet_id,
            "menu_item_id": self.menu_item_id,
            "menu_item_name": self.menu_item.name if self.menu_item else None,
            "menu_item_price": float(self.menu_item.price) if self.menu_item else 0.0,
            "current_stock": self.current_stock,
            "restock_limit": self.restock_limit,
            "needs_restock": self.needs_restock
        }


# ---------------------------------------------------------------------------
# Supplier / Vendor Master
# ---------------------------------------------------------------------------
class Supplier(db.Model):
    __tablename__ = 'suppliers'

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    contact_name = Column(String(100), nullable=True)
    phone = Column(String(30), nullable=True)
    email = Column(String(120), nullable=True)
    address = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    items = relationship('SupplierItem', backref='supplier', cascade='all, delete-orphan')

    def __init__(self, name, contact_name=None, phone=None, email=None, address=None, notes=None):
        self.name = name
        self.contact_name = contact_name
        self.phone = phone
        self.email = email
        self.address = address
        self.notes = notes

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "contact_name": self.contact_name,
            "phone": self.phone,
            "email": self.email,
            "address": self.address,
            "notes": self.notes,
            "is_active": self.is_active,
            "item_count": len(self.items),
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


# ---------------------------------------------------------------------------
# SupplierItem — link between Supplier and MenuItem
# ---------------------------------------------------------------------------
class SupplierItem(db.Model):
    __tablename__ = 'supplier_items'

    id = Column(Integer, primary_key=True)
    supplier_id = Column(Integer, ForeignKey('suppliers.id', ondelete='CASCADE'), nullable=False)
    menu_item_id = Column(Integer, ForeignKey('menu_items.id', ondelete='CASCADE'), nullable=False)
    cost_price = Column(Numeric(10, 2), nullable=True)
    lead_days = Column(Integer, nullable=True, default=1)

    menu_item = relationship('MenuItem', backref='supplier_links')

    def __init__(self, supplier_id, menu_item_id, cost_price=None, lead_days=1):
        self.supplier_id = supplier_id
        self.menu_item_id = menu_item_id
        self.cost_price = cost_price
        self.lead_days = lead_days

    def to_dict(self):
        return {
            "id": self.id,
            "supplier_id": self.supplier_id,
            "menu_item_id": self.menu_item_id,
            "menu_item_name": self.menu_item.name if self.menu_item else None,
            "cost_price": float(self.cost_price) if self.cost_price else None,
            "lead_days": self.lead_days
        }


# ---------------------------------------------------------------------------
# StockAuditLog — every stock movement logged
# ---------------------------------------------------------------------------
class StockAuditLog(db.Model):
    __tablename__ = 'stock_audit_logs'

    id = Column(Integer, primary_key=True)
    outlet_id = Column(Integer, ForeignKey('outlets.id', ondelete='SET NULL'), nullable=True)
    menu_item_id = Column(Integer, ForeignKey('menu_items.id', ondelete='SET NULL'), nullable=True)
    change_qty = Column(Integer, nullable=False)
    change_type = Column(String(30), nullable=False)  # 'sale', 'qr_arrival', 'manual', 'assign', 'return'
    stock_before = Column(Integer, nullable=True)
    stock_after = Column(Integer, nullable=True)
    reference_id = Column(Integer, nullable=True)
    performed_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    outlet = relationship('Outlet', foreign_keys=[outlet_id])
    menu_item = relationship('MenuItem', foreign_keys=[menu_item_id])
    user = relationship('User', foreign_keys=[performed_by])

    def __init__(self, change_qty, change_type, outlet_id=None, menu_item_id=None,
                 stock_before=None, stock_after=None, reference_id=None, performed_by=None, notes=None):
        self.outlet_id = outlet_id
        self.menu_item_id = menu_item_id
        self.change_qty = change_qty
        self.change_type = change_type
        self.stock_before = stock_before
        self.stock_after = stock_after
        self.reference_id = reference_id
        self.performed_by = performed_by
        self.notes = notes

    def to_dict(self):
        return {
            "id": self.id,
            "outlet_id": self.outlet_id,
            "outlet_name": self.outlet.name if self.outlet else None,
            "menu_item_id": self.menu_item_id,
            "menu_item_name": self.menu_item.name if self.menu_item else None,
            "change_qty": self.change_qty,
            "change_type": self.change_type,
            "stock_before": self.stock_before,
            "stock_after": self.stock_after,
            "reference_id": self.reference_id,
            "performed_by": self.performed_by,
            "performed_by_email": self.user.email if self.user else None,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


# ---------------------------------------------------------------------------
# ProductBatch — expiry / batch tracking per stock arrival
# ---------------------------------------------------------------------------
class ProductBatch(db.Model):
    __tablename__ = 'product_batches'

    id = Column(Integer, primary_key=True)
    outlet_stock_id = Column(Integer, ForeignKey('outlet_stocks.id', ondelete='CASCADE'), nullable=False)
    outlet_id = Column(Integer, ForeignKey('outlets.id', ondelete='CASCADE'), nullable=False)
    menu_item_id = Column(Integer, ForeignKey('menu_items.id', ondelete='CASCADE'), nullable=False)
    batch_number = Column(String(50), nullable=True)
    qty = Column(Integer, nullable=False, default=0)
    expiry_date = Column(Date, nullable=True)
    received_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    received_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)

    outlet_stock = relationship('OutletStock', backref='batches')
    outlet = relationship('Outlet', foreign_keys=[outlet_id])
    menu_item = relationship('MenuItem', foreign_keys=[menu_item_id])
    receiver = relationship('User', foreign_keys=[received_by])

    def __init__(self, outlet_stock_id, outlet_id, menu_item_id, qty, batch_number=None, expiry_date=None, received_by=None):
        self.outlet_stock_id = outlet_stock_id
        self.outlet_id = outlet_id
        self.menu_item_id = menu_item_id
        self.qty = qty
        self.batch_number = batch_number
        self.expiry_date = expiry_date
        self.received_by = received_by

    @property
    def is_expired(self):
        if not self.expiry_date:
            return False
        return self.expiry_date < datetime.now(timezone.utc).date()

    @property
    def days_to_expiry(self):
        if not self.expiry_date:
            return None
        delta = self.expiry_date - datetime.now(timezone.utc).date()
        return delta.days

    def to_dict(self):
        return {
            "id": self.id,
            "outlet_stock_id": self.outlet_stock_id,
            "outlet_id": self.outlet_id,
            "outlet_name": self.outlet.name if self.outlet else None,
            "menu_item_id": self.menu_item_id,
            "menu_item_name": self.menu_item.name if self.menu_item else None,
            "batch_number": self.batch_number,
            "qty": self.qty,
            "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
            "days_to_expiry": self.days_to_expiry,
            "is_expired": self.is_expired,
            "received_at": self.received_at.isoformat() if self.received_at else None,
            "received_by": self.received_by
        }


# ---------------------------------------------------------------------------
# Order — B2C home foods order
# ---------------------------------------------------------------------------
class Order(db.Model):
    __tablename__ = 'orders'

    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    status = Column(String(20), nullable=False, default='pending')
    total_price = Column(Numeric(10, 2), nullable=False, default=0.00)
    tracking_code = Column(String(100), nullable=True)
    is_received = Column(Boolean, default=False)
    cancel_reason = Column(String(255), nullable=True)
    delivery_address = Column(String(500), nullable=True)
    payment_method = Column(String(50), nullable=False, default='COD')
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    customer = relationship('User', backref='orders')
    items = relationship('OrderItem', backref='order', cascade="all, delete-orphan", lazy='joined')
    feedback = relationship('Feedback', backref='order', uselist=False, cascade="all, delete-orphan")

    def __init__(self, customer_id, total_price=0.00, status='pending', items=None, delivery_address=None, payment_method='COD'):
        self.customer_id = customer_id
        self.total_price = total_price
        self.status = status
        self.delivery_address = delivery_address
        self.payment_method = payment_method
        if items:
            self.items = items

    def to_dict(self):
        return {
            "id": self.id,
            "customer_id": self.customer_id,
            "customer_email": self.customer.email if self.customer else None,
            "status": self.status,
            "total_price": float(self.total_price),
            "tracking_code": self.tracking_code,
            "is_received": self.is_received,
            "cancel_reason": self.cancel_reason,
            "delivery_address": self.delivery_address,
            "payment_method": self.payment_method,
            "feedback_submitted": self.feedback is not None,
            "items": [item.to_dict() for item in self.items],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


# ---------------------------------------------------------------------------
# OrderItem
# ---------------------------------------------------------------------------
class OrderItem(db.Model):
    __tablename__ = 'order_items'

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey('orders.id', ondelete='CASCADE'), nullable=False)
    menu_item_id = Column(Integer, ForeignKey('menu_items.id'), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    price = Column(Numeric(10, 2), nullable=False)

    menu_item = relationship('MenuItem')

    def __init__(self, menu_item_id, price, quantity=1, order_id=None):
        self.menu_item_id = menu_item_id
        self.price = price
        self.quantity = quantity
        if order_id:
            self.order_id = order_id

    def to_dict(self):
        return {
            "id": self.id,
            "menu_item_id": self.menu_item_id,
            "menu_item_name": self.menu_item.name if self.menu_item else None,
            "quantity": self.quantity,
            "price": float(self.price)
        }


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------
class Feedback(db.Model):
    __tablename__ = 'feedbacks'

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey('orders.id', ondelete='CASCADE'), unique=True, nullable=False)
    customer_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    customer = relationship('User', backref='feedbacks')

    def __init__(self, order_id, customer_id, rating, comment=None):
        self.order_id = order_id
        self.customer_id = customer_id
        self.rating = rating
        self.comment = comment

    def to_dict(self):
        return {
            "id": self.id,
            "order_id": self.order_id,
            "customer_id": self.customer_id,
            "rating": self.rating,
            "comment": self.comment,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


# ---------------------------------------------------------------------------
# POSSale — B2B2C cashier sales at outlet
# ---------------------------------------------------------------------------
class POSSale(db.Model):
    __tablename__ = 'pos_sales'

    id = Column(Integer, primary_key=True)
    outlet_id = Column(Integer, ForeignKey('outlets.id', ondelete='CASCADE'), nullable=False)
    staff_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False)
    payment_method = Column(String(20), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    outlet = relationship('Outlet', backref='pos_sales')
    staff = relationship('User', backref='pos_sales')
    items = relationship('POSSaleItem', backref='sale', cascade="all, delete-orphan", lazy='joined')

    def __init__(self, outlet_id, staff_id, total_amount, payment_method, items=None):
        self.outlet_id = outlet_id
        self.staff_id = staff_id
        self.total_amount = total_amount
        self.payment_method = payment_method
        if items:
            self.items = items

    def to_dict(self):
        return {
            "id": self.id,
            "outlet_id": self.outlet_id,
            "outlet_name": self.outlet.name if self.outlet else None,
            "staff_id": self.staff_id,
            "staff_email": self.staff.email if self.staff else None,
            "total_amount": float(self.total_amount),
            "payment_method": self.payment_method,
            "items": [item.to_dict() for item in self.items],
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


# ---------------------------------------------------------------------------
# POSSaleItem
# ---------------------------------------------------------------------------
class POSSaleItem(db.Model):
    __tablename__ = 'pos_sale_items'

    id = Column(Integer, primary_key=True)
    sale_id = Column(Integer, ForeignKey('pos_sales.id', ondelete='CASCADE'), nullable=False)
    menu_item_id = Column(Integer, ForeignKey('menu_items.id'), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    price = Column(Numeric(10, 2), nullable=False)

    menu_item = relationship('MenuItem')

    def __init__(self, menu_item_id, price, quantity=1, sale_id=None):
        self.menu_item_id = menu_item_id
        self.price = price
        self.quantity = quantity
        if sale_id:
            self.sale_id = sale_id

    def to_dict(self):
        return {
            "id": self.id,
            "menu_item_id": self.menu_item_id,
            "menu_item_name": self.menu_item.name if self.menu_item else None,
            "quantity": self.quantity,
            "price": float(self.price)
        }
