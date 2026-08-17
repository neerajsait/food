import React from "react";
import { ShoppingCart, Heart, User, Search, Bell } from "lucide-react";

export default function Header({ activeTab, setActiveTab, cartCount, searchQuery, setSearchQuery, onOpenCart }) {
  return (
    <header className="site-header">
      {/* Brand removed (now only in sidebar) */}

      {/* Search */}
      <div className="header-search">
        <Search size={16} className="header-search-icon" />
        <input
          type="text"
          placeholder="Search pickles, snacks, biscuits…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onFocus={() => setActiveTab("shop")}
        />
      </div>

      {/* Actions */}
      <div className="header-actions">
        <button
          className={`header-action-btn${activeTab === "checkout" || activeTab === "cart" ? " active" : ""}`}
          onClick={onOpenCart}
          title="Cart"
          aria-label={`Cart – ${cartCount} items`}
        >
          <ShoppingCart size={20} />
          {cartCount > 0 && <span className="action-badge">{cartCount > 9 ? "9+" : cartCount}</span>}
        </button>
      </div>
    </header>
  );
}

export function MobileHeader({ searchQuery, setSearchQuery, cartCount, setActiveTab, onOpenCart }) {
  return (
    <div className="mobile-header">
      <div className="mobile-header-top">
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div className="header-brand-logo">S</div>
          <div>
            <div className="header-brand-name" style={{ fontSize: "0.9rem" }}>Suggula's Kitchen</div>
          </div>
        </div>

        {/* Right icons */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <button
            className="header-action-btn"
            onClick={onOpenCart}
            aria-label={`Cart – ${cartCount} items`}
          >
            <ShoppingCart size={20} />
            {cartCount > 0 && <span className="action-badge">{cartCount > 9 ? "9+" : cartCount}</span>}
          </button>
        </div>
      </div>

      <div className="mobile-header-search">
        <Search size={15} className="header-search-icon" />
        <input
          type="text"
          placeholder="Search pickles, snacks, biscuits…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onFocus={() => setActiveTab("shop")}
        />
      </div>
    </div>
  );
}
