import React, { useState, useMemo } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import ProductCard from "./ProductCard";
import { ProductGridSkeleton } from "./SkeletonLoader";

const CATEGORIES = [
  { id: "all",               label: "All" },
  { id: "favs",              label: "My Faves ❤️" },
  { id: "Pickles",           label: "Pickles 🫙" },
  { id: "Spice Powders",     label: "Spice Powders 🌶" },
  { id: "Snacks & Savories", label: "Snacks 🍿" },
  { id: "Sweets & Treats",   label: "Sweets 🍯" },
  { id: "Mixes & Instant",   label: "Mixes 🥣" },
  { id: "Special Products",  label: "Specials ⭐" },
];

const SORT_OPTIONS = [
  { value: "default",    label: "Default" },
  { value: "price_asc",  label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "rating",     label: "Best Rated" },
  { value: "discount",   label: "Biggest Discount" },
];

function FilterSidebar({ activeCategory, setActiveCategory, sortBy, setSortBy, priceMax, setPriceMax, showOnlyVeg, setShowOnlyVeg, spiceFilter, setSpiceFilter, onReset, count, total }) {
  return (
    <div className="filter-sidebar">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h3 style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--text)", margin: 0, letterSpacing: "-0.5px" }}>Filters</h3>
        <button onClick={onReset} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.8125rem", color: "var(--text-3)", textDecoration: "underline", fontWeight: 500, padding: 0 }}>Clear all</button>
      </div>

      <div className="filter-group">
        <div className="filter-group-title">Categories</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`category-item${activeCategory === cat.id ? " active" : ""}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <span style={{ flex: 1 }}>{cat.label}</span>
              {activeCategory === cat.id && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)" }} />}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-group-title">Sort By</div>
        <div style={{ position: "relative" }}>
          <select
            className="form-input"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{ fontSize: "0.875rem", padding: "0.75rem 1rem", borderRadius: "var(--radius-md)", background: "var(--bg-card)", border: "1px solid var(--border)", width: "100%", cursor: "pointer", appearance: "none" }}
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-3)" }}>
            ▼
          </div>
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-group-title" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Max Price</span>
          <span style={{ color: "var(--text)", fontWeight: 700 }}>₹{priceMax}</span>
        </div>
        <input 
          type="range" min={0} max={1000} step={50} value={priceMax}
          onChange={e => setPriceMax(Number(e.target.value))}
          className="price-slider"
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-3)", marginTop: "0.5rem" }}>
          <span>₹0</span><span>₹1000</span>
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-group-title">Spice Level</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {["all", "mild", "medium", "hot"].map(s => (
            <button key={s} className={`filter-chip${spiceFilter === s ? " active" : ""}`} onClick={() => setSpiceFilter(s)}>
              {s === "all" ? "Any" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ShopPage({ menu, cart, favorites, loading, activeCategory, setActiveCategory, searchQuery, onAdd, onRemove, onToggleFav, onItemClick }) {
  const [sortBy, setSortBy] = useState("default");
  const [priceMax, setPriceMax] = useState(1000);
  const [showOnlyVeg, setShowOnlyVeg] = useState(false);
  const [spiceFilter, setSpiceFilter] = useState("all");
  const [showMobileFilter, setShowMobileFilter] = useState(false);

  const handleReset = () => {
    setSortBy("default");
    setPriceMax(1000);
    setShowOnlyVeg(false);
    setSpiceFilter("all");
    setActiveCategory("all");
  };

  const filtered = useMemo(() => {
    let result = menu.filter(item => {
      if (activeCategory === "favs") return favorites.includes(item.id);
      if (activeCategory !== "all" && item.category !== activeCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!item.name.toLowerCase().includes(q) && !(item.description || "").toLowerCase().includes(q)) return false;
      }
      if (item.price > priceMax) return false;
      if (showOnlyVeg && !item.is_veg) return false;
      if (spiceFilter !== "all" && item.spice_level !== spiceFilter) return false;
      return true;
    });

    switch (sortBy) {
      case "price_asc":  result = [...result].sort((a, b) => a.price - b.price); break;
      case "price_desc": result = [...result].sort((a, b) => b.price - a.price); break;
      case "rating":     result = [...result].sort((a, b) => (parseFloat(b.average_rating) || 0) - (parseFloat(a.average_rating) || 0)); break;
      case "discount":   result = [...result].sort((a, b) => {
        const da = a.original_price ? ((a.original_price - a.price) / a.original_price) : 0;
        const db = b.original_price ? ((b.original_price - b.price) / b.original_price) : 0;
        return db - da;
      }); break;
    }
    return result;
  }, [menu, activeCategory, favorites, searchQuery, priceMax, showOnlyVeg, spiceFilter, sortBy]);

  return (
    <div className="page-content">
      {/* Mobile filter toggle */}
      <div className="mobile-only" style={{ marginBottom: "1rem" }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowMobileFilter(true)}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <SlidersHorizontal size={15} /> Filters & Sort
        </button>
      </div>

      {/* Mobile filter drawer */}
      {showMobileFilter && (
        <div className="modal-overlay" onClick={() => setShowMobileFilter(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <span style={{ fontWeight: 800, fontSize: "1rem" }}>Filters</span>
              <button onClick={() => setShowMobileFilter(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-2)" }}><X size={20} /></button>
            </div>
            <FilterSidebar
              activeCategory={activeCategory} setActiveCategory={cat => { setActiveCategory(cat); setShowMobileFilter(false); }}
              sortBy={sortBy} setSortBy={setSortBy}
              priceMax={priceMax} setPriceMax={setPriceMax}
              showOnlyVeg={showOnlyVeg} setShowOnlyVeg={setShowOnlyVeg}
              spiceFilter={spiceFilter} setSpiceFilter={setSpiceFilter}
              onReset={handleReset}
              count={filtered.length} total={menu.length}
            />
          </div>
        </div>
      )}

      <div className="shop-layout">
        {/* Desktop filter */}
        <div className="desktop-only">
          <FilterSidebar
            activeCategory={activeCategory} setActiveCategory={setActiveCategory}
            sortBy={sortBy} setSortBy={setSortBy}
            priceMax={priceMax} setPriceMax={setPriceMax}
            showOnlyVeg={showOnlyVeg} setShowOnlyVeg={setShowOnlyVeg}
            spiceFilter={spiceFilter} setSpiceFilter={setSpiceFilter}
            onReset={handleReset}
            count={filtered.length} total={menu.length}
          />
        </div>

        {/* Product grid */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div>
              <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text)" }}>
                {activeCategory === "all" ? "All Products" : activeCategory}
              </h1>
              {searchQuery && <p style={{ fontSize: "0.8125rem", color: "var(--text-2)", marginTop: "0.25rem" }}>Results for "{searchQuery}"</p>}
            </div>
            {/* Desktop sort */}
            <select className="form-input desktop-only" value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{ width: "auto", fontSize: "0.8125rem", padding: "0.4rem 2rem 0.4rem 0.75rem", minHeight: 36 }}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {loading && menu.length === 0 && <ProductGridSkeleton count={8} />}

          {!loading && filtered.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <h3>No products found</h3>
              <p>Try adjusting your filters or search query</p>
              <button className="btn btn-outline" onClick={handleReset} style={{ marginTop: "0.5rem" }}>Reset Filters</button>
            </div>
          )}

          <div className="product-grid">
            {filtered.map(item => (
              <ProductCard
                key={item.id}
                item={item}
                cartQty={cart[item.id] || 0}
                isFav={favorites.includes(item.id)}
                onAdd={onAdd}
                onRemove={onRemove}
                onToggleFav={onToggleFav}
                onClick={() => onItemClick(item)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
