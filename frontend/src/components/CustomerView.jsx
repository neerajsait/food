import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { api } from "../utils/api";
import { jsPDF } from "jspdf";
import {
  ShoppingCart, Clock, CheckCircle, Star, MessageSquare, X, Lock,
  Search, Minus, Plus, Heart, Leaf,
  Sparkles, MapPin, Truck, RefreshCw, Home, Briefcase, PlusCircle, FileText, Trash2, ShoppingBag, LogOut, QrCode, User
} from "lucide-react";
import QRScanner from "./QRScanner";

// Category configuration
const CATEGORIES = [
  { id: "all",            label: "All Products",     emoji: "🏪",  color: "#a855f7" },
  { id: "favs",           label: "My Favorites",     emoji: "❤️",  color: "#ec4899" },
  { id: "Spice Powders",  label: "Spice Powders",    emoji: "🌶️", color: "#ef4444" },
  { id: "Pickles",        label: "Pickles",           emoji: "🥒",  color: "#22c55e" },
  { id: "Snacks & Savories", label: "Snacks",        emoji: "🍿",  color: "#f59e0b" },
  { id: "Sweets & Treats",   label: "Sweets",        emoji: "🍬",  color: "#ec4899" },
  { id: "Mixes & Instant",   label: "Mixes",         emoji: "🍲",  color: "#3b82f6" },
  { id: "Special Products",  label: "Specials",      emoji: "⭐",  color: "#8b5cf6" },
];

// Delivery address book templates
const DEFAULT_ADDRESSES = [
  { id: 1, label: "Home", address: "Flat 402, Srinivasa Heights, Vijayawada, Andhra Pradesh", type: "home" },
  { id: 2, label: "Office", address: "Tech Hub, Block C, Hitec City, Hyderabad, Telangana", type: "work" },
];

function getDiscountPct(price, originalPrice) {
  if (!originalPrice || originalPrice <= price) return 0;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

// Simple heuristic pairings for "Frequently Bought Together"
const PAIRINGS = {
  "Pickles": [
    { id: 18, name: "Rice Vadiyalu 250g", price: 120, category: "Snacks & Savories", emoji: "🍿" },
    { id: 6, name: "Kandi Podi 250g", price: 179, category: "Spice Powders", emoji: "🌶️" }
  ],
  "Spice Powders": [
    { id: 16, name: "Classic Avakaya 250g", price: 299, category: "Pickles", emoji: "🥒" },
    { id: 28, name: "Instant Rasam Mix 250g", price: 140, category: "Mixes & Instant", emoji: "🍲" }
  ],
  "Sweets & Treats": [
    { id: 17, name: "Challa Chakralu 250g", price: 120, category: "Snacks & Savories", emoji: "🍿" }
  ],
  "Snacks & Savories": [
    { id: 23, name: "Palli Patti 250g", price: 169, category: "Sweets & Treats", emoji: "🍬" }
  ],
  "Mixes & Instant": [
    { id: 16, name: "Classic Avakaya 250g", price: 299, category: "Pickles", emoji: "🥒" }
  ]
};

export default function CustomerView({ onLogout, dbMode }) {
  const [toast, setToast] = useState(null);
  const alert = (msg) => {
    setToast({ message: msg, type: msg.toLowerCase().includes("failed") || msg.toLowerCase().includes("error") ? "error" : "success" });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const [activeTab, setActiveTab] = useState("menu");
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState(null); // detail modal
  const [showCartDrawer, setShowCartDrawer] = useState(false);

  // Favorites (persisted via API)
  const [favorites, setFavorites] = useState([]);

  // Address Manager states (persisted via API)
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(1);
  const [showAddressManager, setShowAddressManager] = useState(false);
  const [newAddrLabel, setNewAddrLabel] = useState("Home");
  const [newAddrVal, setNewAddrVal] = useState("");
  const [checkoutAddress, setCheckoutAddress] = useState("");

  // Payment Gateway states
  const [paymentMethod, setPaymentMethod] = useState("COD"); // "COD", "UPI", "CARD"
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // Feedback states
  const [trackingCodes, setTrackingCodes] = useState({});
  const [feedbackRatings, setFeedbackRatings] = useState({});
  const [feedbackComments, setFeedbackComments] = useState({});
  const [hoveredStars, setHoveredStars] = useState({});

  // Food Item Reviews states
  const [itemReviews, setItemReviews] = useState([]);
  const [itemReviewsLoading, setItemReviewsLoading] = useState(false);
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewComment, setNewReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [hoveredItemStars, setHoveredItemStars] = useState(0);

  // Coupon Discount states
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");

  // Product Scanner state
  const [isScanning, setIsScanning] = useState(false);

  // Profile Modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", phone: "", address: "" });
  const [profileUpdating, setProfileUpdating] = useState(false);

  // Load reviews when selectedItem changes
  useEffect(() => {
    if (selectedItem?.id) {
      setItemReviewsLoading(true);
      api.getMenuItemReviews(selectedItem.id)
        .then(data => {
          setItemReviews(data);
          setItemReviewsLoading(false);
        })
        .catch(err => {
          console.error("Failed to load reviews:", err);
          setItemReviewsLoading(false);
        });
    } else {
      setItemReviews([]);
    }
  }, [selectedItem?.id]);


  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const menuData = await api.getFoodsMenu();
      const ordersData = await api.getOrderHistory();
      const favsData = await api.getFavorites();
      const addrData = await api.getAddresses();
      
      setMenu(menuData);
      setOrders(ordersData);
      setFavorites(favsData.map(f => f.menu_item_id));
      setAddresses(addrData.length > 0 ? addrData : DEFAULT_ADDRESSES);
    } catch (err) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const openCartDrawer = () => {
    loadData();
    const defaultAddr = addresses.find(a => a.id === selectedAddressId) || addresses[0];
    setCheckoutAddress(defaultAddr ? defaultAddr.address : "");
    setShowCartDrawer(true);
  };


  useEffect(() => { loadData(); }, []);

  // Filtered menu logic
  const filteredMenu = useMemo(() => {
    return menu.filter(item => {
      const matchesCat =
        activeCategory === "all" ||
        (activeCategory === "favs" && favorites.includes(item.id)) ||
        item.category === activeCategory;
      const matchesSearch = !searchQuery || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (item.code && item.code.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  }, [menu, activeCategory, searchQuery, favorites]);

  // Compute average rating for selected item reviews
  const avgRating = useMemo(() => {
    if (!itemReviews.length) return null;
    const sum = itemReviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / itemReviews.length).toFixed(1);
  }, [itemReviews]);


  // Grouped menu
  const groupedMenu = useMemo(() => {
    if (activeCategory !== "all" && activeCategory !== "favs") {
      return { [activeCategory]: filteredMenu };
    }
    const groups = {};
    filteredMenu.forEach(item => {
      const cat = item.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredMenu, activeCategory]);

  const toggleFavorite = async (itemId, e) => {
    e.stopPropagation();
    const isFav = favorites.includes(itemId);
    
    // Optimistic update
    setFavorites(prev => isFav ? prev.filter(id => id !== itemId) : [...prev, itemId]);
    
    try {
      if (isFav) {
        await api.removeFavorite(itemId);
      } else {
        await api.addFavorite(itemId);
      }
    } catch (err) {
      // Revert on error
      setFavorites(prev => !isFav ? prev.filter(id => id !== itemId) : [...prev, itemId]);
      alert("Failed to update favorite");
    }
  };

  const handleQuickReorder = (orderItems, e) => {
    e.stopPropagation();
    const newCart = {};
    orderItems.forEach(it => {
      newCart[it.menu_item_id] = it.quantity;
    });
    setCart(newCart);
    openCartDrawer();
    setActiveTab("menu");
  };

  const handlePlaceOrder = async () => {
    const items = Object.entries(cart).map(([id, qty]) => ({ menu_item_id: parseInt(id), quantity: qty }));
    if (!items.length) return;
    
    const addressStr = checkoutAddress.trim();
    if (!addressStr.trim()) {
      alert("Please provide a shipping address before confirming the order.");
      return;
    }

    // Card details validation
    if (paymentMethod === "CARD") {
      if (!cardName.trim()) {
        alert("Please enter the cardholder name.");
        return;
      }
      const rawCard = cardNumber.replace(/\s+/g, "");
      if (!/^\d{16}$/.test(rawCard)) {
        alert("Please enter a valid 16-digit card number.");
        return;
      }
      if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
        alert("Please enter card expiry date in MM/YY format.");
        return;
      }
      if (!/^\d{3}$/.test(cardCvv)) {
        alert("Please enter a valid 3-digit CVV.");
        return;
      }
    }

    setPaymentProcessing(true);
    try {
      // Simulate payment processing delay (1.5 seconds) for Card and UPI
      if (paymentMethod !== "COD") {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      await api.placeOrder(items, addressStr, paymentMethod, appliedCoupon ? appliedCoupon.code : null);
      setCart({});
      setCardNumber("");
      setCardExpiry("");
      setCardCvv("");
      setCardName("");
      setPaymentMethod("COD");
      setAppliedCoupon(null);
      setCouponCodeInput("");
      setShowCartDrawer(false);
      setActiveTab("orders");
      loadData();
      alert("Order placed and payment processed successfully!");
    } catch (err) {
      alert("Order failed: " + err.message);
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCodeInput.trim()) return;
    setCouponError("");
    try {
      const coupon = await api.validateCoupon(couponCodeInput.trim());
      setAppliedCoupon(coupon);
      setCouponCodeInput("");
      alert(`Coupon "${coupon.code}" applied! (${coupon.discount_pct}% off)`);
    } catch (err) {
      setCouponError(err.message || "Invalid coupon code");
      setAppliedCoupon(null);
    }
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    if (!newAddrVal.trim()) return;
    try {
      const res = await api.addAddress(newAddrLabel, newAddrVal.trim(), false);
      const newAddr = res.address;
      setAddresses(prev => [...prev, newAddr]);
      setSelectedAddressId(newAddr.id);
      setCheckoutAddress(newAddr.address_line || newAddr.address); // fallback for mock
      setNewAddrVal("");
      setShowAddressManager(false);
      alert("Address added");
    } catch (err) {
      alert("Failed to add address");
    }
  };

  const handleDeleteAddress = async (id, e) => {
    e.stopPropagation();
    try {
      await api.deleteAddress(id);
      setAddresses(prev => prev.filter(a => a.id !== id));
      if (selectedAddressId === id) {
        setSelectedAddressId(addresses.length > 1 ? addresses.find(a => a.id !== id).id : null);
      }
    } catch (err) {
      alert("Failed to delete address");
    }
  };

  const handleConfirmReceipt = async (orderId) => {
    const code = trackingCodes[orderId];
    if (!code?.trim()) { alert("Please enter the tracking code"); return; }
    try {
      await api.confirmReceipt(orderId, code);
      setTrackingCodes(prev => ({ ...prev, [orderId]: "" }));
      loadData();
      alert("Receipt confirmed!");
    } catch (err) { alert("Error: " + err.message); }
  };

  const handleDownloadReceipt = (order) => {
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      
      let yPos = 20;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(16, 185, 129); // brand color
      doc.text("FLAVORFLOW ERP", 20, yPos);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("Premium Kitchen & Retail", 20, yPos + 6);
      
      yPos += 20;
      doc.setFontSize(16);
      doc.setTextColor(40, 40, 40);
      doc.text("CUSTOMER INVOICE", 20, yPos);
      
      yPos += 10;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Order ID: #${order.id}`, 20, yPos);
      doc.text(`Date: ${new Date(order.created_at).toLocaleString()}`, 120, yPos);
      
      yPos += 6;
      doc.text(`Status: ${order.status.toUpperCase()}`, 20, yPos);
      doc.text(`Payment: ${order.payment_method || "COD"}`, 120, yPos);
      
      yPos += 15;
      doc.setFont("helvetica", "bold");
      doc.text("Item Details", 20, yPos);
      doc.text("Qty", 120, yPos);
      doc.text("Total", 160, yPos);
      
      yPos += 2;
      doc.setDrawColor(200, 200, 200);
      doc.line(20, yPos, 190, yPos);
      
      yPos += 8;
      doc.setFont("helvetica", "normal");
      let subtotal = 0;
      order.items.forEach(it => {
        const itemTotal = (it.price * it.quantity);
        subtotal += itemTotal;
        doc.text(`${it.menu_item_name}`, 20, yPos);
        doc.text(`${it.quantity}`, 120, yPos);
        doc.text(`Rs.${itemTotal.toFixed(2)}`, 160, yPos);
        yPos += 8;
      });
      
      yPos += 2;
      doc.line(20, yPos, 190, yPos);
      
      const grandTotal = parseFloat(order.total_price);
      if (subtotal > grandTotal && (subtotal - grandTotal) > 0.01) {
          yPos += 8;
          doc.text("Subtotal:", 120, yPos);
          doc.text(`Rs.${subtotal.toFixed(2)}`, 160, yPos);
          yPos += 6;
          doc.setTextColor(16, 185, 129); // green
          doc.text("Discount applied:", 120, yPos);
          doc.text(`-Rs.${(subtotal - grandTotal).toFixed(2)}`, 160, yPos);
          doc.setTextColor(40, 40, 40);
      }

      yPos += 8;
      doc.setFont("helvetica", "bold");
      doc.text("Grand Total:", 120, yPos);
      doc.text(`Rs.${grandTotal.toFixed(2)}`, 160, yPos);
      
      yPos += 20;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text("Thank you for choosing Suggula's Kitchen!", 105, yPos, { align: "center" });

      doc.save(`Invoice_${order.id}.pdf`);
      alert("Invoice downloaded successfully!");
    } catch (err) {
      alert("Failed to download invoice: " + err.message);
    }
  };

  const handleSubmitFeedback = async (orderId) => {
    const rating = feedbackRatings[orderId] || 5;
    const comment = feedbackComments[orderId] || "";
    try {
      await api.submitFeedback(orderId, rating, comment);
      loadData();
      alert("Thank you for your feedback!");
    } catch (err) { alert("Feedback failed: " + err.message); }
  };

  const handleSubmitMenuItemReview = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (!newReviewComment.trim()) {
      alert("Please write a review comment.");
      return;
    }
    setSubmittingReview(true);
    try {
      await api.submitMenuItemReview(selectedItem.id, newReviewRating, newReviewComment.trim());
      setNewReviewComment("");
      setNewReviewRating(5);
      // reload reviews
      const data = await api.getMenuItemReviews(selectedItem.id);
      setItemReviews(data);
      alert("Thank you for your review!");
    } catch (err) {
      alert("Failed to submit review: " + err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const addToCart = (itemId) => setCart(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
  const removeFromCart = (itemId) => setCart(prev => {
    const next = { ...prev };
    if ((next[itemId] || 0) <= 1) delete next[itemId];
    else next[itemId] -= 1;
    return next;
  });
  const getCartCount = () => Object.values(cart).reduce((s, q) => s + q, 0);
  const getCartTotal = () => Object.entries(cart).reduce((s, [id, qty]) => {
    const item = menu.find(m => m.id === parseInt(id));
    return s + (item ? item.price * qty : 0);
  }, 0);

  const openProfileModal = () => {
    const user = api.getCurrentUser();
    if (user) {
      setProfileForm({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        phone: user.phone || "",
        address: user.address || ""
      });
      setShowProfileModal(true);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileUpdating(true);
    try {
      await api.updateProfile(profileForm);
      alert("Profile updated successfully!");
      setShowProfileModal(false);
    } catch (err) {
      alert("Failed to update profile: " + err.message);
    } finally {
      setProfileUpdating(false);
    }
  };

  const getOrderStatusStage = (status) => {
    switch (status) {
      case "pending": return 1;
      case "processing": return 2;
      case "shipped": return 3;
      case "delivered":
      case "completed": return 4;
      default: return 1;
    }
  };

  const _currentSelectedAddress = addresses.find(a => a.id === selectedAddressId) || addresses[0];

  const catConfig = (catId) => CATEGORIES.find(c => c.id === catId) || { emoji: "📦", color: "#6b7280", label: catId };

  const discountAmount = appliedCoupon ? (getCartTotal() * appliedCoupon.discount_pct / 100) : 0;
  const finalSubtotal = getCartTotal() - discountAmount;
  const deliveryCharge = getCartTotal() >= 499 ? 0 : 49;
  const finalTotal = finalSubtotal + deliveryCharge;

  return (
    <div style={{ maxWidth: "100%", minHeight: "100vh", position: "relative", background: "var(--bg-canvas)" }} className="animate-fade-in">
      
      {/* ── Premium E-Commerce Header ── */}
      <header style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem",
        padding: "1rem", background: "var(--bg-base)",
        borderBottom: "1px solid var(--border-light)", position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 2px 10px rgba(0,0,0,0.01)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: "36px", height: "36px",
            background: "var(--brand)",
            borderRadius: "var(--r-md)", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "1.25rem", color: "#fff"
          }}>🍱</div>
          <div>
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "1.2rem", color: "var(--text-primary)" }}>FlavorFlow Shop</span>
            <span style={{ fontSize: "0.65rem", display: "block", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "-2px" }}>Premium Kitchen</span>
          </div>
        </div>

        {/* Tabs inside Header */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => setActiveTab("menu")}
            style={{
              padding: "0.5rem 1rem", border: "none", borderRadius: "var(--r-md)",
              background: activeTab === "menu" ? "var(--brand-dim)" : "transparent",
              color: activeTab === "menu" ? "var(--brand)" : "var(--text-secondary)",
              fontWeight: activeTab === "menu" ? 700 : 500, cursor: "pointer",
              display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem",
              transition: "all 0.2s"
            }}
          >
            <ShoppingBag size={15} /> Browse Menu
          </button>
          <button
            onClick={() => { setActiveTab("orders"); loadData(); }}
            style={{
              padding: "0.5rem 1rem", border: "none", borderRadius: "var(--r-md)",
              background: activeTab === "orders" ? "var(--brand-dim)" : "transparent",
              color: activeTab === "orders" ? "var(--brand)" : "var(--text-secondary)",
              fontWeight: activeTab === "orders" ? 700 : 500, cursor: "pointer",
              display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem",
              transition: "all 0.2s"
            }}
          >
            <Clock size={15} /> My Orders
            {orders.length > 0 && <span className="nav-badge" style={{ marginLeft: "6px" }}>{orders.length}</span>}
          </button>
          <button
            onClick={openCartDrawer}
            style={{
              padding: "0.5rem 1rem", border: "none", borderRadius: "var(--r-md)",
              background: showCartDrawer ? "var(--brand-dim)" : "transparent",
              color: getCartCount() > 0 ? "var(--brand)" : "var(--text-secondary)",
              fontWeight: showCartDrawer ? 700 : 500, cursor: "pointer",
              display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem",
              transition: "all 0.2s"
            }}
          >
            <ShoppingCart size={15} /> Basket
            {getCartCount() > 0 && (
              <span className="nav-badge" style={{ marginLeft: "6px", background: "var(--brand)", color: "#fff" }}>
                {getCartCount()}
              </span>
            )}
          </button>
        </div>

        {/* User profile & logout */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {dbMode && (
            <div style={{
              fontSize: "0.72rem", color: dbMode.includes("Live") ? "var(--success)" : "var(--warning)",
              background: dbMode.includes("Live") ? "var(--success-bg)" : "var(--warning-bg)",
              padding: "0.3rem 0.75rem", borderRadius: "var(--r-full)", fontWeight: 600,
              border: "1px solid", borderColor: dbMode.includes("Live") ? "rgba(22,163,74,0.2)" : "rgba(217,119,6,0.2)"
            }}>
              {dbMode.includes("Live") ? "Live Backend" : "Demo Mode"}
            </div>
          )}
          <button
            onClick={openProfileModal}
            style={{
              display: "flex", alignItems: "center", gap: "0.35rem",
              padding: "0.5rem 0.85rem", border: "1px solid var(--border-light)",
              borderRadius: "var(--r-md)", background: "var(--bg-elevated)",
              color: "var(--text-primary)", cursor: "pointer", fontSize: "0.8rem",
              fontWeight: 600, transition: "all 0.2s"
            }}
          >
            <User size={14} /> My Profile
          </button>
          <button
            onClick={onLogout}
            style={{
              display: "flex", alignItems: "center", gap: "0.35rem",
              padding: "0.5rem 0.85rem", border: "1px solid var(--border-light)",
              borderRadius: "var(--r-md)", background: "transparent",
              color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.8rem",
              fontWeight: 600, transition: "all 0.2s"
            }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </header>

      {/* Main shop container */}
      <div className="shop-container" style={{ width: "100%" }}>

       {/* ── Hero Banner ── */}
      <div style={{
        background: "var(--brand-dim)",
        border: "1px solid var(--border-brand)",
        borderRadius: "var(--r-xl)",
        padding: "2rem 2.5rem",
        marginBottom: "1.75rem",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: -60, left: "30%", width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(16, 185, 129, 0.05) 0%, transparent 70%)" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
            <Leaf size={16} style={{ color: "var(--brand)" }} />
            <span style={{ fontSize: "0.7rem", fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--brand)" }}>
              Suggula's Kitchen
            </span>
          </div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "2rem", fontWeight: "900", color: "var(--text-primary)", margin: "0 0 0.5rem", letterSpacing: "-0.03em" }}>
            Authentic Homemade Foods
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1.25rem" }}>
            Traditional Andhra recipes · 35+ authentic products · Shipped fresh
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {["🚚 Free Delivery ₹499+", "🌿 100% Natural", "👩‍🍳 Homemade", "⭐ 4.8 Rating"].map(badge => (
              <span key={badge} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", padding: "0.3rem 0.85rem", borderRadius: "var(--r-full)", fontSize: "0.75rem", fontWeight: "600", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                {badge}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="tab-nav" style={{ marginBottom: "1.5rem" }}>
        <button className={`tab-btn ${activeTab === "menu" ? "active" : ""}`} onClick={() => setActiveTab("menu")}>
          <Sparkles size={14} /> Shop
        </button>
        <button className={`tab-btn ${activeTab === "orders" ? "active" : ""}`} onClick={() => { setActiveTab("orders"); loadData(); }}>
          <Clock size={14} /> My Orders
          {orders.length > 0 && <span className="nav-badge">{orders.length}</span>}
        </button>
      </div>

      {error && <div style={{ color: "var(--alert-color)", textAlign: "center", fontSize: "0.85rem", marginBottom: "1rem", fontWeight: "600" }}>{error}</div>}

      {/* ══════════════════════ SHOP / MENU TAB ══════════════════════ */}
      {activeTab === "menu" && (
        <div className="animate-fade-in">

          {/* Search query input */}
          <div style={{ position: "relative", marginBottom: "1rem" }}>
            <Search size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: "2.5rem", paddingRight: "1rem" }}
              placeholder="Search spices, pickles, sweets..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: "40px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
                <X size={14} />
              </button>
            )}
            <button 
              onClick={() => setIsScanning(!isScanning)} 
              title="Scan Product QR"
              style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: isScanning ? "var(--brand)" : "var(--text-muted)", display: "flex" }}
            >
              <QrCode size={16} />
            </button>
          </div>
          
          {isScanning && (
            <div style={{ marginBottom: "1rem", maxWidth: "400px", margin: "0 auto 1rem auto" }}>
              <QRScanner onStockUpdated={(code) => {
                if (code) {
                   setSearchQuery(code);
                }
                setIsScanning(false);
              }} />
            </div>
          )}

          {/* Category Filter Pills */}
          <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.5rem", marginBottom: "1.5rem", scrollbarWidth: "none" }}>
            {CATEGORIES.map(cat => {
              const isActive = activeCategory === cat.id;
              let count = 0;
              if (cat.id === "all") count = menu.length;
              else if (cat.id === "favs") count = favorites.length;
              else count = menu.filter(m => m.category === cat.id).length;

              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`chip ${isActive ? "active" : ""}`}
                  style={{
                    border: isActive ? `1px solid ${cat.color}` : undefined,
                    background: isActive ? `${cat.color}18` : undefined,
                    color: isActive ? cat.color : undefined,
                  }}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                  <span style={{
                    background: isActive ? cat.color : "var(--bg-hover)",
                    color: isActive ? "#fff" : "var(--text-muted)",
                    borderRadius: "var(--r-full)", padding: "1px 6px", fontSize: "0.62rem", fontWeight: 700
                  }}>{count}</span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "4rem 0" }}>
              <RefreshCw className="animate-spin" size={28} style={{ color: "var(--text-muted)" }} />
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>Loading fresh catalog...</p>
            </div>
          ) : filteredMenu.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--text-muted)" }}>
              <p style={{ fontSize: "2rem" }}>🔍</p>
              <p style={{ fontSize: "0.88rem", fontWeight: "600" }}>No items found in this section</p>
            </div>
          ) : (
            Object.entries(groupedMenu).map(([catId, items]) => {
              if (!items.length) return null;
              const cc = catConfig(catId);
              return (
                <div key={catId} style={{ marginBottom: "2rem" }}>
                  {activeCategory === "all" || activeCategory === "favs" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.85rem" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${cc.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>
                        {cc.emoji}
                      </div>
                      <div>
                        <h2 style={{ fontSize: "1rem", fontWeight: "800", margin: 0, color: "var(--text-primary)" }}>{cc.label || catId}</h2>
                      </div>
                      <div style={{ flex: 1, height: "1px", background: "var(--border-light)" }} />
                    </div>
                  ) : null}

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
                    {items.map(item => {
                      const discount = getDiscountPct(item.price, item.original_price);
                      const inCart = cart[item.id] || 0;
                      const isFav = favorites.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          className="glass-card"
                          style={{
                            display: "flex", gap: "0.875rem", alignItems: "center",
                            padding: "1rem",
                            border: inCart > 0 ? "1px solid var(--brand)" : "1px solid var(--border-subtle)",
                            boxShadow: inCart > 0 ? "0 0 0 1px var(--brand-dim), var(--shadow-glow)" : undefined,
                            position: "relative", cursor: "pointer"
                          }}
                          onClick={() => setSelectedItem(item)}
                        >
                          {/* Heart icon button */}
                          <button
                            onClick={(e) => toggleFavorite(item.id, e)}
                            style={{
                              position: "absolute", top: "8px", right: "8px",
                              background: "none", border: "none", cursor: "pointer", zIndex: 10
                            }}
                          >
                            <Heart size={16} fill={isFav ? "#ec4899" : "transparent"} color={isFav ? "#ec4899" : "var(--text-muted)"} />
                          </button>

                          <div style={{ position: "relative", flexShrink: 0 }}>
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                style={{ width: "75px", height: "75px", objectFit: "cover", borderRadius: "10px", display: "block" }}
                                onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
                              />
                            ) : null}
                            <div style={{ width: "75px", height: "75px", borderRadius: "10px", background: `${cc.color}18`, display: item.image_url ? "none" : "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem" }}>
                              {cc.emoji}
                            </div>
                            {discount > 0 && (
                              <div style={{ position: "absolute", top: "-4px", left: "-4px", background: "#ef4444", color: "#fff", fontSize: "0.6rem", fontWeight: "800", padding: "1px 5px", borderRadius: "8px" }}>
                                -{discount}%
                              </div>
                            )}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h3 style={{ fontSize: "0.85rem", fontWeight: "700", margin: "0 0 0.15rem", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: "1.25rem" }}>
                              {item.name}
                            </h3>
                            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: "0 0 0.4rem", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>
                              {item.description}
                            </p>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
                                  <span style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: "800", color: "var(--brand)" }}>₹{item.price.toFixed(0)}</span>
                                  {item.original_price && item.original_price > item.price && (
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textDecoration: "line-through" }}>₹{item.original_price.toFixed(0)}</span>
                                  )}
                              </div>
                                {item.average_rating !== undefined && (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.15rem", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.12)", borderRadius: "4px", padding: "1px 4px", fontSize: "0.65rem", fontWeight: "800", color: "var(--warning-color)" }} title={`${item.reviews_count} reviews`}>
                                    ⭐ {item.average_rating > 0 ? item.average_rating : "New"}
                                  </span>
                                )}
                              </div>
                              <div onClick={e => e.stopPropagation()}>
                                {inCart > 0 ? (
                                  <div className="qty-stepper">
                                    <button onClick={() => removeFromCart(item.id)}><Minus size={11} /></button>
                                    <span>{inCart}</span>
                                    <button onClick={() => addToCart(item.id)}><Plus size={11} /></button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); addToCart(item.id); }}
                                    className="btn btn-primary"
                                    style={{ padding: "0.35rem 0.8rem", fontSize: "0.78rem" }}
                                  >
                                    <Plus size={13} /> Add
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          <div style={{ height: "6rem" }} />
        </div>
      )}

      {/* ══════════════════════ ORDERS HISTORY TAB ══════════════════════ */}
      {activeTab === "orders" && (
        <div className="animate-fade-in" style={{ display: "grid", gap: "1.25rem", paddingBottom: "2rem" }}>
          {orders.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🛍️</div>
              <p style={{ fontWeight: "700", color: "var(--text-primary)" }}>No orders yet!</p>
              <button onClick={() => setActiveTab("menu")} className="btn btn-primary" style={{ padding: "0.6rem 1.5rem", marginTop: "0.5rem" }}>
                Browse Products
              </button>
            </div>
          ) : (
            orders.map(order => {
              const currentStage = getOrderStatusStage(order.status);
              return (
                <div key={order.id} className="glass-card" style={{ borderLeft: `3px solid ${order.is_received ? "var(--success-color)" : "var(--border-dark)"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <div>
                      <span style={{ fontWeight: "700", fontSize: "0.95rem" }}>Order #{order.id}</span>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{new Date(order.created_at).toLocaleString()}</div>
                      {order.tracking_code && (
                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                          🚚 Tracking ID: <span style={{ fontWeight: 800, color: "var(--brand)" }}>{order.tracking_code}</span>
                        </div>
                      )}
                    </div>
                    <span className={`badge-status status-${order.status}`}>{order.status}</span>
                  </div>

                  {/* 🚀 Visual Order Stepper */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "1rem 0 1.25rem", padding: "0 0.5rem" }}>
                    {[
                      { step: 1, label: "Ordered" },
                      { step: 2, label: "Kitchen" },
                      { step: 3, label: "Dispatched" },
                      { step: 4, label: "Arrived" }
                    ].map((s, idx) => {
                      const completed = currentStage >= s.step;
                      const active = currentStage === s.step;
                      return (
                        <React.Fragment key={s.step}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
                            <div style={{
                              width: "22px", height: "22px", borderRadius: "50%",
                              background: completed ? "var(--accent)" : "var(--border-light)",
                              color: completed ? "#fff" : "var(--text-muted)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "0.65rem", fontWeight: "800",
                              boxShadow: active ? "0 0 0 4px rgba(124, 58, 237, 0.25)" : "none",
                              transition: "all 0.3s ease"
                            }}>
                              {completed ? "✓" : s.step}
                            </div>
                            <span style={{ fontSize: "0.6rem", fontWeight: active ? "700" : "500", color: active ? "var(--text-primary)" : "var(--text-muted)", marginTop: "0.25rem" }}>
                              {s.label}
                            </span>
                          </div>
                          {idx < 3 && (
                            <div style={{
                              flex: 1, height: "3px",
                              background: currentStage > s.step ? "var(--accent)" : "var(--border-light)",
                              margin: "0 0.25rem", marginBottom: "0.85rem"
                            }} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  <div style={{ borderBottom: "1px solid var(--border-light)", paddingBottom: "0.6rem", marginBottom: "0.6rem" }}>
                    {order.items.map(it => (
                      <div key={it.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "0.2rem" }}>
                        <span>{it.menu_item_name} ×{it.quantity}</span>
                        <span>₹{(it.price * it.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "700", marginTop: "0.5rem", fontSize: "0.9rem" }}>
                      <span>Total Billing</span>
                      <span>₹{order.total_price.toFixed(2)}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.6rem", flexWrap: "wrap" }}>
                    {/* Quick Reorder Button */}
                    <button
                      onClick={(e) => handleQuickReorder(order.items, e)}
                      className="btn btn-secondary"
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.25rem" }}
                    >
                      <PlusCircle size={13} /> Reorder items
                    </button>
                    <button
                      onClick={() => handleDownloadReceipt(order)}
                      className="btn btn-secondary"
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.25rem" }}
                    >
                      <FileText size={13} /> Download Receipt
                    </button>
                    {["pending", "processing"].includes(order.status) && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm("Are you sure you want to cancel this order?")) {
                            try {
                              await api.cancelOrder(order.id);
                              alert("Order cancelled successfully!");
                              loadData();
                            } catch (err) { alert("Cancel failed: " + err.message); }
                          }
                        }}
                        className="btn"
                        style={{
                          padding: "0.35rem 0.75rem", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.25rem",
                          background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", color: "#ef4444", cursor: "pointer", borderRadius: "var(--radius-sm)"
                        }}
                      >
                        <Trash2 size={13} /> Cancel Order
                      </button>
                    )}
                  </div>


                    {order.status === "shipped" && !order.is_received && (
                    <div style={{ background: "var(--bg-secondary)", padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", marginBottom: "0.75rem" }}>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginBottom: "0.4rem" }}>
                        Order is shipped! Please confirm receipt using the Shipment Tracking ID:
                      </div>
                      {order.tracking_label && (
                        <div style={{ marginBottom: "0.65rem", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", padding: "0.5rem", borderRadius: "6px", textAlign: "center" }}>
                          <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem", fontWeight: "700" }}>
                            Outside Vendor Barcode / QR Label
                          </span>
                          <img src={order.tracking_label} alt="Outside Vendor Label" style={{ maxHeight: "120px", maxWidth: "100%", objectFit: "contain", borderRadius: "4px", background: "#fff", padding: "4px" }} />
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card)", padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid var(--border-subtle)", marginBottom: "0.6rem" }}>
                        <span style={{ fontSize: "0.78rem", fontFamily: "monospace", fontWeight: "700", color: "var(--brand)" }}>{order.tracking_code}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            setTrackingCodes({ ...trackingCodes, [order.id]: order.tracking_code });
                            // Auto-confirm receipt
                            try {
                              await api.confirmReceipt(order.id, order.tracking_code);
                              loadData();
                            } catch (err) { console.error(err); }
                          }}
                          style={{ background: "var(--brand-dim)", border: "none", color: "var(--brand)", fontSize: "0.65rem", padding: "0.2rem 0.5rem", borderRadius: "4px", cursor: "pointer", fontWeight: "700" }}
                        >
                          Autofill ID
                        </button>
                      </div>
                      {order.tracking_link && (
                        <div style={{ marginBottom: "0.5rem" }}>
                          <a href={order.tracking_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.75rem", color: "var(--brand)", fontWeight: "700", textDecoration: "underline", wordBreak: "break-all" }}>
                            🔗 Track your shipment here
                          </a>
                        </div>
                      )}
                      <label className="form-label" style={{ fontSize: "0.7rem", fontWeight: 700 }}>Enter Tracking ID to Confirm Receipt</label>
                      <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.25rem" }}>
                        <input type="text" className="form-input" placeholder="Tracking ID" style={{ padding: "0.4rem 0.6rem", fontSize: "0.8rem" }}
                          value={trackingCodes[order.id] || ""} onChange={e => setTrackingCodes({ ...trackingCodes, [order.id]: e.target.value })} />
                        <button onClick={() => handleConfirmReceipt(order.id)} className="btn btn-primary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}>Confirm</button>
                      </div>
                    </div>
                  )}

                  <div>
                    {!order.is_received ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--text-muted)", fontSize: "0.72rem", background: "var(--bg-secondary)", padding: "0.4rem 0.6rem", borderRadius: "var(--radius-sm)" }}>
                        <Lock size={11} /> Review locked until shipping tracking code is verified.
                      </div>
                    ) : order.feedback_submitted ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--success-color)", fontSize: "0.8rem", fontWeight: "600", padding: "0.4rem" }}>
                        <CheckCircle size={14} /> Review Submitted. Thank you!
                      </div>
                    ) : (
                      <div style={{ background: "var(--bg-secondary)", padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                          <MessageSquare size={14} /> <span style={{ fontSize: "0.78rem", fontWeight: "700" }}>Write Food Review</span>
                        </div>
                        <div style={{ display: "flex", gap: "0.2rem", marginBottom: "0.5rem" }}>
                          {[1, 2, 3, 4, 5].map(star => (
                            <button key={star} type="button" className="star-btn"
                              onMouseEnter={() => setHoveredStars({ ...hoveredStars, [order.id]: star })}
                              onMouseLeave={() => setHoveredStars({ ...hoveredStars, [order.id]: 0 })}
                              onClick={() => setFeedbackRatings({ ...feedbackRatings, [order.id]: star })}>
                              <Star size={16}
                                fill={(hoveredStars[order.id] || feedbackRatings[order.id] || 5) >= star ? "var(--warning-color)" : "transparent"}
                                color={(hoveredStars[order.id] || feedbackRatings[order.id] || 5) >= star ? "var(--warning-color)" : "var(--border-dark)"} />
                            </button>
                          ))}
                        </div>
                        <textarea className="form-input" placeholder="How was the taste and spices? Write your review..." style={{ minHeight: "50px", fontSize: "0.8rem", marginBottom: "0.5rem" }}
                          value={feedbackComments[order.id] || ""} onChange={e => setFeedbackComments({ ...feedbackComments, [order.id]: e.target.value })} />
                        <button onClick={() => handleSubmitFeedback(order.id)} className="btn btn-primary btn-block" style={{ padding: "0.45rem", fontSize: "0.8rem" }}>Submit Review</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}



      {/* ══ Item Detail Drawer + Frequently Bought Together Carousel ══ */}
      {selectedItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 110, display: "flex", justifyContent: "flex-end", padding: "0" }} onClick={() => setSelectedItem(null)}>
          <div className="glass-panel" onClick={e => e.stopPropagation()}
            style={{ 
              width: "100%", maxWidth: "480px", height: "100%", margin: 0, 
              borderRadius: "0", display: "flex", flexDirection: "column",
              animation: "slideInRight 0.3s ease-out forwards",
              borderLeft: "1px solid var(--border-light)",
            }}>
            
            <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
            
            <style>{`
              @keyframes slideInRight {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
              }
            `}</style>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                {selectedItem.category}
              </div>
              <button onClick={() => setSelectedItem(null)} className="btn btn-secondary" style={{ padding: "0.25rem" }}><X size={14} /></button>
            </div>

            {selectedItem.image_url && (
              <img src={selectedItem.image_url} alt={selectedItem.name}
                style={{ width: "100%", maxHeight: "200px", objectFit: "cover", borderRadius: "12px", marginBottom: "1rem" }}
                onError={e => e.target.style.display = "none"} />
            )}

            <h2 style={{ fontSize: "1.2rem", fontWeight: "800", margin: "0 0 0.5rem" }}>{selectedItem.name}</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: "1.6", marginBottom: "1rem" }}>{selectedItem.description}</p>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", marginBottom: "1.5rem", gap: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div>
                  <span style={{ fontSize: "1.4rem", fontWeight: "900" }}>₹{selectedItem.price.toFixed(0)}</span>
                  {selectedItem.original_price > selectedItem.price && (
                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", textDecoration: "line-through", marginLeft: "0.5rem" }}>₹{selectedItem.original_price.toFixed(0)}</span>
                  )}
                </div>
                {avgRating && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.15rem", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.12)", borderRadius: "6px", padding: "3px 8px", fontSize: "0.82rem", fontWeight: "800", color: "var(--warning-color)" }} title={`${itemReviews.length} reviews`}>
                    ⭐ {avgRating}
                  </span>
                )}
              </div>
            </div>

            {/* 💬 Customer Reviews & Writing a Review */}
            <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "1.25rem", paddingBottom: "1.25rem" }}>
              <h4 style={{ fontSize: "0.85rem", fontWeight: "800", color: "var(--text-primary)", marginBottom: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <MessageSquare size={14} style={{ color: "var(--brand)" }} /> Customer Reviews
              </h4>

              {/* Submit review form */}
              <form onSubmit={handleSubmitMenuItemReview} style={{ background: "var(--bg-secondary)", padding: "0.85rem", borderRadius: "10px", border: "1px solid var(--border-light)", marginBottom: "1.25rem" }}>
                <div style={{ fontSize: "0.76rem", fontWeight: "800", marginBottom: "0.4rem" }}>Write a Product Review</div>
                
                <div style={{ display: "flex", gap: "0.25rem", marginBottom: "0.5rem", alignItems: "center" }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginRight: "0.5rem" }}>Your Rating:</span>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewReviewRating(star)}
                      onMouseEnter={() => setHoveredItemStars(star)}
                      onMouseLeave={() => setHoveredItemStars(0)}
                      style={{ background: "transparent", border: "none", cursor: "pointer", padding: "0.1rem", display: "flex" }}
                    >
                      <Star
                        size={15}
                        fill={(hoveredItemStars || newReviewRating) >= star ? "var(--warning-color)" : "transparent"}
                        color={(hoveredItemStars || newReviewRating) >= star ? "var(--warning-color)" : "var(--border-dark)"}
                      />
                    </button>
                  ))}
                </div>

                <div style={{ position: "relative" }}>
                  <textarea
                    required
                    placeholder="Tell us what you think about the taste, quality, and spices..."
                    value={newReviewComment}
                    onChange={e => setNewReviewComment(e.target.value)}
                    style={{ width: "100%", minHeight: "50px", fontSize: "0.78rem", padding: "0.45rem", borderRadius: "6px", border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", resize: "vertical", marginBottom: "0.5rem" }}
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "0.45rem", fontSize: "0.78rem", fontWeight: "700" }}
                >
                  {submittingReview ? "Submitting..." : "Submit Review"}
                </button>
              </form>

              {/* Reviews List */}
              {itemReviewsLoading ? (
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", padding: "0.5rem" }}>Loading product reviews...</div>
              ) : itemReviews.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", padding: "0.5rem", fontStyle: "italic" }}>
                  No reviews for this product yet. Be the first to write one!
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "250px", overflowY: "auto", paddingRight: "0.25rem" }}>
                  {itemReviews.map(r => (
                    <div key={r.id} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "0.65rem 0.85rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                        <span style={{ fontWeight: "700", fontSize: "0.78rem", color: "var(--text-primary)" }}>{r.customer_name}</span>
                        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      <div style={{ display: "flex", gap: "0.1rem", marginBottom: "0.35rem" }}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star key={star} size={11} fill={r.rating >= star ? "var(--warning-color)" : "transparent"} color={r.rating >= star ? "var(--warning-color)" : "var(--border-dark)"} />
                        ))}
                      </div>
                      <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                        {r.comment}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 🍿 Frequently Bought Together Pairing Carousel */}
            {PAIRINGS[selectedItem.category] && (
              <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "1rem" }}>
                <h4 style={{ fontSize: "0.8rem", fontWeight: "800", color: "var(--text-primary)", marginBottom: "0.6rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <Sparkles size={12} style={{ color: "var(--warning-color)" }} /> Frequently Bought Together
                </h4>
                <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", scrollbarWidth: "none" }}>
                  {PAIRINGS[selectedItem.category].map(pItem => (
                    <div
                      key={pItem.id}
                      style={{
                        flex: "0 0 190px", display: "flex", alignItems: "center", gap: "0.5rem",
                        padding: "0.5rem", borderRadius: "10px", border: "1px solid var(--border-light)",
                        background: "var(--bg-secondary)", cursor: "pointer"
                      }}
                      onClick={() => {
                        const originalMenuItem = menu.find(m => m.id === pItem.id);
                        if (originalMenuItem) setSelectedItem(originalMenuItem);
                      }}
                    >
                      <div style={{ width: "30px", height: "30px", borderRadius: "6px", background: "var(--border-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>
                        {pItem.emoji}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: "0.72rem", fontWeight: "700", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pItem.name}</div>
                        <div style={{ fontSize: "0.68rem", fontWeight: "800", color: "var(--text-primary)" }}>₹{pItem.price}</div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); addToCart(pItem.id); alert(`${pItem.name} added!`); }}
                        style={{
                          background: "var(--accent)", color: "#fff", border: "none",
                          width: "20px", height: "20px", borderRadius: "50%", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: "800"
                        }}
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
            
            {/* Sticky Add to Basket Footer */}
            <div style={{ padding: "1rem 1.5rem", background: "var(--bg-card)", borderTop: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, position: "sticky", bottom: 0 }}>
              <div>
                <span style={{ fontSize: "1.1rem", fontWeight: "900" }}>₹{selectedItem.price.toFixed(0)}</span>
              </div>
              <div>
                {(cart[selectedItem.id] || 0) > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", background: "var(--accent)", borderRadius: "10px", overflow: "hidden" }}>
                    <button onClick={() => removeFromCart(selectedItem.id)} style={{ background: "none", border: "none", color: "#fff", padding: "0.5rem 1rem", cursor: "pointer" }}><Minus size={16} /></button>
                    <span style={{ padding: "0 0.75rem", fontWeight: "800", color: "#fff", fontSize: "1rem" }}>{cart[selectedItem.id]}</span>
                    <button onClick={() => addToCart(selectedItem.id)} style={{ background: "none", border: "none", color: "#fff", padding: "0.5rem 1rem", cursor: "pointer" }}><Plus size={16} /></button>
                  </div>
                ) : (
                  <button onClick={() => addToCart(selectedItem.id)} className="btn btn-primary" style={{ padding: "0.75rem 2rem", fontSize: "1rem" }}>
                    + Add to Basket
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ══ Centered Cart Modal (Review Order) ══ */}
      {showCartDrawer && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={() => setShowCartDrawer(false)}>
          <div className="glass-panel" onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: "520px", maxHeight: "90vh",
              display: "flex", flexDirection: "column",
              padding: "1.5rem", background: "var(--bg-base)",
              boxShadow: "var(--shadow-modal)", borderRadius: "var(--r-xl)",
              overflowY: "auto"
            }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: "800", margin: 0 }}>Review Order</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", margin: "0.1rem 0 0" }}>{getCartCount()} product{getCartCount() !== 1 ? "s" : ""} selected</p>
              </div>
              <button onClick={() => setShowCartDrawer(false)} className="btn btn-secondary" style={{ padding: "0.35rem" }}><X size={14} /></button>
            </div>

            {/* Address Selector Section */}
            <div style={{ background: "var(--bg-secondary)", padding: "1rem", borderRadius: "12px", border: "1px solid var(--border-light)", marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: "800", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <MapPin size={14} style={{ color: "var(--accent)" }} /> Shipping / Delivery Address
                </span>
                <select
                  value={selectedAddressId}
                  onChange={e => {
                    const newId = parseInt(e.target.value);
                    setSelectedAddressId(newId);
                    const addr = addresses.find(a => a.id === newId);
                    setCheckoutAddress(addr ? addr.address : "");
                  }}
                  style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border-light)", borderRadius: "6px", fontSize: "0.75rem", padding: "0.2rem 0.4rem", cursor: "pointer" }}
                >
                  {addresses.map(addr => (
                    <option key={addr.id} value={addr.id}>{addr.label}</option>
                  ))}
                  <option value="-1">Custom Address</option>
                </select>
              </div>
              <textarea
                className="form-input"
                placeholder="Enter complete shipping/delivery address..."
                style={{ width: "100%", minHeight: "55px", fontSize: "0.8rem", padding: "0.5rem", borderRadius: "8px", background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border-light)", resize: "none" }}
                value={checkoutAddress}
                onChange={e => setCheckoutAddress(e.target.value)}
              />
            </div>

            {/* Cart Items List */}
            <div style={{ display: "grid", gap: "0.85rem", marginBottom: "1.25rem" }}>
              {Object.entries(cart).map(([id, qty]) => {
                const item = menu.find(m => m.id === parseInt(id));
                if (!item) return null;
                const cc = catConfig(item.category);
                return (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ width: "44px", height: "44px", borderRadius: "8px", background: `${cc.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>
                      {cc.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontWeight: "700", fontSize: "0.85rem", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</h4>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>₹{item.price.toFixed(0)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border-light)", borderRadius: "8px", overflow: "hidden" }}>
                        <button onClick={() => removeFromCart(item.id)} className="btn btn-secondary" style={{ padding: "0.25rem 0.5rem", border: "none", borderRadius: 0 }}><Minus size={12} /></button>
                        <span style={{ padding: "0 0.4rem", fontWeight: "700", fontSize: "0.85rem", minWidth: "20px", textAlign: "center" }}>{qty}</span>
                        <button onClick={() => addToCart(item.id)} className="btn btn-secondary" style={{ padding: "0.25rem 0.5rem", border: "none", borderRadius: 0 }}><Plus size={12} /></button>
                      </div>
                      <span style={{ fontWeight: "800", fontSize: "0.88rem", minWidth: "52px", textAlign: "right" }}>₹{(item.price * qty).toFixed(0)}</span>
                      <button
                        onClick={() => setCart(prev => { const next = { ...prev }; delete next[item.id]; return next; })}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", padding: "0.25rem" }}
                        title="Delete from cart"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 💳 Payment Gateway Selector */}
            <div style={{ background: "var(--bg-secondary)", padding: "1rem", borderRadius: "12px", border: "1px solid var(--border-light)", marginBottom: "1.25rem" }}>
              <h4 style={{ fontSize: "0.82rem", fontWeight: "800", color: "var(--text-primary)", marginBottom: "0.6rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                💰 Select Payment Method
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", marginBottom: "1rem" }}>
                {[
                  { id: "COD", label: "Cash on Delivery", icon: "💵" },
                  { id: "UPI", label: "UPI / Scanner", icon: "📱" },
                  { id: "CARD", label: "Card Payment", icon: "💳" }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setPaymentMethod(opt.id)}
                    className="btn"
                    style={{
                      padding: "0.5rem 0.25rem",
                      fontSize: "0.7rem",
                      fontWeight: "700",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.25rem",
                      borderRadius: "8px",
                      background: paymentMethod === opt.id ? "var(--brand-dim)" : "var(--bg-primary)",
                      border: paymentMethod === opt.id ? "1px solid var(--border-brand)" : "1px solid var(--border-light)",
                      color: paymentMethod === opt.id ? "var(--brand)" : "var(--text-secondary)",
                      cursor: "pointer",
                      transition: "all 0.15s"
                    }}
                  >
                    <span style={{ fontSize: "1.1rem" }}>{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* UPI QR Code Interface */}
              {paymentMethod === "UPI" && (
                <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "0.75rem", textAlign: "center" }}>
                  <div style={{ background: "#ffffff", padding: "0.5rem", borderRadius: "6px", display: "inline-block", border: "1px solid #e2e8f0", marginBottom: "0.5rem" }}>
                    <div style={{ width: "120px", height: "120px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#1e293b" }}>
                      <span style={{ fontSize: "2rem" }}>📱</span>
                      <strong style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>Pay ₹{finalTotal.toFixed(0)}</strong>
                      <span style={{ fontSize: "0.55rem", color: "var(--brand)", marginTop: "2px" }}>Suggula's Kitchen</span>
                    </div>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: "600" }}>
                    Scan using GPay, PhonePe, or Paytm to pay
                  </div>
                </div>
              )}

              {/* Card Form Interface */}
              {paymentMethod === "CARD" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  <div>
                    <label style={{ fontSize: "0.68rem", fontWeight: "700", display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>CARDHOLDER NAME</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Name on card"
                      style={{ width: "100%", fontSize: "0.78rem", padding: "0.4rem 0.6rem", height: "auto" }}
                      value={cardName}
                      onChange={e => setCardName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.68rem", fontWeight: "700", display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>CARD NUMBER</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="0000 0000 0000 0000"
                      maxLength={19}
                      style={{ width: "100%", fontSize: "0.78rem", padding: "0.4rem 0.6rem", height: "auto" }}
                      value={cardNumber}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, "");
                        const formatted = val.match(/.{1,4}/g)?.join(" ") || "";
                        setCardNumber(formatted);
                      }}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <div>
                      <label style={{ fontSize: "0.68rem", fontWeight: "700", display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>EXPIRY DATE</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="MM/YY"
                        maxLength={5}
                        style={{ width: "100%", fontSize: "0.78rem", padding: "0.4rem 0.6rem", height: "auto" }}
                        value={cardExpiry}
                        onChange={e => {
                          let val = e.target.value.replace(/\D/g, "");
                          if (val.length > 2) val = val.substring(0,2) + "/" + val.substring(2);
                          setCardExpiry(val);
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.68rem", fontWeight: "700", display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>CVV</label>
                      <input
                        type="password"
                        className="form-input"
                        placeholder="123"
                        maxLength={3}
                        style={{ width: "100%", fontSize: "0.78rem", padding: "0.4rem 0.6rem", height: "auto" }}
                        value={cardCvv}
                        onChange={e => setCardCvv(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Coupon Code section */}
            <div style={{ background: "var(--bg-secondary)", padding: "1rem", borderRadius: "12px", border: "1px solid var(--border-light)", marginBottom: "1rem" }}>
              <h4 style={{ fontSize: "0.82rem", fontWeight: "800", color: "var(--text-primary)", marginBottom: "0.6rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                🏷️ Discount Coupon
              </h4>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter coupon (e.g. WELCOME10)"
                  style={{ flex: 1, fontSize: "0.8rem", padding: "0.4rem 0.6rem", textTransform: "uppercase", height: "auto" }}
                  value={couponCodeInput}
                  onChange={e => setCouponCodeInput(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="btn btn-primary"
                  style={{ padding: "0.4rem 1rem", fontSize: "0.8rem", height: "auto" }}
                >
                  Apply
                </button>
              </div>
              {couponError && (
                <div style={{ fontSize: "0.72rem", color: "#ef4444", marginTop: "0.35rem", fontWeight: "600" }}>
                  ❌ {couponError}
                </div>
              )}
              {appliedCoupon && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "8px", padding: "0.4rem 0.6rem", marginTop: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--success)", fontWeight: "700" }}>
                    ✓ Active: "{appliedCoupon.code}" ({appliedCoupon.discount_pct}% Off)
                  </span>
                  <button
                    type="button"
                    onClick={() => setAppliedCoupon(null)}
                    style={{ background: "none", border: "none", color: "#ef4444", fontSize: "0.7rem", cursor: "pointer", fontWeight: "700" }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Bill Summary details */}
            <div style={{ background: "var(--bg-secondary)", borderRadius: "12px", padding: "0.85rem", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                <span>Subtotal ({getCartCount()} items)</span><span>₹{getCartTotal().toFixed(0)}</span>
              </div>
              {appliedCoupon && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--success)", marginBottom: "0.35rem", fontWeight: "600" }}>
                  <span>Discount ({appliedCoupon.code})</span><span>-₹{discountAmount.toFixed(0)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                <span>Delivery Charge</span><span style={{ color: getCartTotal() >= 499 ? "var(--success-color)" : "var(--text-secondary)" }}>{getCartTotal() >= 499 ? "FREE" : "₹49"}</span>
              </div>
              {getCartTotal() < 499 && (
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                  Add ₹{(499 - getCartTotal()).toFixed(0)} more for FREE Delivery!
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "800", fontSize: "1rem", borderTop: "1px solid var(--border-light)", paddingTop: "0.5rem" }}>
                <span>Order Total</span><span>₹{finalTotal.toFixed(0)}</span>
              </div>
            </div>

            <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "var(--success-color)", padding: "0.75rem", borderRadius: "12px", fontSize: "0.82rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
              <Truck size={16} />
              <span>Estimated Delivery: 2-3 Days</span>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={paymentProcessing}
              className="btn btn-primary btn-block"
              style={{ padding: "0.85rem", fontSize: "0.95rem", borderRadius: "12px", background: "var(--brand)", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
            >
              {paymentProcessing ? (
                <>
                  <RefreshCw className="animate-spin" size={16} /> Processing Payment...
                </>
              ) : (
                <>
                  <ShoppingCart size={16} /> Confirm & Pay · ₹{finalTotal.toFixed(0)}
                </>
              )}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ══ Address Manager Selector Modal ══ */}
      {showAddressManager && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 130, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="glass-panel" style={{ width: "385px", padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: "800", margin: 0 }}>Select Delivery Address</h3>
              <button onClick={() => setShowAddressManager(false)} className="btn btn-secondary" style={{ padding: "0.25rem" }}><X size={14} /></button>
            </div>

            {/* List saved addresses */}
            <div style={{ display: "grid", gap: "0.6rem", marginBottom: "1.25rem" }}>
              {addresses.map(addr => {
                const isSelected = addr.id === selectedAddressId;
                const addrLabel = addr.title || addr.label;
                const addrLine = addr.address_line || addr.address;
                const isWork = addrLabel.toLowerCase() === "work" || addrLabel.toLowerCase() === "office";
                return (
                  <div
                    key={addr.id}
                    onClick={() => { setSelectedAddressId(addr.id); setShowAddressManager(false); setCheckoutAddress(addrLine); }}
                    style={{
                      border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border-light)",
                      background: isSelected ? "rgba(124,58,237,0.06)" : "var(--bg-secondary)",
                      borderRadius: "8px", padding: "0.75rem", cursor: "pointer", display: "flex", gap: "0.5rem", position: "relative"
                    }}
                  >
                    <div style={{ marginTop: "2px" }}>
                      {isWork ? <Briefcase size={14} color="var(--text-muted)" /> : <Home size={14} color="var(--text-muted)" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: "800" }}>{addrLabel}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "0.1rem" }}>{addrLine}</div>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteAddress(addr.id, e)}
                      style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: "0.2rem" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add Address Form */}
            <form onSubmit={handleAddAddress} style={{ borderTop: "1px solid var(--border-light)", paddingTop: "1rem" }}>
              <h4 style={{ fontSize: "0.78rem", fontWeight: "800", margin: "0 0 0.6rem" }}>Add New Address</h4>
              <div className="form-group" style={{ marginBottom: "0.6rem" }}>
                <label className="form-label" style={{ fontSize: "0.65rem" }}>Label</label>
                <select className="form-input" value={newAddrLabel} onChange={e => setNewAddrLabel(e.target.value)} style={{ padding: "0.35rem" }}>
                  <option value="Home">Home</option>
                  <option value="Office">Office</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: "0.75rem" }}>
                <label className="form-label" style={{ fontSize: "0.65rem" }}>Address Details</label>
                <textarea
                  className="form-input"
                  required
                  placeholder="Street name, apartment, city, pincode..."
                  value={newAddrVal}
                  onChange={e => setNewAddrVal(e.target.value)}
                  style={{ minHeight: "60px", padding: "0.4rem", fontSize: "0.75rem" }}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block" style={{ padding: "0.45rem", fontSize: "0.78rem" }}>
                Save & Use Address
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Profile Modal */}
      {showProfileModal && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowProfileModal(false)}>
          <div className="glass-card" onClick={e => e.stopPropagation()} style={{ width: "90%", maxWidth: "400px", padding: "1.5rem", borderRadius: "16px", animation: "popIn 0.2s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "800", margin: 0 }}>My Profile</h3>
              <button onClick={() => setShowProfileModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">First Name</label>
                  <input type="text" className="form-input" value={profileForm.first_name} onChange={e => setProfileForm({ ...profileForm, first_name: e.target.value })} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Last Name</label>
                  <input type="text" className="form-input" value={profileForm.last_name} onChange={e => setProfileForm({ ...profileForm, last_name: e.target.value })} />
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Phone Number</label>
                <input type="tel" maxLength={10} className="form-input" pattern="\d{10}" placeholder="9876543210" value={profileForm.phone} onChange={e => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 10) setProfileForm({ ...profileForm, phone: val }); }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Default Address</label>
                <textarea className="form-input" rows="3" value={profileForm.address} onChange={e => setProfileForm({ ...profileForm, address: e.target.value })} placeholder="Your primary delivery address..." />
              </div>
              <button type="submit" disabled={profileUpdating} className="btn btn-primary" style={{ marginTop: "0.5rem" }}>
                {profileUpdating ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: "2rem", right: "2rem",
          background: toast.type === "success" ? "rgba(16,185,129,0.95)" : "rgba(239,68,68,0.95)",
          backdropFilter: "blur(8px)", border: `1px solid ${toast.type === "success" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
          color: "#fff", padding: "0.85rem 1.5rem", borderRadius: "12px",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)", zIndex: 99999,
          fontWeight: 600, fontSize: "0.88rem", display: "flex",
          alignItems: "center", gap: "0.6rem"
        }}>
          <span style={{ fontSize: "1.1rem" }}>{toast.type === "success" ? "⚡" : "⚠"}</span>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", marginLeft: "1rem", opacity: 0.8, fontSize: "0.8rem", display: "flex", alignItems: "center" }}><X size={14} /></button>
        </div>
      )}

      </div>
    </div>
  );
}
