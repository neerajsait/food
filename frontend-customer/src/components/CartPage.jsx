import React from "react";
import { Trash2, ShoppingBag, Tag, Truck } from "lucide-react";

const FALLBACK = "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=200&q=70";

function DeliveryProgress({ cartTotal }) {
  const FREE_THRESHOLD = 499;
  const remaining = Math.max(0, FREE_THRESHOLD - cartTotal);
  const pct = Math.min(100, (cartTotal / FREE_THRESHOLD) * 100);
  return (
    <div style={{ background: "var(--bg)", borderRadius: "var(--radius-md)", padding: "0.875rem 1rem", marginBottom: "1rem" }}>
      {remaining > 0 ? (
        <p style={{ fontSize: "0.8125rem", color: "var(--text-2)", marginBottom: "0.5rem" }}>
          <Truck size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
          Add <strong style={{ color: "var(--text)" }}>₹{remaining.toFixed(0)}</strong> more for free delivery
        </p>
      ) : (
        <p style={{ fontSize: "0.8125rem", color: "var(--green)", marginBottom: "0.5rem", fontWeight: 700 }}>
          🎉 You've unlocked free delivery!
        </p>
      )}
      <div className="delivery-progress">
        <div className="delivery-progress-bar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function CartPage({
  menu, cart, addresses, selectedAddressId, onAdd, onRemove, onClearItem,
  couponCodeInput, setCouponCodeInput, appliedCoupon, onApplyCoupon, onRemoveCoupon,
  couponError, activeCoupons, useLoyaltyPoints, setUseLoyaltyPoints,
  loyaltyPoints, maxLoyaltyDiscount, finalSubtotal, deliveryCharge, finalTotal,
  discountAmount, actualLoyaltyDiscount, storeSettings, onCheckout, checkoutBanners
}) {
  const cartItems = Object.entries(cart)
    .map(([id, qty]) => {
      const item = menu.find(m => m.id === parseInt(id));
      return item ? { ...item, qty } : null;
    })
    .filter(Boolean);

  if (cartItems.length === 0) {
    return (
      <div className="page-content">
        <div className="empty-state" style={{ minHeight: "50vh" }}>
          <div className="empty-state-icon" style={{ fontSize: "2.5rem" }}>🛒</div>
          <h3>Your cart is empty</h3>
          <p>Looks like you haven't added anything yet. Start shopping and fill it up!</p>
        </div>
      </div>
    );
  }

  const cartTotal = Object.entries(cart).reduce((s, [id, qty]) => {
    const item = menu.find(m => m.id === parseInt(id));
    return s + (item ? item.price * qty : 0);
  }, 0);

  return (
    <div className="page-content">
      <h1 style={{ fontSize: "1.5rem", fontWeight: 900, marginBottom: "1.5rem", color: "var(--text)" }}>Your Cart</h1>

      <div className="cart-layout">
        {/* Items */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {cartItems.map(item => (
            <div key={item.id} className="cart-item">
              <img
                className="cart-item-img"
                src={item.image_url || FALLBACK}
                alt={item.name}
                onError={e => { e.target.src = FALLBACK; }}
              />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text)" }}>{item.name}</div>
                <div style={{ fontSize: "0.8125rem", color: "var(--text-2)" }}>{item.category}</div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text)" }}>₹{(item.price * item.qty).toFixed(2)}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.625rem" }}>
                <div className="product-card-qty" style={{ width: "auto", border: "1.5px solid var(--border)", borderRadius: "var(--radius-pill)" }}>
                  <button className="product-card-qty-btn" onClick={() => onRemove(item.id)}>−</button>
                  <span className="product-card-qty-val" style={{ minWidth: 28, color: "var(--text)" }}>{item.qty}</span>
                  <button className="product-card-qty-btn" onClick={() => onAdd(item.id)}>+</button>
                </div>
                <button
                  onClick={() => onClearItem(item.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 0, display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", transition: "color var(--t-fast)" }}
                  onMouseEnter={e => e.currentTarget.style.color = "var(--error)"}
                  onMouseLeave={e => e.currentTarget.style.color = "var(--text-3)"}
                >
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="order-summary-card">
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "1rem", color: "var(--text)" }}>Order Summary</h2>

          <DeliveryProgress cartTotal={cartTotal} />

          {/* Coupon */}
          <div style={{ marginBottom: "1rem" }}>
            {appliedCoupon ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--success-bg)", border: "1px solid rgba(21,148,71,0.2)", borderRadius: "var(--radius-md)", padding: "0.625rem 0.875rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: "var(--green)", fontWeight: 700 }}>
                  <Tag size={14} />
                  {appliedCoupon.code} ({appliedCoupon.discount_pct}% off)
                </div>
                <button onClick={onRemoveCoupon} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: "0.75rem" }}>Remove</button>
              </div>
            ) : (
              <div className="coupon-row">
                <input
                  className="form-input"
                  placeholder="Coupon code"
                  value={couponCodeInput}
                  onChange={e => setCouponCodeInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && onApplyCoupon()}
                  style={{ fontSize: "0.875rem", padding: "0.625rem 0.875rem", minHeight: 40 }}
                />
                <button className="btn btn-outline btn-sm" onClick={() => onApplyCoupon()} style={{ flexShrink: 0, minHeight: 40, borderRadius: "var(--radius-md)" }}>Apply</button>
              </div>
            )}
            {couponError && <p style={{ fontSize: "0.75rem", color: "var(--error)", marginTop: "0.375rem" }}>{couponError}</p>}

            {/* Quick coupons */}
            {!appliedCoupon && activeCoupons.length > 0 && (
              <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                {activeCoupons.slice(0, 3).map(c => (
                  <button key={c.id} onClick={() => onApplyCoupon(c.code)}
                    style={{ fontSize: "0.7rem", padding: "0.2rem 0.6rem", borderRadius: "var(--radius-pill)", border: "1px dashed var(--green)", background: "transparent", color: "var(--green)", cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>
                    {c.code}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Loyalty points */}
          {loyaltyPoints > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", cursor: "pointer", fontSize: "0.875rem" }}>
                <input type="checkbox" checked={useLoyaltyPoints} onChange={e => setUseLoyaltyPoints(e.target.checked)} style={{ accentColor: "var(--green)", width: 16, height: 16 }} />
                <span>
                  Use <strong>{loyaltyPoints} loyalty points</strong>
                  <span style={{ color: "var(--text-3)", fontSize: "0.75rem" }}> (saves ₹{maxLoyaltyDiscount.toFixed(2)})</span>
                </span>
              </label>
            </div>
          )}

          {/* Totals */}
          <div>
            <div className="summary-row">
              <span style={{ color: "var(--text-2)" }}>Subtotal</span>
              <span style={{ fontWeight: 600 }}>₹{cartTotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="summary-row">
                <span style={{ color: "var(--green)" }}>Coupon discount</span>
                <span style={{ color: "var(--green)", fontWeight: 600 }}>−₹{discountAmount.toFixed(2)}</span>
              </div>
            )}
            {actualLoyaltyDiscount > 0 && (
              <div className="summary-row">
                <span style={{ color: "var(--green)" }}>Loyalty points</span>
                <span style={{ color: "var(--green)", fontWeight: 600 }}>−₹{actualLoyaltyDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="summary-row">
              <span style={{ color: "var(--text-2)" }}>Delivery</span>
              <span style={{ fontWeight: 600, color: deliveryCharge === 0 ? "var(--green)" : "var(--text)" }}>
                {deliveryCharge === 0 ? "FREE" : `₹${deliveryCharge.toFixed(2)}`}
              </span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>₹{finalTotal.toFixed(2)}</span>
            </div>
          </div>

          <button
            className="btn btn-primary btn-full"
            style={{ marginTop: "1.25rem", minHeight: 52, fontSize: "1rem" }}
            onClick={onCheckout}
          >
            <ShoppingBag size={20} />
            Proceed to Checkout
          </button>

          <p style={{ fontSize: "0.75rem", color: "var(--text-3)", textAlign: "center", marginTop: "0.75rem" }}>
            🔒 Safe & Secure Checkout
          </p>
        </div>
      </div>
    </div>
  );
}
