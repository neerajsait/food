import React from "react";
import { Home, ShoppingBag, Search, ShoppingCart, User } from "lucide-react";

const NAV = [
  { id: "home",     icon: Home,         label: "Home" },
  { id: "shop",     icon: ShoppingBag,  label: "Shop" },
  { id: "search",   icon: Search,       label: "Search" },
  { id: "cart",     icon: ShoppingCart, label: "Cart" },
  { id: "profile",  icon: User,         label: "Profile" },
];

export default function BottomNav({ activeTab, setActiveTab, cartCount, onOpenCart }) {
  const handleTap = (id) => {
    if (id === "cart") { onOpenCart(); return; }
    if (id === "search") { setActiveTab("shop"); return; }
    setActiveTab(id);
  };

  const isActive = (id) => {
    if (id === "cart") return activeTab === "checkout" || activeTab === "cart";
    if (id === "search") return activeTab === "shop";
    return activeTab === id;
  };

  return (
    <nav className="bottom-nav" aria-label="Bottom navigation">
      {NAV.map(item => {
        const Icon = item.icon;
        const active = isActive(item.id);
        return (
          <button
            key={item.id}
            className={`bottom-nav-item${active ? " active" : ""}`}
            onClick={() => handleTap(item.id)}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
          >
            {item.id === "cart" && cartCount > 0 && (
              <span className="bottom-nav-badge">{cartCount > 9 ? "9+" : cartCount}</span>
            )}
            <Icon size={22} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
