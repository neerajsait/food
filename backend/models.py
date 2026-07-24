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
    revenue_share_percentage = Column(Numeric(5, 2), nullable=True, default=0.00)
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
            "revenue_share_percentage": float(self.revenue_share_percentage) if self.revenue_share_percentage is not None else 0.0,
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
    
    __mapper_args__ = {
        'polymorphic_on': role,
        'polymorphic_identity': 'user'
    }

    first_name = Column(String(50), nullable=True)
    last_name = Column(String(50), nullable=True)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    password_reset_token = Column(String(255), nullable=True)
    password_reset_expiry = Column(DateTime, nullable=True)
    is_first_login = Column(Boolean, default=False, nullable=False)
    address = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # --- New Security & Admin Fields ---
    is_banned = Column(Boolean, default=False, nullable=False)
    ban_reason = Column(Text, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    is_email_verified = Column(Boolean, default=False, nullable=False)
    emergency_contact = Column(String(255), nullable=True)
    is_superadmin = Column(Boolean, default=False, nullable=False)
    admin_department = Column(String(50), nullable=True)

    # --- STI Subclass Fields ---
    loyalty_points = Column(Integer, default=0, nullable=False)
    outlet_id = Column(Integer, ForeignKey('outlets.id', ondelete='SET NULL'), nullable=True)
    pin_hash = Column(String(255), nullable=True)

    outlet = relationship('Outlet', foreign_keys=[outlet_id], backref='staff')

    def __init__(self, email, role='customer', first_name=None, last_name=None, phone=None, address=None):
        self.email = email
        self.role = role
        self.first_name = first_name
        self.last_name = last_name
        self.phone = phone
        self.address = address
        self.is_first_login = False

    def set_password(self, password: str, bcrypt):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password: str, bcrypt) -> bool:
        return bcrypt.check_password_hash(self.password_hash, password)

    def to_dict(self):
        d = {
            "id": self.id,
            "email": self.email,
            "role": self.role,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "phone": self.phone,
            "address": self.address,
            "is_active": self.is_active,
            "is_first_login": self.is_first_login,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "is_banned": self.is_banned,
            "ban_reason": self.ban_reason,
            "is_email_verified": self.is_email_verified,
            "emergency_contact": self.emergency_contact,
            "is_superadmin": self.is_superadmin,
            "admin_department": self.admin_department,
            "deleted_at": self.deleted_at.isoformat() if getattr(self, "deleted_at", None) else None
        }
        if hasattr(self, 'outlet_id'):
            d["outlet_id"] = self.outlet_id
            d["outlet_name"] = self.outlet.name if getattr(self, 'outlet', None) else None
        if hasattr(self, 'pin_hash'):
            d["has_pin"] = self.pin_hash is not None
        if hasattr(self, 'loyalty_points'):
            d["loyalty_points"] = self.loyalty_points or 0
        return d


class Customer(User):
    __mapper_args__ = { 'polymorphic_identity': 'customer' }
    
    def __init__(self, email, first_name=None, last_name=None, phone=None, address=None):
        super().__init__(email=email, role='customer', first_name=first_name, last_name=last_name, phone=phone, address=address)
        self.loyalty_points = 0


class Staff(User):
    __mapper_args__ = { 'polymorphic_identity': 'staff' }
    
    def __init__(self, email, first_name=None, last_name=None, phone=None, outlet_id=None, address=None):
        super().__init__(email=email, role='staff', first_name=first_name, last_name=last_name, phone=phone, address=address)
        self.outlet_id = outlet_id
    
    def set_pin(self, pin: str, bcrypt):
        self.pin_hash = bcrypt.generate_password_hash(pin).decode('utf-8')

    def check_pin(self, pin: str, bcrypt) -> bool:
        if not self.pin_hash:
            return False
        return bcrypt.check_password_hash(self.pin_hash, pin)


class Admin(User):
    __mapper_args__ = { 'polymorphic_identity': 'admin' }
    def __init__(self, email, first_name=None, last_name=None, phone=None, address=None):
        super().__init__(email=email, role='admin', first_name=first_name, last_name=last_name, phone=phone, address=address)


class OutletOwner(User):
    __mapper_args__ = { 'polymorphic_identity': 'outlet_owner' }
    def __init__(self, email, first_name=None, last_name=None, phone=None, outlet_id=None, address=None):
        super().__init__(email=email, role='outlet_owner', first_name=first_name, last_name=last_name, phone=phone, address=address)
        self.outlet_id = outlet_id

class KitchenStaff(User):
    __mapper_args__ = { 'polymorphic_identity': 'kitchen' }
    def __init__(self, email, first_name=None, last_name=None, phone=None, outlet_id=None, address=None):
        super().__init__(email=email, role='kitchen', first_name=first_name, last_name=last_name, phone=phone, address=address)
        self.outlet_id = outlet_id  # Can be None if central kitchen
        
    def set_pin(self, pin: str, bcrypt):
        self.pin_hash = bcrypt.generate_password_hash(pin).decode('utf-8')

    def check_pin(self, pin: str, bcrypt) -> bool:
        if not self.pin_hash:
            return False
        return bcrypt.check_password_hash(self.pin_hash, pin)



# ---------------------------------------------------------------------------
# MenuItem — global food catalog
# ---------------------------------------------------------------------------
class MenuItem(db.Model):
    __tablename__ = 'menu_items'

    id = Column(Integer, primary_key=True)
    code = Column(String(20), unique=True, nullable=True)  # auto-generated 4-digit product code
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    business_type = Column(String(20), nullable=False)  # 'home_foods', 'snack_supply', 'both'
    category = Column(String(50), nullable=True)
    image_url = Column(String(255), nullable=True)
    global_stock = Column(Integer, nullable=True)  # None = unlimited
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def __init__(self, name, price, business_type, code=None, description=None, category=None, image_url=None, global_stock=None, is_active=True):
        self.code = code
        self.name = name
        self.price = price
        self.business_type = business_type
        self.description = description
        self.category = category
        self.image_url = image_url
        self.global_stock = global_stock
        self.is_active = is_active

    @property
    def average_rating(self):
        if not self.reviews:
            return 0.0
        return round(sum(r.rating for r in self.reviews) / len(self.reviews), 1)

    @property
    def reviews_count(self):
        return len(self.reviews)

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "description": self.description,
            "price": float(self.price),
            "business_type": self.business_type,
            "category": self.category,
            "image_url": self.image_url,
            "global_stock": self.global_stock,
            "is_active": self.is_active,
            "average_rating": self.average_rating,
            "reviews_count": self.reviews_count
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
    order_type = Column(String(20), nullable=False, default='online') # 'online' or 'pos'
    customer_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=True) # Nullable for guest POS sales
    outlet_id = Column(Integer, ForeignKey('outlets.id', ondelete='SET NULL'), nullable=True)
    staff_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    
    status = Column(String(20), nullable=False, default='pending')
    total_price = Column(Numeric(10, 2), nullable=False, default=0.00)
    tracking_code = Column(String(100), nullable=True)
    tracking_label = Column(Text, nullable=True)
    tracking_link = Column(String(500), nullable=True)  # 3rd party tracking URL
    is_received = Column(Boolean, default=False)
    cancel_reason = Column(String(255), nullable=True)
    delivery_address = Column(String(500), nullable=True)
    payment_method = Column(String(50), nullable=False, default='COD')
    loyalty_points_earned = Column(Integer, default=0, nullable=False)
    loyalty_points_redeemed = Column(Integer, default=0, nullable=False)
    applied_coupon_code = Column(String(50), nullable=True)
    qr_code_base64 = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    customer = relationship('User', foreign_keys=[customer_id], backref='orders')
    outlet = relationship('Outlet', backref='orders')
    staff = relationship('User', foreign_keys=[staff_id], backref='staff_orders')
    items = relationship('OrderItem', backref='order', cascade="all, delete-orphan", lazy='joined')

    def __init__(self, total_price=0.00, status='pending', items=None, payment_method='COD', 
                 order_type='online', customer_id=None, outlet_id=None, staff_id=None, delivery_address=None,
                 loyalty_points_earned=0, loyalty_points_redeemed=0, applied_coupon_code=None):
        self.order_type = order_type
        self.customer_id = customer_id
        self.outlet_id = outlet_id
        self.staff_id = staff_id
        self.total_price = total_price
        self.status = status
        self.delivery_address = delivery_address
        self.payment_method = payment_method
        self.loyalty_points_earned = loyalty_points_earned
        self.loyalty_points_redeemed = loyalty_points_redeemed
        self.applied_coupon_code = applied_coupon_code
        if items:
            self.items = items

    def to_dict(self):
        d = {
            "id": self.id,
            "order_type": self.order_type,
            "customer_id": self.customer_id,
            "customer_email": self.customer.email if self.customer else None,
            "outlet_id": self.outlet_id,
            "outlet_name": self.outlet.name if self.outlet else None,
            "staff_id": self.staff_id,
            "staff_email": self.staff.email if self.staff else None,
            "status": self.status,
            "total_price": float(self.total_price),
            "payment_method": self.payment_method,
            "loyalty_points_earned": self.loyalty_points_earned,
            "loyalty_points_redeemed": self.loyalty_points_redeemed,
            "qr_code_base64": self.qr_code_base64,
            "items": [item.to_dict() for item in self.items],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        if self.order_type == 'online':
            d.update({
                "tracking_code": self.tracking_code,
                "tracking_label": self.tracking_label,
                "tracking_link": self.tracking_link,
                "is_received": self.is_received,
                "cancel_reason": self.cancel_reason,
                "delivery_address": self.delivery_address,
                "feedback_submitted": self.review is not None
            })
        return d


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
# Review — Consolidated feedback and menu item reviews
# ---------------------------------------------------------------------------
class Review(db.Model):
    __tablename__ = 'reviews'

    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    order_id = Column(Integer, ForeignKey('orders.id', ondelete='CASCADE'), nullable=True)
    menu_item_id = Column(Integer, ForeignKey('menu_items.id', ondelete='CASCADE'), nullable=True)
    
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    is_hidden = Column(Boolean, default=False)
    admin_reply = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    customer = relationship('User', backref='reviews')
    order = relationship('Order', backref=db.backref('review', uselist=False))
    menu_item = relationship('MenuItem', backref='reviews')

    def __init__(self, customer_id, rating, comment=None, order_id=None, menu_item_id=None, is_hidden=False, admin_reply=None):
        self.customer_id = customer_id
        self.rating = rating
        self.comment = comment
        self.order_id = order_id
        self.menu_item_id = menu_item_id
        self.is_hidden = is_hidden
        self.admin_reply = admin_reply

    def to_dict(self):
        return {
            "id": self.id,
            "customer_id": self.customer_id,
            "customer_name": f"{self.customer.first_name or ''} {self.customer.last_name or ''}".strip() or self.customer.email,
            "order_id": self.order_id,
            "menu_item_id": self.menu_item_id,
            "menu_item_name": self.menu_item.name if self.menu_item else None,
            "rating": self.rating,
            "comment": self.comment,
            "is_hidden": self.is_hidden,
            "admin_reply": self.admin_reply,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


# ---------------------------------------------------------------------------
# Coupon — B2C & POS Discount Coupon
# ---------------------------------------------------------------------------
class Coupon(db.Model):
    __tablename__ = 'coupons'

    id = Column(Integer, primary_key=True)
    code = Column(String(50), unique=True, nullable=False)
    discount_pct = Column(Integer, nullable=False)
    expiry_date = Column(Date, nullable=True)
    usage_limit = Column(Integer, nullable=True)
    usage_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def __init__(self, code, discount_pct, expiry_date=None, usage_limit=None, is_active=True):
        self.code = code.upper().strip()
        self.discount_pct = int(discount_pct)
        self.expiry_date = expiry_date
        self.usage_limit = usage_limit
        self.usage_count = 0
        self.is_active = is_active

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "discount_pct": self.discount_pct,
            "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
            "usage_limit": self.usage_limit,
            "usage_count": self.usage_count,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


# ---------------------------------------------------------------------------
# StaffShift — clock-in / clock-out attendance tracking
# ---------------------------------------------------------------------------
class StaffShift(db.Model):
    __tablename__ = 'staff_shifts'

    id = Column(Integer, primary_key=True)
    staff_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    outlet_id = Column(Integer, ForeignKey('outlets.id', ondelete='CASCADE'), nullable=False)
    clock_in_time = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    clock_out_time = Column(DateTime, nullable=True)
    # Expected cash = sum of all cash POS sales during this shift
    expected_cash = Column(Numeric(10, 2), nullable=True)
    # Actual cash counted by the staff at shift end
    actual_cash = Column(Numeric(10, 2), nullable=True)
    # cash_discrepancy = actual_cash - expected_cash (negative = short)
    cash_discrepancy = Column(Numeric(10, 2), nullable=True)
    status = Column(String(20), nullable=False, default='active')  # 'active', 'closed'
    notes = Column(Text, nullable=True)

    staff = relationship('User', foreign_keys=[staff_id], backref='shifts')
    outlet = relationship('Outlet', foreign_keys=[outlet_id], backref='shifts')

    def __init__(self, staff_id, outlet_id):
        self.staff_id = staff_id
        self.outlet_id = outlet_id
        self.status = 'active'
        self.clock_in_time = datetime.now(timezone.utc)

    @property
    def duration_hours(self):
        if not self.clock_out_time:
            return None
        end = self.clock_out_time
        start = self.clock_in_time
        # Ensure both are offset-aware for comparison
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        delta = end - start
        return round(delta.total_seconds() / 3600, 2)

    def close_shift(self, actual_cash, expected_cash):
        self.clock_out_time = datetime.now(timezone.utc)
        self.actual_cash = actual_cash
        self.expected_cash = expected_cash
        self.cash_discrepancy = float(actual_cash) - float(expected_cash)
        self.status = 'closed'

    def to_dict(self):
        return {
            "id": self.id,
            "staff_id": self.staff_id,
            "staff_email": self.staff.email if self.staff else None,
            "staff_name": f"{self.staff.first_name or ''} {self.staff.last_name or ''}".strip() if self.staff else None,
            "outlet_id": self.outlet_id,
            "outlet_name": self.outlet.name if self.outlet else None,
            "clock_in_time": self.clock_in_time.isoformat() if self.clock_in_time else None,
            "clock_out_time": self.clock_out_time.isoformat() if self.clock_out_time else None,
            "duration_hours": self.duration_hours,
            "expected_cash": float(self.expected_cash) if self.expected_cash is not None else None,
            "actual_cash": float(self.actual_cash) if self.actual_cash is not None else None,
            "cash_discrepancy": float(self.cash_discrepancy) if self.cash_discrepancy is not None else None,
            "status": self.status,
            "notes": self.notes
        }

# ---------------------------------------------------------------------------
# AdminAuditLog — every admin action logged
# ---------------------------------------------------------------------------
class AdminAuditLog(db.Model):
    __tablename__ = 'admin_audit_logs'

    id = Column(Integer, primary_key=True)
    admin_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    action = Column(String(255), nullable=False)
    target_entity = Column(String(100), nullable=True)
    target_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    admin = relationship('User', foreign_keys=[admin_id])

    def __init__(self, admin_id, action, target_entity=None, target_id=None, details=None):
        self.admin_id = admin_id
        self.action = action
        self.target_entity = target_entity
        self.target_id = target_id
        self.details = details

    def to_dict(self):
        return {
            "id": self.id,
            "admin_id": self.admin_id,
            "admin_email": self.admin.email if self.admin else None,
            "action": self.action,
            "target_entity": self.target_entity,
            "target_id": self.target_id,
            "details": self.details,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

# ---------------------------------------------------------------------------
# Address — User address book
# ---------------------------------------------------------------------------
class Address(db.Model):
    __tablename__ = 'addresses'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    title = Column(String(50), nullable=False)
    address_line = Column(String(500), nullable=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship('User', backref=db.backref('address_book', cascade='all, delete-orphan'))

    def __init__(self, user_id, title, address_line, is_default=False):
        self.user_id = user_id
        self.title = title
        self.address_line = address_line
        self.is_default = is_default

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "address_line": self.address_line,
            "is_default": self.is_default,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

# ---------------------------------------------------------------------------
# Favorite — Saved menu items
# ---------------------------------------------------------------------------
class Favorite(db.Model):
    __tablename__ = 'favorites'
    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    menu_item_id = Column(Integer, ForeignKey('menu_items.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    customer = relationship('User', backref=db.backref('saved_favorites', cascade='all, delete-orphan'))
    menu_item = relationship('MenuItem')

    def __init__(self, customer_id, menu_item_id):
        self.customer_id = customer_id
        self.menu_item_id = menu_item_id

    def to_dict(self):
        return {
            "id": self.id,
            "customer_id": self.customer_id,
            "menu_item_id": self.menu_item_id,
            "menu_item": self.menu_item.to_dict() if self.menu_item else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

# ---------------------------------------------------------------------------
# ProductionBatch — Central kitchen production tracking
# ---------------------------------------------------------------------------
class ProductionBatch(db.Model):
    __tablename__ = 'production_batches'
    id = Column(Integer, primary_key=True)
    menu_item_id = Column(Integer, ForeignKey('menu_items.id', ondelete='CASCADE'), nullable=False)
    batch_number = Column(String(50), unique=True, nullable=False)
    quantity_produced = Column(Integer, nullable=False)
    mfg_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expiry_date = Column(Date, nullable=False)
    produced_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    status = Column(String(20), default='produced') # 'produced', 'dispatched'
    qr_code_base64 = Column(Text, nullable=True)

    menu_item = relationship('MenuItem')
    producer = relationship('User', foreign_keys=[produced_by])

    def __init__(self, menu_item_id, batch_number, quantity_produced, expiry_date, produced_by=None, qr_code_base64=None):
        self.menu_item_id = menu_item_id
        self.batch_number = batch_number
        self.quantity_produced = quantity_produced
        self.expiry_date = expiry_date
        self.produced_by = produced_by
        self.qr_code_base64 = qr_code_base64

    def to_dict(self):
        return {
            "id": self.id,
            "menu_item_id": self.menu_item_id,
            "menu_item_name": self.menu_item.name if self.menu_item else None,
            "batch_number": self.batch_number,
            "quantity_produced": self.quantity_produced,
            "mfg_date": self.mfg_date.isoformat() if self.mfg_date else None,
            "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
            "produced_by": self.produced_by,
            "producer_email": self.producer.email if self.producer else None,
            "status": self.status,
            "has_qr": bool(self.qr_code_base64)
        }
