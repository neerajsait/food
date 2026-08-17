import React, { useState, useEffect, useMemo } from "react";
import { api, API_BASE_URL } from "../utils/api";
import { jsPDF } from "jspdf";
import { X, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { createPortal } from "react-dom";
import QRScanner from "./QRScanner";
import BannerZone from "./BannerZone";


// New design components
import Header, { MobileHeader } from "./Header";
import DesktopSidebar from "./DesktopSidebar";
import BottomNav from "./BottomNav";
import HomePage from "./HomePage";
import ShopPage from "./ShopPage";
import ProductDetailPage from "./ProductDetailPage";
import CartPage from "./CartPage";
import CheckoutPage from "./CheckoutPage";
import OrdersPage from "./OrdersPage";
import ProfilePage from "./ProfilePage";
import WishlistPage from "./WishlistPage";
import SupportPage from "./SupportPage";


// ────────────────────────────────────────────────────────────
// Defaults
// ────────────────────────────────────────────────────────────
const DEFAULT_ADDRESSES = [
  { id: "default-1", label: "Home", address_line: "123 Food Street, Tasty City" },
  { id: "default-2", label: "Work", address_line: "456 Office Tower, Biz District" },
];

// ────────────────────────────────────────────────────────────
// Toast portal
// ────────────────────────────────────────────────────────────
function ToastPortal({ toast, onDismiss }) {
  if (!toast) return null;
  const isError = toast.type === "error";
  const isWarn  = toast.type === "warning";
  const Icon    = isError ? XCircle : isWarn ? AlertCircle : CheckCircle;
  const cls     = isError ? "toast-error" : isWarn ? "toast-warning" : "toast-success";

  return createPortal(
    <div className="toast-container">
      <div className={`toast ${cls}`} role="alert">
        <Icon size={18} />
        <span style={{ flex: 1 }}>{toast.message}</span>
        <button onClick={onDismiss} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", opacity: 0.75, padding: "0 0 0 0.375rem", display: "flex" }}>
          <X size={14} />
        </button>
      </div>
    </div>,
    document.body
  );
}

// ────────────────────────────────────────────────────────────
// Confirm modal
// ────────────────────────────────────────────────────────────
function ConfirmModal({ modal, onClose }) {
  if (!modal) return null;
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign: "center", padding: "2rem 1.5rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.875rem" }}>⚠️</div>
          <p style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text)", marginBottom: "0.5rem" }}>Are you sure?</p>
          <p style={{ fontSize: "0.875rem", color: "var(--text-2)", lineHeight: 1.6 }}>{modal.message}</p>
        </div>
        <div className="modal-footer" style={{ justifyContent: "center" }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger btn-sm" onClick={() => { modal.onConfirm(); onClose(); }}>Confirm</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ────────────────────────────────────────────────────────────
// Store status banner
// ────────────────────────────────────────────────────────────
function StoreBanner({ storeSettings }) {
  if (storeSettings.is_store_online === "false") {
    return <div className="store-banner store-banner-offline">We are currently offline. Orders are temporarily paused.</div>;
  }
  if (storeSettings.is_holiday === "true") {
    return <div className="store-banner store-banner-holiday">🎉 We're on a holiday break. Please check back soon!</div>;
  }
  return null;
}

// ────────────────────────────────────────────────────────────
// Main CustomerView (router shell)
// ────────────────────────────────────────────────────────────
export default function CustomerView({ onLogout, dbMode }) {
  // ── Toast + Confirm helpers ──────────────────────────────
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const showAlert = (msg) => {
    setToast({
      message: msg,
      type: (msg.toLowerCase().includes("fail") || msg.toLowerCase().includes("error") || msg.toLowerCase().includes("offline"))
        ? "error" : "success",
    });
  };

  // Override global alert for compatibility with legacy handlers
  const alert = showAlert;
  const confirm = (message, onConfirm) => setConfirmModal({ message, onConfirm });

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    document.body.style.overflow = confirmModal ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [confirmModal]);

  // ── Core navigation state ────────────────────────────────
  const [activeTab, setActiveTab] = useState("home");
  const [selectedItem, setSelectedItem] = useState(null); // product detail view

  // ── Data state ───────────────────────────────────────────
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [banners, setBanners] = useState([]);
  const [middleBanners, setMiddleBanners] = useState([]);
  const [bottomBanners, setBottomBanners] = useState([]);
  const [checkoutBanners, setCheckoutBanners] = useState([]);
  const [popupBanner, setPopupBanner] = useState(null);
  const [showPopupBanner, setShowPopupBanner] = useState(false);
  const [storeSettings, setStoreSettings] = useState({});
  const [liveUser, setLiveUser] = useState(api.getCurrentUser());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Filter state ─────────────────────────────────────────
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // ── Address state ────────────────────────────────────────
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showAddressManager, setShowAddressManager] = useState(false);
  const [newAddrLabel, setNewAddrLabel] = useState("Home");
  const [newAddrVal, setNewAddrVal] = useState("");
  const [checkoutAddress, setCheckoutAddress] = useState("");

  // ── Payment state ────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // ── Cart state ───────────────────────────────────────────
  const [cart, setCart] = useState({});

  // ── Coupon & loyalty ─────────────────────────────────────
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [activeCoupons, setActiveCoupons] = useState([]);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);

  // ── Tracking & feedback ──────────────────────────────────
  const [trackingCodes, setTrackingCodes] = useState({});
  const [feedbackRatings, setFeedbackRatings] = useState({});
  const [feedbackComments, setFeedbackComments] = useState({});

  // ── Profile editing ──────────────────────────────────────
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", phone: "", address: "" });
  const [profileUpdating, setProfileUpdating] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ old_password: "", otp: "", new_password: "" });
  const [otpRequested, setOtpRequested] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);

  // ── QR Scanner ───────────────────────────────────────────
  const [isScanning, setIsScanning] = useState(false);

  // ────────────────────────────────────────────────────────────
  // Data loading
  // ────────────────────────────────────────────────────────────
  const loadData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError("");
    try {
      const [menuData, ordersData, favsData, addrData] = await Promise.all([
        api.getFoodsMenu(),
        api.getOrderHistory(),
        api.getFavorites(),
        api.getAddresses(),
      ]);

      try { const c = await api.getActiveCoupons(); setActiveCoupons(c); } catch {}

      const bannersData = await api.getPublicBanners().catch(() => []);
      const settingsData = await api.getPublicStoreSettings().catch(() => ({}));

      api.refreshUser().then(u => { if (u) setLiveUser(u); }).catch(() => {});
      api.getCustomerTickets().then(setTickets).catch(() => {});
      api.getCustomerReviews().then(setMyReviews).catch(() => {});

      setMenu(menuData);
      setOrders(ordersData);
      setFavorites(favsData.map(f => f.menu_item_id));
      setAddresses(addrData.length > 0 ? addrData : DEFAULT_ADDRESSES);

      const topBanners   = bannersData.filter(b => ["home", "home_top"].includes(b.display_location));
      const midBanners   = bannersData.filter(b => b.display_location === "home_middle");
      const botBanners   = bannersData.filter(b => b.display_location === "home_bottom");
      const chkBanners   = bannersData.filter(b => b.display_location === "checkout");
      const pBanner      = bannersData.find(b => ["popup", "popup_after_login"].includes(b.display_location));

      setBanners(topBanners);
      setMiddleBanners(midBanners);
      setBottomBanners(botBanners);
      setCheckoutBanners(chkBanners);

      if (pBanner && !sessionStorage.getItem("popupDismissed_" + pBanner.id)) {
        setPopupBanner(pBanner);
        setShowPopupBanner(true);
      }
      setStoreSettings(settingsData);

      if (!selectedAddressId && (addrData.length > 0 ? addrData : DEFAULT_ADDRESSES).length > 0) {
        const firstAddr = (addrData.length > 0 ? addrData : DEFAULT_ADDRESSES)[0];
        setSelectedAddressId(firstAddr.id);
        setCheckoutAddress(firstAddr.address_line);
      }
    } catch (err) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(false), 15000);
    return () => clearInterval(interval);
  }, []);

  // ────────────────────────────────────────────────────────────
  // Cart helpers
  // ────────────────────────────────────────────────────────────
  const addToCart = (itemId) => {
    if (storeSettings.is_store_online === "false") { alert("Store is currently offline."); return; }
    if (storeSettings.is_holiday === "true")       { alert("We're on a holiday break."); return; }
    const item = menu.find(m => m.id === itemId);
    if (!item) return;
    const currentQty = cart[itemId] || 0;
    if (item.global_stock != null && currentQty >= item.global_stock) {
      alert(`Only ${item.global_stock} available in stock.`);
      return;
    }
    setCart(prev => ({ ...prev, [itemId]: currentQty + 1 }));
  };

  const removeFromCart = (itemId) => {
    setCart(prev => {
      const next = { ...prev };
      if ((next[itemId] || 0) <= 1) delete next[itemId];
      else next[itemId] -= 1;
      return next;
    });
  };

  const clearCartItem = (itemId) => setCart(prev => { const next = { ...prev }; delete next[itemId]; return next; });

  const getCartCount = () => Object.values(cart).reduce((s, q) => s + q, 0);
  const getCartTotal = () => Object.entries(cart).reduce((s, [id, qty]) => {
    const item = menu.find(m => m.id === parseInt(id));
    return s + (item ? item.price * qty : 0);
  }, 0);

  // ────────────────────────────────────────────────────────────
  // Derived pricing
  // ────────────────────────────────────────────────────────────
  const user = liveUser || api.getCurrentUser();
  const loyaltyPoints     = user?.loyalty_points || 0;
  const redeemRate        = parseFloat(storeSettings.loyalty_redeem_rate || "0.01");
  const discountAmount    = appliedCoupon ? (getCartTotal() * appliedCoupon.discount_pct / 100) : 0;
  const finalSubtotal     = getCartTotal() - discountAmount;
  const deliveryFeeRaw    = storeSettings.delivery_fee;
  const deliveryCharge    = deliveryFeeRaw !== undefined ? parseFloat(deliveryFeeRaw) : (getCartTotal() >= 499 ? 0 : 49);
  const maxLoyaltyDiscount = loyaltyPoints * redeemRate;
  const actualLoyaltyDiscount = useLoyaltyPoints ? Math.min(maxLoyaltyDiscount, finalSubtotal + deliveryCharge) : 0;
  const finalTotal        = finalSubtotal + deliveryCharge - actualLoyaltyDiscount;

  // ────────────────────────────────────────────────────────────
  // Handlers
  // ────────────────────────────────────────────────────────────
  const toggleFavorite = async (itemId, e) => {
    e?.stopPropagation?.();
    const isFav = favorites.includes(itemId);
    setFavorites(prev => isFav ? prev.filter(id => id !== itemId) : [...prev, itemId]);
    try {
      if (isFav) await api.removeFavorite(itemId);
      else       await api.addFavorite(itemId);
    } catch {
      setFavorites(prev => !isFav ? prev.filter(id => id !== itemId) : [...prev, itemId]);
      alert("Failed to update wishlist");
    }
  };

  const openCartDrawer = () => {
    const defaultAddr = addresses.find(a => a.id === selectedAddressId) || addresses[0];
    if (defaultAddr) { setSelectedAddressId(defaultAddr.id); setCheckoutAddress(defaultAddr.address_line); }
    setActiveTab("checkout");
  };

  const handlePlaceOrder = async () => {
    if (storeSettings.is_store_online === "false") { alert("Store is currently offline."); return; }
    if (storeSettings.is_holiday === "true")       { alert("We're on a holiday break."); return; }

    const minOrder = parseFloat(storeSettings.min_order_value || "0");
    if (getCartTotal() < minOrder) { alert(`Minimum order value is ₹${minOrder.toFixed(0)}.`); return; }

    const items = Object.entries(cart).map(([id, qty]) => ({ menu_item_id: parseInt(id), quantity: qty }));
    if (!items.length) return;
    if (!checkoutAddress.trim()) { alert("Please select or add a delivery address."); return; }

    if (paymentMethod === "CARD") {
      if (!cardName.trim()) { alert("Please enter cardholder name."); return; }
      const raw = cardNumber.replace(/\s+/g, "");
      if (!/^\d{16}$/.test(raw)) { alert("Please enter a valid 16-digit card number."); return; }
      if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) { alert("Please enter expiry in MM/YY format."); return; }
      if (!/^\d{3}$/.test(cardCvv)) { alert("Please enter a valid 3-digit CVV."); return; }
    }

    setPaymentProcessing(true);
    try {
      if (paymentMethod !== "COD") await new Promise(r => setTimeout(r, 1500));
      const pointsToRedeem = useLoyaltyPoints && user?.loyalty_points ? user.loyalty_points : 0;
      await api.placeOrder(items, checkoutAddress.trim(), paymentMethod, appliedCoupon?.code || null, pointsToRedeem, deliveryCharge);

      setCart({});
      setAppliedCoupon(null); setCouponCodeInput(""); setUseLoyaltyPoints(false);
      setCardNumber(""); setCardExpiry(""); setCardCvv(""); setCardName("");
      setPaymentMethod("COD"); setCheckoutAddress("");
      setActiveTab("orders");
      api.refreshUser().then(u => { if (u) setLiveUser(u); }).catch(() => {});
      loadData();
      alert("Order placed successfully! Your order is being prepared. 🎉");
    } catch (err) {
      alert("Order failed: " + err.message);
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleApplyCoupon = async (codeOverride) => {
    const code = (typeof codeOverride === "string" ? codeOverride : couponCodeInput).trim();
    if (!code) return;
    setCouponError("");
    try {
      const coupon = await api.validateCoupon(code);
      setAppliedCoupon(coupon);
      setCouponCodeInput("");
      alert(`Coupon "${coupon.code}" applied! ${coupon.discount_pct}% off`);
    } catch (err) {
      setCouponError(err.message || "Invalid coupon");
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
      setCheckoutAddress(newAddr.address_line);
      setNewAddrVal(""); setNewAddrLabel("Home"); setShowAddressManager(false);
      alert("Address saved!");
    } catch { alert("Failed to add address"); }
  };

  const handleDeleteAddress = async (id, e) => {
    e?.stopPropagation?.();
    try {
      if (typeof id !== "string" || !id.toString().startsWith("default")) {
        await api.deleteAddress(id);
      }
      setAddresses(prev => prev.filter(a => a.id !== id));
      if (selectedAddressId === id) {
        const remaining = addresses.filter(a => a.id !== id);
        setSelectedAddressId(remaining[0]?.id || null);
      }
    } catch { alert("Failed to delete address"); }
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

  const handleCancelOrder = async (orderId) => {
    confirm("Are you sure you want to cancel this order?", async () => {
      try {
        await api.cancelOrder(orderId);
        loadData();
        const u = await api.refreshUser();
        if (u) setLiveUser(u);
        alert("Order cancelled successfully.");
      } catch (err) { alert("Error: " + err.message); }
    });
  };

  const handleDownloadReceipt = (order) => {
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      let y = 20;
      doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(21, 148, 71);
      doc.text("SUGGULA'S KITCHEN", 20, y);
      doc.setFontSize(10); doc.setTextColor(100, 100, 100); doc.setFont("helvetica", "normal");
      doc.text("Homemade Indian Foods", 20, y + 6);
      y += 22;
      doc.setFontSize(16); doc.setTextColor(40, 40, 40); doc.setFont("helvetica", "bold");
      doc.text("CUSTOMER INVOICE", 20, y); y += 10;
      doc.setFontSize(11); doc.setFont("helvetica", "normal");
      doc.text(`Order #${order.id}`, 20, y);
      doc.text(`Date: ${new Date(order.created_at).toLocaleString()}`, 110, y); y += 6;
      doc.text(`Status: ${order.status.toUpperCase()}`, 20, y);
      doc.text(`Payment: ${order.payment_method || "COD"}`, 110, y); y += 15;
      
      doc.setFont("helvetica", "bold");
      doc.text("Item", 20, y); doc.text("Qty", 120, y); doc.text("Price", 145, y); doc.text("Total", 175, y); y += 2;
      doc.setDrawColor(200, 200, 200); doc.line(20, y, 190, y); y += 8;
      
      doc.setFont("helvetica", "normal");
      let subtotal = 0;
      order.items?.forEach(it => {
        const itemTotal = it.price * it.quantity;
        subtotal += itemTotal;
        const splitName = doc.splitTextToSize(it.menu_item_name, 90);
        doc.text(splitName, 20, y); 
        doc.text(`${it.quantity}`, 120, y); 
        doc.text(`Rs. ${parseFloat(it.price).toFixed(2)}`, 145, y); 
        doc.text(`Rs. ${itemTotal.toFixed(2)}`, 175, y); 
        y += (splitName.length * 6) + 2;
      });
      
      y += 2; doc.line(110, y, 190, y); y += 8;
      
      const delivery = order.delivery_charge || 0;
      const grandTotal = parseFloat(order.total_price);
      let discount = (subtotal + delivery) - grandTotal;
      if (discount < 0.01) discount = 0;
      
      doc.text("Subtotal:", 145, y); doc.text(`Rs. ${subtotal.toFixed(2)}`, 175, y); y += 6;
      doc.text("Delivery Charge:", 145, y); doc.text(`Rs. ${delivery.toFixed(2)}`, 175, y); y += 6;
      
      if (discount > 0) {
        doc.setTextColor(220, 53, 69);
        doc.text("Discount:", 145, y); doc.text(`-Rs. ${discount.toFixed(2)}`, 175, y); y += 6;
        doc.setTextColor(40, 40, 40);
      }
      
      y += 2; doc.line(110, y, 190, y); y += 8;
      doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text("Grand Total:", 145, y); doc.text(`Rs. ${grandTotal.toFixed(2)}`, 175, y);
      
      y += 20; doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(150, 150, 150);
      doc.text("Thank you for choosing Suggula's Kitchen!", 105, y, { align: "center" });
      doc.save(`Invoice_Order_${order.id}.pdf`);
      alert("Invoice downloaded!");
    } catch (err) { alert("Failed: " + err.message); }
  };

  const handleSubmitFeedback = async (orderId) => {
    const rating  = feedbackRatings[orderId]  || 5;
    const comment = feedbackComments[orderId] || "";
    try {
      await api.submitFeedback(orderId, rating, comment);
      loadData(); alert("Thank you for your feedback! 🙏");
    } catch (err) { alert("Feedback failed: " + err.message); }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault(); setProfileUpdating(true);
    try {
      await api.updateProfile(profileForm);
      alert("Profile updated successfully!");
      setIsEditingProfile(false);
    } catch (err) { alert("Failed: " + err.message); } finally { setProfileUpdating(false); }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault(); setPasswordUpdating(true);
    try {
      await api.requestPasswordChangeOtp(passwordForm.old_password);
      setOtpRequested(true); alert("OTP sent to your email.");
    } catch (err) { alert("Failed: " + err.message); } finally { setPasswordUpdating(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault(); setPasswordUpdating(true);
    try {
      await api.changePassword(passwordForm.old_password, passwordForm.otp, passwordForm.new_password);
      alert("Password changed successfully!");
      setOtpRequested(false); setPasswordForm({ old_password: "", otp: "", new_password: "" }); setIsEditingPassword(false);
    } catch (err) { alert("Failed: " + err.message); } finally { setPasswordUpdating(false); }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure? This is irreversible.")) return;
    try { await api.deleteAccount(); alert("Account deleted."); window.location.reload(); }
    catch (err) { alert("Failed: " + err.message); }
  };

  const handleDeleteMyReview = (id) => {
    confirm("Delete this review?", async () => {
      try { await api.deleteCustomerReview(id); setMyReviews(prev => prev.filter(r => r.id !== id)); alert("Review deleted."); }
      catch (err) { alert("Failed: " + err.message); }
    });
  };

  const handleCreateTicket = async (formData) => {
    await api.createTicket(formData);
    alert("Support ticket submitted! We'll get back to you soon.");
    api.getCustomerTickets().then(setTickets).catch(() => {});
  };

  const handleDeleteTicket = (id) => {
    confirm("Delete this ticket?", async () => {
      try { await api.deleteTicket(id); setTickets(prev => prev.filter(t => t.id !== id)); alert("Ticket deleted."); }
      catch (err) { alert("Failed: " + err.message); }
    });
  };

  const handleReportIssue = (orderId) => {
    setActiveTab("tickets");
  };

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────
  const cartCount = getCartCount();

  const commonProductProps = {
    menu, cart, favorites,
    onAdd: addToCart, onRemove: removeFromCart,
    onToggleFav: toggleFavorite,
    onItemClick: (item) => setSelectedItem(item),
  };

  const renderPage = () => {
    // Product detail overlay
    if (selectedItem) {
      return (
        <ProductDetailPage
          {...commonProductProps}
          item={selectedItem}
          cartQty={cart[selectedItem.id] || 0}
          isFav={favorites.includes(selectedItem.id)}
          onBack={() => setSelectedItem(null)}
        />
      );
    }

    switch (activeTab) {
      case "home":
        return (
          <HomePage
            {...commonProductProps}
            banners={banners}
            loading={loading}
            setActiveTab={setActiveTab}
            setActiveCategory={setActiveCategory}
          />
        );

      case "shop":
        return (
          <ShopPage
            {...commonProductProps}
            loading={loading}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            searchQuery={searchQuery}
          />
        );

      case "checkout":
      case "cart":
        return (
          <CartPage
            {...commonProductProps}
            addresses={addresses}
            selectedAddressId={selectedAddressId}
            onClearItem={clearCartItem}
            couponCodeInput={couponCodeInput}
            setCouponCodeInput={setCouponCodeInput}
            appliedCoupon={appliedCoupon}
            onApplyCoupon={handleApplyCoupon}
            onRemoveCoupon={() => { setAppliedCoupon(null); setCouponCodeInput(""); }}
            couponError={couponError}
            activeCoupons={activeCoupons}
            useLoyaltyPoints={useLoyaltyPoints}
            setUseLoyaltyPoints={setUseLoyaltyPoints}
            loyaltyPoints={loyaltyPoints}
            maxLoyaltyDiscount={maxLoyaltyDiscount}
            finalSubtotal={finalSubtotal}
            deliveryCharge={deliveryCharge}
            finalTotal={finalTotal}
            discountAmount={discountAmount}
            actualLoyaltyDiscount={actualLoyaltyDiscount}
            storeSettings={storeSettings}
            checkoutBanners={checkoutBanners}
            onCheckout={() => setActiveTab("checkout-flow")}
          />
        );

      case "checkout-flow":
        return (
          <CheckoutPage
            cart={cart} menu={menu}
            addresses={addresses}
            selectedAddressId={selectedAddressId} setSelectedAddressId={setSelectedAddressId}
            checkoutAddress={checkoutAddress} setCheckoutAddress={setCheckoutAddress}
            newAddrVal={newAddrVal} setNewAddrVal={setNewAddrVal}
            newAddrLabel={newAddrLabel} setNewAddrLabel={setNewAddrLabel}
            showAddressManager={showAddressManager} setShowAddressManager={setShowAddressManager}
            onAddAddress={handleAddAddress} onDeleteAddress={handleDeleteAddress}
            paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
            cardNumber={cardNumber} setCardNumber={setCardNumber}
            cardExpiry={cardExpiry} setCardExpiry={setCardExpiry}
            cardCvv={cardCvv} setCardCvv={setCardCvv}
            cardName={cardName} setCardName={setCardName}
            appliedCoupon={appliedCoupon} onRemoveCoupon={() => setAppliedCoupon(null)}
            couponCodeInput={couponCodeInput} setCouponCodeInput={setCouponCodeInput}
            onApplyCoupon={handleApplyCoupon} couponError={couponError} activeCoupons={activeCoupons}
            useLoyaltyPoints={useLoyaltyPoints} setUseLoyaltyPoints={setUseLoyaltyPoints}
            loyaltyPoints={loyaltyPoints} maxLoyaltyDiscount={maxLoyaltyDiscount}
            finalSubtotal={finalSubtotal} deliveryCharge={deliveryCharge} finalTotal={finalTotal}
            discountAmount={discountAmount} actualLoyaltyDiscount={actualLoyaltyDiscount}
            paymentProcessing={paymentProcessing} onPlaceOrder={handlePlaceOrder}
            storeSettings={storeSettings} checkoutBanners={checkoutBanners}
          />
        );

      case "orders":
        return (
          <OrdersPage
            orders={orders}
            trackingCodes={trackingCodes} setTrackingCodes={setTrackingCodes}
            onConfirmReceipt={handleConfirmReceipt}
            onCancel={handleCancelOrder}
            onFeedback={handleSubmitFeedback}
            feedbackRatings={feedbackRatings} feedbackComments={feedbackComments}
            setFeedbackRatings={setFeedbackRatings} setFeedbackComments={setFeedbackComments}
            onReport={handleReportIssue}
            onDownload={handleDownloadReceipt}
            setActiveTab={setActiveTab}
          />
        );

      case "wishlist":
        return (
          <WishlistPage
            {...commonProductProps}
            setActiveTab={setActiveTab}
          />
        );

      case "tickets":
        return (
          <SupportPage
            tickets={tickets}
            onCreateTicket={handleCreateTicket}
            onEditTicket={() => {}}
            onDeleteTicket={handleDeleteTicket}
            orders={orders}
          />
        );

      case "profile":
        return (
          <ProfilePage
            user={user}
            isEditingProfile={isEditingProfile} setIsEditingProfile={setIsEditingProfile}
            profileForm={profileForm} setProfileForm={setProfileForm}
            handleUpdateProfile={handleUpdateProfile} profileUpdating={profileUpdating}
            isEditingPassword={isEditingPassword} setIsEditingPassword={setIsEditingPassword}
            passwordForm={passwordForm} setPasswordForm={setPasswordForm}
            otpRequested={otpRequested}
            handleRequestOtp={handleRequestOtp}
            handleChangePassword={handleChangePassword}
            passwordUpdating={passwordUpdating}
            addresses={addresses}
            selectedAddressId={selectedAddressId} setSelectedAddressId={setSelectedAddressId}
            setCheckoutAddress={setCheckoutAddress}
            newAddrVal={newAddrVal} setNewAddrVal={setNewAddrVal}
            newAddrLabel={newAddrLabel} setNewAddrLabel={setNewAddrLabel}
            showAddressManager={showAddressManager} setShowAddressManager={setShowAddressManager}
            handleAddAddress={handleAddAddress} handleDeleteAddress={handleDeleteAddress}
            myReviews={myReviews} handleDeleteMyReview={handleDeleteMyReview}
            loyaltyPoints={loyaltyPoints}
            storeSettings={storeSettings}
            onDeleteAccount={handleDeleteAccount}
            onLogout={onLogout}
          />
        );

      default:
        return (
          <HomePage
            {...commonProductProps}
            banners={banners} loading={loading}
            setActiveTab={setActiveTab}
            setActiveCategory={setActiveCategory}
          />
        );
    }
  };

  return (
    <div className="app-shell">
      {/* Toast */}
      <ToastPortal toast={toast} onDismiss={() => setToast(null)} />
      {/* Confirm */}
      <ConfirmModal modal={confirmModal} onClose={() => setConfirmModal(null)} />

      {/* Popup banner */}
      {showPopupBanner && popupBanner && (
        <div className="modal-overlay" style={{ zIndex: 600 }} onClick={() => { setShowPopupBanner(false); sessionStorage.setItem("popupDismissed_" + popupBanner.id, "1"); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{popupBanner.title}</span>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setShowPopupBanner(false); sessionStorage.setItem("popupDismissed_" + popupBanner.id, "1"); }}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {popupBanner.image_url && <img src={popupBanner.image_url} alt={popupBanner.title} style={{ width: "100%", borderRadius: "var(--radius-lg)", marginBottom: "1rem" }} />}
              {popupBanner.description && <p style={{ color: "var(--text-2)", fontSize: "0.9rem" }}>{popupBanner.description}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <DesktopSidebar
        activeTab={activeTab}
        setActiveTab={(tab) => { setSelectedItem(null); setActiveTab(tab); }}
        cartCount={cartCount}
        onLogout={onLogout}
      />

      {/* Main content area */}
      <div className="desk-main">
        {/* Store status banner */}
        <StoreBanner storeSettings={storeSettings} />

        {/* Desktop header */}
        <Header
          activeTab={activeTab}
          setActiveTab={(tab) => { setSelectedItem(null); setActiveTab(tab); }}
          cartCount={cartCount}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenCart={openCartDrawer}
        />

        {/* Mobile header */}
        <MobileHeader
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          cartCount={cartCount}
          setActiveTab={(tab) => { setSelectedItem(null); setActiveTab(tab); }}
          onOpenCart={openCartDrawer}
        />

        {/* Error */}
        {error && (
          <div className="alert alert-error" style={{ margin: "1rem 1.5rem", borderRadius: "var(--radius-md)" }}>
            ⚠️ {error}
            <button onClick={loadData} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700, fontFamily: "inherit" }}>Retry</button>
          </div>
        )}

        {/* Page content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {renderPage()}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={(tab) => { setSelectedItem(null); setActiveTab(tab); }}
        cartCount={cartCount}
        onOpenCart={openCartDrawer}
      />
    </div>
  );
}
