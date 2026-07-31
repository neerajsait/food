import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { api } from "../utils/api";
import { jsPDF } from "jspdf";
import {
  ShoppingCart, Clock, CheckCircle, Star, MessageSquare, X, Lock,
  Search, Minus, Plus, Heart, Leaf, Paperclip, Edit2,
  Sparkles, MapPin, Truck, RefreshCw, Home, Briefcase, PlusCircle, FileText, Trash2, ShoppingBag, LogOut, QrCode, User, Gift, ShieldAlert
} from "lucide-react";
import QRScanner from "./QRScanner";

// Category configuration
const CATEGORIES = [
  { id: "all", label: "All Products", emoji: "🏪", color: "#a855f7" },
  { id: "favs", label: "My Favorites", emoji: "❤️", color: "#ec4899" },
  { id: "Spice Powders", label: "Spice Powders", emoji: "🌶️", color: "#ef4444" },
  { id: "Pickles", label: "Pickles", emoji: "🥒", color: "#22c55e" },
  { id: "Snacks & Savories", label: "Snacks", emoji: "🍿", color: "#f59e0b" },
  { id: "Sweets & Treats", label: "Sweets", emoji: "🍬", color: "#ec4899" },
  { id: "Mixes & Instant", label: "Mixes", emoji: "🍲", color: "#3b82f6" },
  { id: "Special Products", label: "Specials", emoji: "⭐", color: "#8b5cf6" },
];

// Delivery address book templates
const DEFAULT_ADDRESSES = [
  { id: 1, title: "Home", address_line: "123 Food Street, Tasty City" },
  { id: 2, title: "Work", address_line: "456 Office Tower, Biz District" }
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
  const [tickets, setTickets] = useState([]);
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVeg, setFilterVeg] = useState(false);
  const [filterGlutenFree, setFilterGlutenFree] = useState(false);
  const [filterSpice, setFilterSpice] = useState("all");
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
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [activeCoupons, setActiveCoupons] = useState([]);

  // Product Scanner state
  const [isScanning, setIsScanning] = useState(false);

  // Inline Profile Editing
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", phone: "", address: "" });
  const [profileUpdating, setProfileUpdating] = useState(false);

  // Password Change Flow
  const [passwordForm, setPasswordForm] = useState({ old_password: "", otp: "", new_password: "" });
  const [otpRequested, setOtpRequested] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);

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


  const [banners, setBanners] = useState([]);
  const [popupBanner, setPopupBanner] = useState(null);
  const [showPopupBanner, setShowPopupBanner] = useState(false);
  const [storeSettings, setStoreSettings] = useState({});
  const [userProfile, setUserProfile] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const menuData = await api.getFoodsMenu();
      const ordersData = await api.getOrderHistory();
      const favsData = await api.getFavorites();
      const addrData = await api.getAddresses();

      try {
        const couponsData = await api.getActiveCoupons();
        setActiveCoupons(couponsData);
      } catch (e) {
        console.error("Failed to load active coupons", e);
      }

      const bannersData = await api.getPublicBanners().catch(() => []);
      const settingsData = await api.getPublicStoreSettings().catch(() => ({}));

      api.getCustomerTickets().then(setTickets).catch(() => { });

      // We don't have an authMe in api.js currently, skip it
      let profileData = null;

      setMenu(menuData);
      setOrders(ordersData);
      setFavorites(favsData.map(f => f.menu_item_id));
      setAddresses(addrData.length > 0 ? addrData : DEFAULT_ADDRESSES);
      
      const homeBanners = bannersData.filter(b => b.display_location !== "popup");
      const pBanner = bannersData.find(b => b.display_location === "popup");
      setBanners(homeBanners);
      if (pBanner && !sessionStorage.getItem("popupDismissed_" + pBanner.id)) {
        setPopupBanner(pBanner);
        setShowPopupBanner(true);
      }
      
      setStoreSettings(settingsData);
      setUserProfile(profileData);
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
      if (item.global_stock === 0) return false;
      const matchesCat =
        activeCategory === "all" ||
        (activeCategory === "favs" && favorites.includes(item.id)) ||
        item.category === activeCategory;
      const matchesSearch = !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.code && item.code.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesVeg = !filterVeg || item.is_veg;
      const matchesGluten = !filterGlutenFree || item.is_gluten_free;
      const matchesSpice = filterSpice === "all" || item.spice_level === filterSpice;
      return matchesCat && matchesSearch && matchesVeg && matchesGluten && matchesSpice;
    });
  }, [menu, activeCategory, searchQuery, favorites, filterVeg, filterGlutenFree, filterSpice]);

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
    if (storeSettings.is_store_online === "false") {
      alert("We're sorry, the store is currently offline. Please try again later.");
      return;
    }
    if (storeSettings.is_holiday === "true") {
      alert("We're currently on a holiday break. Please check back later!");
      return;
    }
    
    // Check minimum order value
    const minOrderStr = storeSettings.min_order_value;
    const minOrder = minOrderStr ? parseFloat(minOrderStr) : 0;
    if (getCartTotal() < minOrder) {
      alert(`Minimum order value is $${minOrder.toFixed(2)}. Please add more items to your cart.`);
      return;
    }
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

      const user = api.getCurrentUser();
      const pointsToRedeem = useLoyaltyPoints && user?.loyalty_points ? user.loyalty_points : 0;
      await api.placeOrder(items, addressStr, paymentMethod, appliedCoupon ? appliedCoupon.code : null, pointsToRedeem);
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
      setCheckoutAddress(newAddr.address_line);
      setNewAddrVal("");
      setNewAddrLabel("Home");
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

  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({ id: null, issue_type: "", description: "", order_id: null, attachment: null });

  const handleReportIssue = (orderId) => {
    setTicketForm({ id: null, issue_type: "", description: "", order_id: orderId, attachment: null });
    setIsTicketModalOpen(true);
  };

  const handleEditTicket = (ticket) => {
    setTicketForm({ id: ticket.id, issue_type: ticket.issue_type, description: ticket.description, order_id: ticket.order_id, attachment: null });
    setIsTicketModalOpen(true);
  };

  const handleDeleteTicket = async (id) => {
    if (!window.confirm("Are you sure you want to delete this ticket?")) return;
    try {
      await api.deleteTicket(id);
      alert("Ticket deleted successfully");
      api.getCustomerTickets().then(setTickets).catch(console.error);
    } catch (err) {
      alert("Failed to delete ticket: " + err.message);
    }
  };

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("issue_type", ticketForm.issue_type);
      formData.append("description", ticketForm.description);
      if (ticketForm.order_id) formData.append("order_id", ticketForm.order_id);
      if (ticketForm.attachment) formData.append("attachment", ticketForm.attachment);

      if (ticketForm.id) {
        await api.updateTicket(ticketForm.id, formData);
        alert("Ticket updated successfully!");
      } else {
        await api.createTicket(formData);
        alert("Support ticket created! We will get back to you soon.");
      }
      setIsTicketModalOpen(false);
      api.getCustomerTickets().then(setTickets).catch(console.error);
    } catch (err) {
      alert("Failed to save ticket: " + err.message);
    }
  };

  const addToCart = (itemId) => {
    if (storeSettings.is_store_online === "false") {
      alert("We're sorry, the store is currently offline. Please try again later.");
      return;
    }
    if (storeSettings.is_holiday === "true") {
      alert("We're currently on a holiday break. Please check back later!");
      return;
    }
    const item = menu.find(m => m.id === itemId);
    if (!item) return;
    const currentQty = cart[itemId] || 0;
    if (item.global_stock !== null && item.global_stock !== undefined && currentQty >= item.global_stock) {
      alert(`Cannot add more. Only ${item.global_stock} available in stock.`);
      return;
    }
    setCart(prev => ({ ...prev, [itemId]: currentQty + 1 }));
  };
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

  const openProfileEdit = () => {
    const user = api.getCurrentUser();
    if (user) {
      setProfileForm({
        first_name: user?.first_name || "",
        last_name: user?.last_name || "",
        phone: user?.phone || "",
        address: user?.address || ""
      });
      setIsEditingProfile(true);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileUpdating(true);
    try {
      await api.updateProfile(profileForm);
      alert("Profile updated successfully!");
      setIsEditingProfile(false);
    } catch (err) {
      alert("Failed to update profile: " + err.message);
    } finally {
      setProfileUpdating(false);
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setPasswordUpdating(true);
    try {
      await api.requestPasswordChangeOtp(passwordForm.old_password);
      setOtpRequested(true);
      alert("OTP sent to your email.");
    } catch (err) {
      alert("Failed to request OTP: " + err.message);
    } finally {
      setPasswordUpdating(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordUpdating(true);
    try {
      await api.changePassword(passwordForm.old_password, passwordForm.otp, passwordForm.new_password);
      alert("Password changed successfully!");
      setOtpRequested(false);
      setPasswordForm({ old_password: "", otp: "", new_password: "" });
      setIsEditingPassword(false);
    } catch (err) {
      alert("Failed to change password: " + err.message);
    } finally {
      setPasswordUpdating(false);
    }
  };

  const getOrderStatusStage = (status) => {
    switch (status) {
      case "pending": return 1;
      case "processing":
      case "ready": return 2;
      case "shipped": return 3;
      case "delivered":
      case "completed": return 4;
      default: return 1;
    }
  };

  const _currentSelectedAddress = addresses.find(a => a.id === selectedAddressId) || addresses[0];

  const catConfig = (catId) => CATEGORIES.find(c => c.id === catId) || { emoji: "📦", color: "#6b7280", label: catId };

  const user = api.getCurrentUser();
  const discountAmount = appliedCoupon ? (getCartTotal() * appliedCoupon.discount_pct / 100) : 0;
  const finalSubtotal = getCartTotal() - discountAmount;
  const deliveryCharge = storeSettings.delivery_fee !== undefined ? parseFloat(storeSettings.delivery_fee) : (getCartTotal() >= 499 ? 0 : 49);

  const loyaltyPoints = user?.loyalty_points || 0;
  const maxLoyaltyDiscount = loyaltyPoints / 100;
  const actualLoyaltyDiscount = useLoyaltyPoints ? Math.min(maxLoyaltyDiscount, finalSubtotal + deliveryCharge) : 0;

  const finalTotal = finalSubtotal + deliveryCharge - actualLoyaltyDiscount;

  return (
    <div style={{ maxWidth: "100%", minHeight: "100vh", position: "relative", background: "var(--bg-canvas)", color: "var(--text-primary)" }} className="animate-fade-in">
      {/* 🧭 Minimalist Header (Brand Colors) */}
      {/* 🧭 Minimalist Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 100, background: "var(--bg-canvas)", color: "var(--text-primary)", borderBottom: "none", padding: "1.25rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "900", fontFamily: "var(--font-heading)", color: "var(--text-primary)", letterSpacing: "-1px" }}>SUGGULA'S</h1>
        </div>

        {/* Center Links */}
        <div className="desktop-only" style={{ display: "flex", gap: "2.5rem", alignItems: "center", position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
          <button onClick={() => setActiveTab("menu")} style={{ background: "transparent", border: "none", color: activeTab === "menu" ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: activeTab === "menu" ? "700" : "500", fontSize: "0.95rem", cursor: "pointer", transition: "color 0.2s", textTransform: "uppercase", letterSpacing: "1px" }}>Menu</button>
          <button onClick={() => setActiveTab("orders")} style={{ background: "transparent", border: "none", color: activeTab === "orders" ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: activeTab === "orders" ? "700" : "500", fontSize: "0.95rem", cursor: "pointer", transition: "color 0.2s", textTransform: "uppercase", letterSpacing: "1px" }}>Orders</button>
          <button onClick={() => setActiveTab("tickets")} style={{ background: "transparent", border: "none", color: activeTab === "tickets" ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: activeTab === "tickets" ? "700" : "500", fontSize: "0.95rem", cursor: "pointer", transition: "color 0.2s", textTransform: "uppercase", letterSpacing: "1px" }}>Support</button>
        </div>

        {/* Right Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <button onClick={() => setActiveTab("profile")} style={{ background: "transparent", border: "none", color: activeTab === "profile" ? "var(--text-primary)" : "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "600", fontSize: "1rem", transition: "color 0.2s" }}>
            <User size={20} />
          </button>
          <button onClick={openCartDrawer} style={{ background: "transparent", border: "none", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "700", fontSize: "1rem", transition: "color 0.2s" }}>
            <ShoppingCart size={20} />
            {getCartCount() > 0 && <span style={{ background: "var(--text-primary)", color: "#ffffff", padding: "2px 6px", borderRadius: "50%", fontSize: "0.7rem", fontWeight: "900", marginLeft: "0.25rem" }}>{getCartCount()}</span>}
          </button>
        </div>
      </header>

      <main style={{ padding: "2rem", maxWidth: "var(--content-max-w)", margin: "0 auto" }}>
        {activeTab === "menu" && (
          <>
            {/* Hero Section */}
            <div style={{ padding: "4rem 0 3rem", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: "2rem" }}>
              <h2 style={{ fontSize: "3.5rem", fontWeight: "900", fontFamily: "var(--font-heading)", margin: "0 0 1rem", lineHeight: 1.1, color: "var(--text-primary)", letterSpacing: "-1px" }}>
                Authentic Recipes,<br/>Delivered.
              </h2>
              <p style={{ fontSize: "1.1rem", color: "var(--text-secondary)", maxWidth: "600px", margin: "0 auto 2.5rem", lineHeight: "1.6" }}>
                Experience the true taste of Andhra with our homemade pickles, spice powders, and traditional sweets.
              </p>
              <div style={{ position: "relative", width: "100%", maxWidth: "500px" }}>
                <Search size={20} style={{ position: "absolute", left: "1.25rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input 
                  type="text" 
                  placeholder="Search products..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: "100%", padding: "1.25rem 1.25rem 1.25rem 3.5rem", borderRadius: "8px", border: "1px solid var(--border-default)", fontSize: "1rem", outline: "none", color: "var(--text-primary)", background: "var(--bg-canvas)", transition: "border-color 0.2s" }}
                  onFocus={e => e.target.style.borderColor = "#000"}
                  onBlur={e => e.target.style.borderColor = "var(--border-default)"}
                />
              </div>
            </div>

            {/* Categories */}
            <div style={{ marginBottom: "3rem", display: "flex", justifyContent: "center" }}>
              <div style={{ display: "flex", gap: "1rem", overflowX: "auto", paddingBottom: "1rem", scrollbarWidth: "none", maxWidth: "100%" }}>
                {CATEGORIES.map(cat => (
                  <button 
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    style={{ 
                      flexShrink: 0,
                      display: "flex", alignItems: "center", gap: "0.5rem",
                      padding: "0.75rem 1.5rem", borderRadius: "4px",
                      background: activeCategory === cat.id ? "var(--brand)" : "transparent",
                      color: activeCategory === cat.id ? "#fff" : "var(--text-primary)",
                      border: activeCategory === cat.id ? "1px solid var(--brand)" : "1px solid var(--border-default)",
                      cursor: "pointer", transition: "all 0.2s",
                      fontWeight: "600", fontSize: "0.95rem"
                    }}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "3rem 2rem" }}>
              {Object.entries(groupedMenu).map(([catName, items]) => (
                <React.Fragment key={catName}>
                  {items.map(item => (
                    <div key={item.id} style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative", background: "transparent", border: "none" }}>
                      
                      {/* Product Image Placeholder */}
                      <div style={{ height: "300px", background: "var(--bg-hover)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: "1rem" }}>
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ fontSize: "5rem", opacity: 0.3 }}>{catConfig(item.category).emoji}</div>
                        )}
                        {/* New Badge */}
                        <div style={{ position: "absolute", top: "1rem", left: "1rem", background: "var(--text-primary)", color: "#fff", padding: "0.25rem 0.75rem", fontSize: "0.7rem", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>New</div>
                        
                        {/* Favorite Button */}
                        <button onClick={(e) => toggleFavorite(item.id, e)} style={{ position: "absolute", top: "1rem", right: "1rem", background: "rgba(255,255,255,0.9)", border: "none", width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: favorites.includes(item.id) ? "var(--text-primary)" : "var(--text-muted)", transition: "all 0.2s" }}>
                          <Heart fill={favorites.includes(item.id) ? "currentColor" : "none"} size={16} />
                        </button>
                      </div>

                      {/* Product Details */}
                      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "0.25rem" }}>
                          <h4 style={{ fontSize: "1.1rem", fontWeight: "700", margin: 0, fontFamily: "var(--font-heading)", color: "var(--text-primary)", lineHeight: 1.3 }}>{item.name}</h4>
                          <span style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--text-primary)" }}>₹{item.price.toFixed(0)}</span>
                        </div>
                        <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", margin: "0 0 1rem", flex: 1, lineHeight: 1.5 }}>
                          {item.description || "Authentic traditional recipe, made with the finest ingredients."}
                        </p>
                        
                        <div style={{ marginTop: "auto" }}>
                          {(cart[item.id] || 0) > 0 ? (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", border: "1px solid var(--text-primary)", borderRadius: "0", overflow: "hidden" }}>
                              <button onClick={() => removeFromCart(item.id)} style={{ background: "none", border: "none", color: "var(--text-primary)", padding: "0.75rem 1rem", cursor: "pointer", fontWeight: "bold" }}><Minus size={14}/></button>
                              <span style={{ padding: "0", fontWeight: "800", fontSize: "0.95rem", color: "var(--text-primary)" }}>{cart[item.id]} in basket</span>
                              <button onClick={() => addToCart(item.id)} style={{ background: "none", border: "none", color: "var(--text-primary)", padding: "0.75rem 1rem", cursor: "pointer", fontWeight: "bold" }}><Plus size={14}/></button>
                            </div>
                          ) : (
                            <button onClick={() => addToCart(item.id)} style={{ width: "100%", background: "transparent", color: "var(--text-primary)", border: "1px solid var(--text-primary)", padding: "0.75rem", fontWeight: "700", cursor: "pointer", transition: "all 0.2s" }} onMouseOver={e => {e.currentTarget.style.background="var(--text-primary)"; e.currentTarget.style.color="#fff"}} onMouseOut={e => {e.currentTarget.style.background="transparent"; e.currentTarget.style.color="var(--text-primary)"}}>
                              Add to Basket
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
            
            {filteredMenu.length === 0 && (
              <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
                <Search size={48} style={{ margin: "0 auto 1rem", opacity: 0.3 }} />
                <h3>No products found</h3>
                <p>Try adjusting your search or category filters.</p>
              </div>
            )}
          </>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <h2 style={{ fontSize: "2rem", fontWeight: "900", fontFamily: "var(--font-heading)", marginBottom: "2rem" }}>My Orders</h2>
            {orders.length === 0 ? (
              <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)", borderTop: "1px solid var(--border-light)" }}>
                <ShoppingBag size={48} style={{ margin: "0 auto 1rem", opacity: 0.3 }} />
                <h3>No orders yet</h3>
                <p>When you place an order, it will appear here.</p>
                <button onClick={() => setActiveTab("menu")} className="btn" style={{ background: "var(--text-primary)", color: "#fff", marginTop: "1rem" }}>Start Shopping</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--border-light)" }}>
                {orders.map(order => (
                  <div key={order.id} style={{ padding: "2rem 0", borderBottom: "1px solid var(--border-light)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                      <div>
                        <h4 style={{ margin: "0 0 0.25rem", fontSize: "1.1rem", fontWeight: "800" }}>Order #{order.id}</h4>
                        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{new Date(order.created_at).toLocaleString()}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
                        <span className={`badge-status status-${order.status}`} style={{ background: "transparent", border: "1px solid var(--text-primary)", color: "var(--text-primary)", borderRadius: "0" }}>{order.status}</span>
                        <span style={{ fontWeight: "900", fontSize: "1.2rem", color: "var(--text-primary)" }}>₹{parseFloat(order.total_price).toFixed(0)}</span>
                      </div>
                    </div>
                    <div>
                      {order.items.map((it, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", fontSize: "0.95rem" }}>
                          <span><span style={{ color: "var(--text-secondary)", marginRight: "0.5rem", fontWeight: "700" }}>{it.quantity}x</span> {it.menu_item_name}</span>
                          <span style={{ fontWeight: "700" }}>₹{(it.price * it.quantity).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                    {order.status === 'delivered' && !order.receipt_confirmed && (
                      <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px dashed var(--border-light)", display: "flex", gap: "0.5rem" }}>
                        <input type="text" placeholder="Tracking code" value={trackingCodes[order.id] || ""} onChange={e => setTrackingCodes({...trackingCodes, [order.id]: e.target.value})} className="form-input" style={{ flex: 1, background: "transparent" }} />
                        <button onClick={() => handleConfirmReceipt(order.id)} className="btn btn-success" style={{ background: "var(--text-primary)", color: "#fff", borderRadius: 0 }}>Confirm</button>
                      </div>
                    )}
                    <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.5rem" }}>
                      <button onClick={(e) => handleQuickReorder(order.items, e)} className="btn btn-outline" style={{ borderColor: "var(--text-primary)", color: "var(--text-primary)", borderRadius: 0, background: "transparent" }}>Reorder Items</button>
                      <button onClick={() => handleDownloadReceipt(order)} className="btn btn-secondary" style={{ background: "transparent", borderRadius: 0, borderColor: "var(--text-primary)", color: "var(--text-primary)" }}><FileText size={16}/> Invoice</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Support Tab */}
        {activeTab === "tickets" && (
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
              <h2 style={{ fontSize: "2rem", fontWeight: "900", fontFamily: "var(--font-heading)", margin: 0 }}>Support Tickets</h2>
              <button onClick={() => handleReportIssue(null)} className="btn" style={{ background: "var(--text-primary)", color: "#fff", borderRadius: "0", padding: "0.6rem 1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}><Plus size={16} /> New Ticket</button>
            </div>
            
            {tickets.length === 0 ? (
              <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)", borderTop: "1px solid var(--border-light)" }}>
                <MessageSquare size={48} style={{ margin: "0 auto 1rem", opacity: 0.3 }} />
                <h3>No support tickets</h3>
                <p>Need help? Create a new ticket and we'll get back to you.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--border-light)" }}>
                {tickets.map(t => (
                  <div key={t.id} style={{ padding: "2rem 0", borderBottom: "1px solid var(--border-light)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <h4 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "800" }}>{t.issue_type}</h4>
                      <span className={`badge-status status-${t.status === 'open' ? 'warning' : 'success'}`} style={{ background: "transparent", color: "var(--text-primary)", border: "1px solid var(--text-primary)", borderRadius: 0 }}>{t.status}</span>
                    </div>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: "0 0 1rem" }}>{t.description}</p>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "600" }}>{new Date(t.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 🛒 Checkout / Cart Drawer */}
      {showCartDrawer && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }} onClick={() => setShowCartDrawer(false)}>
          <div className="animate-slide-in-right" style={{ width: "100%", maxWidth: "450px", height: "100%", background: "var(--bg-canvas)", display: "flex", flexDirection: "column", boxShadow: "-5px 0 25px rgba(0,0,0,0.1)" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "1.5rem", background: "var(--bg-card)", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1.25rem", fontWeight: "900", margin: 0, fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>Your Basket</h3>
              <button onClick={() => setShowCartDrawer(false)} style={{ background: "var(--bg-hover)", border: "none", width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-primary)" }}><X size={18} /></button>
            </div>
            
            <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
              {getCartCount() === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-muted)" }}>
                  <ShoppingBag size={48} style={{ margin: "0 auto 1rem", opacity: 0.3 }} />
                  <h4>Your basket is empty</h4>
                  <p style={{ fontSize: "0.9rem" }}>Looks like you haven't added anything yet.</p>
                  <button onClick={() => setShowCartDrawer(false)} className="btn btn-primary" style={{ background: "var(--brand-pink)", marginTop: "1rem", borderRadius: "var(--r-full)" }}>Start Shopping</button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
                    {Object.entries(cart).map(([id, qty]) => {
                      const item = menu.find(m => m.id === parseInt(id));
                      if(!item) return null;
                      return (
                        <div key={id} style={{ display: "flex", gap: "1rem", background: "var(--bg-card)", padding: "1rem", borderRadius: "var(--r-md)", border: "1px solid var(--border-light)" }}>
                          <div style={{ width: "60px", height: "60px", borderRadius: "var(--r-sm)", background: "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>
                            {item.image_url ? <img src={item.image_url} style={{width:"100%", height:"100%", objectFit:"cover", borderRadius:"var(--r-sm)"}} /> : catConfig(item.category).emoji}
                          </div>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.95rem", fontWeight: "800", color: "var(--text-primary)" }}>{item.name}</h4>
                            <div style={{ fontSize: "0.95rem", fontWeight: "900", color: "var(--brand)" }}>₹{item.price.toFixed(0)}</div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.5rem" }}>
                              <div style={{ display: "flex", alignItems: "center", background: "var(--bg-canvas)", border: "1px solid var(--border-default)", borderRadius: "var(--r-full)" }}>
                                <button onClick={() => removeFromCart(item.id)} style={{ background: "none", border: "none", padding: "0.2rem 0.6rem", cursor: "pointer", fontWeight: "bold" }}><Minus size={12}/></button>
                                <span style={{ fontSize: "0.85rem", fontWeight: "800" }}>{qty}</span>
                                <button onClick={() => addToCart(item.id)} style={{ background: "none", border: "none", padding: "0.2rem 0.6rem", cursor: "pointer", fontWeight: "bold" }}><Plus size={12}/></button>
                              </div>
                              <button onClick={() => setCart(p => { const n={...p}; delete n[item.id]; return n; })} style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", fontSize: "0.8rem", fontWeight: "700" }}>Remove</button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Delivery Address */}
                  <div style={{ background: "var(--bg-card)", padding: "1.25rem", borderRadius: "var(--r-md)", border: "1px solid var(--border-light)", marginBottom: "1.5rem" }}>
                    <h4 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: "800", color: "var(--text-primary)" }}>Delivery Address</h4>
                    <select value={selectedAddressId || -1} onChange={e => {
                      const id = parseInt(e.target.value);
                      setSelectedAddressId(id);
                      const addr = addresses.find(a => a.id === id);
                      setCheckoutAddress(addr ? addr.address_line : "");
                    }} className="form-input" style={{ marginBottom: "0.5rem", background: "var(--bg-canvas)", border: "1px solid var(--border-default)" }}>
                      {addresses.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                      <option value="-1">Custom Address...</option>
                    </select>
                    <textarea value={checkoutAddress} onChange={e => { setCheckoutAddress(e.target.value); setSelectedAddressId(-1); }} className="form-input" rows="2" style={{ background: "var(--bg-canvas)", resize: "none", border: "1px solid var(--border-default)" }} placeholder="Enter full address..." />
                  </div>

                  {/* Payment Method */}
                  <div style={{ background: "var(--bg-card)", padding: "1.25rem", borderRadius: "var(--r-md)", border: "1px solid var(--border-light)", marginBottom: "1.5rem" }}>
                    <h4 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: "800", color: "var(--text-primary)" }}>Payment Method</h4>
                    <div style={{ display: "flex", gap: "0.5rem", flexDirection: "column" }}>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {["COD", "UPI", "CARD"].map(method => (
                          <button key={method} onClick={() => setPaymentMethod(method)} style={{ flex: 1, padding: "0.75rem 0", background: paymentMethod === method ? "var(--brand)" : "var(--bg-canvas)", color: paymentMethod === method ? "#fff" : "var(--text-primary)", border: paymentMethod === method ? "1px solid var(--brand)" : "1px solid var(--border-default)", borderRadius: "var(--r-sm)", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer", transition: "all 0.2s" }}>
                            {method}
                          </button>
                        ))}
                      </div>
                      
                      {paymentMethod === "CARD" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "1rem" }}>
                          <input type="text" className="form-input" placeholder="Cardholder Name" value={cardName} onChange={e => setCardName(e.target.value)} style={{ background: "var(--bg-canvas)" }}/>
                          <input type="text" className="form-input" placeholder="0000 0000 0000 0000" maxLength={19} value={cardNumber} onChange={e => { const v = e.target.value.replace(/\D/g,""); setCardNumber(v.match(/.{1,4}/g)?.join(" ") || ""); }} style={{ background: "var(--bg-canvas)" }}/>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                            <input type="text" className="form-input" placeholder="MM/YY" maxLength={5} value={cardExpiry} onChange={e => { let v = e.target.value.replace(/\D/g,""); if(v.length>2) v = v.substring(0,2)+"/"+v.substring(2); setCardExpiry(v); }} style={{ background: "var(--bg-canvas)" }}/>
                            <input type="password" className="form-input" placeholder="CVV" maxLength={3} value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g,""))} style={{ background: "var(--bg-canvas)" }}/>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Total Footer */}
            {getCartCount() > 0 && (
              <div style={{ padding: "1.5rem", background: "var(--bg-card)", borderTop: "1px solid var(--border-light)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.9rem", fontWeight: "600" }}>
                  <span>Subtotal</span><span>₹{getCartTotal().toFixed(0)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem", color: "var(--text-secondary)", fontSize: "0.9rem", fontWeight: "600" }}>
                  <span>Delivery</span><span>{deliveryCharge === 0 ? "FREE" : `₹${deliveryCharge}`}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem", fontWeight: "900", fontSize: "1.25rem", color: "var(--text-primary)" }}>
                  <span>Total</span><span style={{ color: "var(--text-primary)" }}>₹{finalTotal.toFixed(0)}</span>
                </div>
                <button onClick={handlePlaceOrder} disabled={paymentProcessing} className="btn btn-block" style={{ background: "var(--text-primary)", color: "#fff", padding: "1.25rem", fontSize: "1.1rem", borderRadius: "0", textTransform: "uppercase", letterSpacing: "2px", fontWeight: "800" }}>
                  {paymentProcessing ? "Processing..." : `Checkout ₹${finalTotal.toFixed(0)}`}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* 👤 Profile Tab */}
      {activeTab === "profile" && (
        <div className="animate-fade-in" style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div className="grid-responsive-profile">
            
            {/* Left Column: Profile Card */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div style={{ background: "transparent", borderBottom: "1px solid var(--border-default)", padding: "1.5rem 0", textAlign: "left" }}>
                <div style={{ width: "80px", height: "80px", borderRadius: "0", background: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", fontWeight: "900", color: "#fff", marginBottom: "1.5rem" }}>
                  {user?.first_name ? user.first_name[0].toUpperCase() : <User size={32} />}
                </div>
                <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.75rem", fontWeight: "900", fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>
                  {user?.first_name} {user?.last_name}
                </h2>
                <div style={{ fontSize: "1rem", color: "var(--text-secondary)", fontWeight: 500, marginBottom: "2rem" }}>{user?.email}</div>
              </div>

              {/* Security / Logout */}
              <div style={{ background: "transparent", padding: "1.5rem 0", borderBottom: "1px solid var(--border-default)" }}>
                <button onClick={async () => {
                  if(window.confirm("Are you sure you want to log out?")) {
                    api.logout(); window.location.reload();
                  }
                }} style={{ width: "100%", background: "transparent", border: "none", color: "var(--error)", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", fontSize: "1rem", padding: "0.5rem 0", transition: "all 0.2s" }} onMouseOver={e=>e.currentTarget.style.opacity="0.8"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>
                  <LogOut size={18} /> Sign Out
                </button>
              </div>
            </div>

            {/* Right Column: Loyalty & Details */}
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              
              {/* Loyalty Points Card */}
              <div style={{ background: "var(--text-primary)", borderRadius: "0", padding: "2.5rem", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "relative", zIndex: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <Sparkles size={20} color="#fff" />
                    <h4 style={{ margin: 0, fontSize: "1.1rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "800", opacity: 0.9 }}>Loyalty Balance</h4>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                    <div style={{ fontSize: "4.5rem", fontWeight: "900", fontFamily: "var(--font-heading)", lineHeight: 1 }}>{user?.loyalty_points || 0}</div>
                    <span style={{ fontSize: "1.5rem", fontWeight: "700", opacity: 0.8 }}>pts</span>
                  </div>
                  <p style={{ margin: "1rem 0 0", fontSize: "1rem", fontWeight: 500, opacity: 0.9 }}>Earn points on every order and save on future meals!</p>
                </div>
                <div style={{ background: "rgba(255,255,255,0.1)", width: "120px", height: "120px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 2 }}>
                  <Gift size={56} color="#fff" />
                </div>
              </div>

              {/* Information Display */}
              <div style={{ background: "transparent", borderRadius: "0", padding: "2.5rem 0", borderTop: "1px solid var(--border-default)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 2rem" }}>
                  <h3 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "900", fontFamily: "var(--font-heading)", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <FileText size={22} color="var(--text-primary)" /> Account Details
                  </h3>
                  {!isEditingProfile && (
                     <button onClick={openProfileEdit} className="hover-lift" style={{ background: "transparent", border: "1px solid var(--text-primary)", color: "var(--text-primary)", padding: "0.5rem 1.25rem", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}><Edit2 size={16}/> Edit</button>
                  )}
                </div>

                {!isEditingProfile ? (
                  <div className="grid-responsive-2col">
                    <div>
                      <div style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.5rem" }}>First Name</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: "600", color: "var(--text-primary)" }}>{user?.first_name || "Not provided"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Last Name</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: "600", color: "var(--text-primary)" }}>{user?.last_name || "Not provided"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Phone Number</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: "600", color: "var(--text-primary)" }}>{user?.phone || "Not provided"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Account Type</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: "600", color: "var(--text-primary)" }}>{user?.type === "customer" ? "Valued Customer" : user?.type}</div>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Default Delivery Address</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: "500", color: "var(--text-primary)", lineHeight: "1.6" }}>{user?.address || "No address provided yet."}</div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    <div className="grid-responsive-2col">
                      <div>
                        <div style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.5rem" }}>First Name</div>
                        <input type="text" value={profileForm.first_name} onChange={e => setProfileForm({...profileForm, first_name: e.target.value})} style={{ width: "100%", fontSize: "1.15rem", fontWeight: "600", color: "var(--text-primary)", background: "transparent", border: "none", borderBottom: "2px solid var(--text-primary)", padding: "0.25rem 0", outline: "none" }} />
                      </div>
                      <div>
                        <div style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Last Name</div>
                        <input type="text" value={profileForm.last_name} onChange={e => setProfileForm({...profileForm, last_name: e.target.value})} style={{ width: "100%", fontSize: "1.15rem", fontWeight: "600", color: "var(--text-primary)", background: "transparent", border: "none", borderBottom: "2px solid var(--text-primary)", padding: "0.25rem 0", outline: "none" }} />
                      </div>
                      <div>
                        <div style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Phone Number</div>
                        <input type="tel" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} style={{ width: "100%", fontSize: "1.15rem", fontWeight: "600", color: "var(--text-primary)", background: "transparent", border: "none", borderBottom: "2px solid var(--text-primary)", padding: "0.25rem 0", outline: "none" }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Default Delivery Address</div>
                      <textarea value={profileForm.address} onChange={e => setProfileForm({...profileForm, address: e.target.value})} style={{ width: "100%", fontSize: "1.15rem", fontWeight: "500", color: "var(--text-primary)", background: "transparent", border: "none", borderBottom: "2px solid var(--text-primary)", padding: "0.25rem 0", outline: "none", resize: "none" }} rows="2" />
                    </div>
                    <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                      <button type="submit" disabled={profileUpdating} className="hover-lift" style={{ background: "var(--brand)", color: "#fff", border: "none", padding: "0.75rem 1.5rem", fontWeight: "800", cursor: "pointer", fontSize: "1rem" }}>{profileUpdating ? "Saving..." : "Save Details"}</button>
                      <button type="button" onClick={() => setIsEditingProfile(false)} className="hover-lift" style={{ background: "transparent", color: "var(--text-primary)", border: "1px solid var(--text-primary)", padding: "0.75rem 1.5rem", fontWeight: "700", cursor: "pointer", fontSize: "1rem" }}>Cancel</button>
                    </div>
                  </form>
                )}
              </div>

              {/* Address Book Section */}
              <div style={{ background: "transparent", borderRadius: "0", padding: "2.5rem 0", borderTop: "1px solid var(--border-default)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 2rem" }}>
                  <h3 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "900", fontFamily: "var(--font-heading)", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <MapPin size={22} color="var(--text-primary)" /> Address Book
                  </h3>
                  {!showAddressManager && (
                     <button onClick={() => setShowAddressManager(true)} className="hover-lift" style={{ background: "transparent", border: "1px solid var(--text-primary)", color: "var(--text-primary)", padding: "0.5rem 1.25rem", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}><Plus size={16}/> Add New</button>
                  )}
                </div>

                {!showAddressManager ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "1.5rem" }}>
                    {addresses.map(addr => (
                      <div key={addr.id} style={{ padding: "1.5rem", border: "1px solid var(--border-default)", display: "flex", flexDirection: "column", gap: "0.5rem", background: "var(--bg-canvas)" }}>
                        <div style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "800", color: "var(--text-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          {addr.title}
                          <button onClick={(e) => handleDeleteAddress(addr.id, e)} style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", padding: "0.25rem" }}><Trash2 size={16} /></button>
                        </div>
                        <div style={{ fontSize: "1rem", fontWeight: "500", color: "var(--text-secondary)", lineHeight: "1.5" }}>{addr.address_line}</div>
                      </div>
                    ))}
                    {addresses.length === 0 && (
                      <div style={{ gridColumn: "1 / -1", padding: "2rem", textAlign: "center", border: "1px dashed var(--border-default)", color: "var(--text-muted)" }}>
                        No addresses saved yet. Add one for quicker checkout!
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleAddAddress} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
                      <div>
                        <div style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Label (e.g., Home, Work)</div>
                        <input type="text" required value={newAddrLabel} onChange={e => setNewAddrLabel(e.target.value)} style={{ width: "100%", fontSize: "1.15rem", fontWeight: "600", color: "var(--text-primary)", background: "transparent", border: "none", borderBottom: "2px solid var(--text-primary)", padding: "0.25rem 0", outline: "none" }} />
                      </div>
                      <div>
                        <div style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Full Address</div>
                        <textarea required value={newAddrVal} onChange={e => setNewAddrVal(e.target.value)} style={{ width: "100%", fontSize: "1.15rem", fontWeight: "500", color: "var(--text-primary)", background: "transparent", border: "none", borderBottom: "2px solid var(--text-primary)", padding: "0.25rem 0", outline: "none", resize: "none" }} rows="3" />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
                      <button type="submit" className="hover-lift" style={{ background: "var(--brand)", color: "#fff", border: "none", padding: "0.75rem 1.5rem", fontWeight: "800", cursor: "pointer", fontSize: "1rem" }}>Save Address</button>
                      <button type="button" onClick={() => { setShowAddressManager(false); setNewAddrVal(""); }} className="hover-lift" style={{ background: "transparent", color: "var(--text-primary)", border: "1px solid var(--text-primary)", padding: "0.75rem 1.5rem", fontWeight: "700", cursor: "pointer", fontSize: "1rem" }}>Cancel</button>
                    </div>
                  </form>
                )}
              </div>

              {/* Password Section */}
              <div style={{ background: "transparent", borderRadius: "0", padding: "2.5rem 0", borderTop: "1px solid var(--border-default)" }}>
                <h3 style={{ margin: "0 0 2rem", fontSize: "1.5rem", fontWeight: "900", fontFamily: "var(--font-heading)", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <Lock size={22} color="var(--text-primary)" /> Security
                </h3>
                
                {!isEditingPassword ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Password</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: "600", color: "var(--text-primary)", letterSpacing: "4px" }}>••••••••</div>
                    </div>
                    <button onClick={() => { setIsEditingPassword(true); setPasswordForm({ old_password: "", otp: "", new_password: "" }); setOtpRequested(false); }} className="hover-lift" style={{ background: "transparent", border: "1px solid var(--text-primary)", color: "var(--text-primary)", fontWeight: "700", cursor: "pointer", padding: "0.5rem 1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}><Edit2 size={16}/> Change Password</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {!otpRequested ? (
                      <form onSubmit={handleRequestOtp} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                        <div>
                          <div style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Current Password</div>
                          <input type="password" required value={passwordForm.old_password} onChange={e => setPasswordForm({...passwordForm, old_password: e.target.value})} style={{ width: "100%", fontSize: "1.15rem", fontWeight: "600", color: "var(--text-primary)", background: "transparent", border: "none", borderBottom: "2px solid var(--text-primary)", padding: "0.25rem 0", outline: "none" }} />
                        </div>
                        <div style={{ display: "flex", gap: "1rem" }}>
                          <button type="submit" disabled={passwordUpdating} className="hover-lift" style={{ background: "var(--brand-pink)", padding: "0.75rem 1.5rem", border: "none", color: "#fff", fontSize: "1rem", fontWeight: "700", cursor: "pointer" }}>{passwordUpdating ? "Requesting..." : "Send OTP"}</button>
                          <button type="button" onClick={() => setIsEditingPassword(false)} className="hover-lift" style={{ background: "transparent", color: "var(--text-primary)", border: "1px solid var(--text-primary)", padding: "0.75rem 1.5rem", fontWeight: "700", cursor: "pointer", fontSize: "1rem" }}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                        <div>
                          <div style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Enter OTP from Email</div>
                          <input type="text" placeholder="6-digit OTP" required value={passwordForm.otp} onChange={e => setPasswordForm({...passwordForm, otp: e.target.value})} style={{ width: "100%", fontSize: "1.5rem", fontWeight: "600", color: "var(--text-primary)", background: "transparent", border: "none", borderBottom: "2px solid var(--text-primary)", padding: "0.25rem 0", outline: "none", letterSpacing: "4px" }} />
                        </div>
                        <div>
                          <div style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "0.5rem" }}>New Password</div>
                          <input type="password" required value={passwordForm.new_password} onChange={e => setPasswordForm({...passwordForm, new_password: e.target.value})} style={{ width: "100%", fontSize: "1.15rem", fontWeight: "600", color: "var(--text-primary)", background: "transparent", border: "none", borderBottom: "2px solid var(--text-primary)", padding: "0.25rem 0", outline: "none" }} />
                        </div>
                        <div style={{ display: "flex", gap: "1rem" }}>
                          <button type="submit" disabled={passwordUpdating} className="hover-lift" style={{ background: "var(--brand-pink)", padding: "0.75rem 1.5rem", border: "none", color: "#fff", fontSize: "1rem", fontWeight: "700", cursor: "pointer" }}>{passwordUpdating ? "Updating..." : "Verify & Change Password"}</button>
                          <button type="button" onClick={() => { setOtpRequested(false); setIsEditingPassword(false); }} className="hover-lift" style={{ background: "transparent", color: "var(--text-primary)", border: "1px solid var(--text-primary)", padding: "0.75rem 1.5rem", fontWeight: "700", cursor: "pointer", fontSize: "1rem" }}>Cancel</button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Ticket Modal */}
      {isTicketModalOpen && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(4px)" }}>
          <div className="glass-card" style={{ padding: "2rem", width: "100%", maxWidth: "500px", borderRadius: "var(--r-xl)", position: "relative" }}>
            <button onClick={() => setIsTicketModalOpen(false)} style={{ position: "absolute", top: "1rem", right: "1rem", background: "var(--bg-hover)", border: "none", borderRadius: "50%", padding: "0.5rem", cursor: "pointer", color: "var(--text-primary)" }}>
              <X size={18} />
            </button>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", fontWeight: 900, marginBottom: "1.5rem", color: "var(--text-primary)" }}>
              {ticketForm.id ? "Edit Ticket" : "New Ticket"}
            </h2>
            <form onSubmit={handleTicketSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <input type="text" className="form-input" required value={ticketForm.issue_type} onChange={e => setTicketForm({ ...ticketForm, issue_type: e.target.value })} placeholder="Issue Summary" style={{ background: "var(--bg-canvas)" }} />
              <textarea className="form-input" required rows="4" value={ticketForm.description} onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })} placeholder="Details of the issue..." style={{ background: "var(--bg-canvas)", resize: "none" }} />
              <button type="submit" className="btn btn-primary" style={{ background: "var(--brand)", marginTop: "1rem", padding: "1rem", borderRadius: "var(--r-full)" }}>
                {ticketForm.id ? "Update Ticket" : "Submit Ticket"}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Dynamic Popup Banner */}
      {showPopupBanner && popupBanner && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }} onClick={() => { setShowPopupBanner(false); sessionStorage.setItem("popupDismissed_" + popupBanner.id, "true"); }}>
          <div className="glass-card" onClick={e => e.stopPropagation()} style={{ width: "90%", maxWidth: "400px", padding: "2rem", borderRadius: "var(--r-xl)", position: "relative", textAlign: "center" }}>
            <button onClick={() => { setShowPopupBanner(false); sessionStorage.setItem("popupDismissed_" + popupBanner.id, "true"); }} style={{ position: "absolute", top: "1rem", right: "1rem", background: "rgba(0,0,0,0.1)", border: "none", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-primary)" }}><X size={16}/></button>
            <Sparkles size={48} color="var(--brand-pink)" style={{ margin: "0 auto 1rem" }} />
            <h2 style={{ fontSize: "1.75rem", fontWeight: "900", fontFamily: "var(--font-heading)", margin: "0 0 1rem", color: "var(--text-primary)" }}>{popupBanner.title}</h2>
            {popupBanner.image_url && <img src={popupBanner.image_url} style={{ width: "100%", borderRadius: "var(--r-md)", marginBottom: "1rem" }}/>}
            <button onClick={() => { setShowPopupBanner(false); sessionStorage.setItem("popupDismissed_" + popupBanner.id, "true"); if(popupBanner.target_url) window.location.href=popupBanner.target_url; }} className="btn btn-primary btn-block" style={{ background: "var(--brand-pink)", padding: "1rem", borderRadius: "var(--r-full)", fontSize: "1.1rem" }}>Explore Now</button>
          </div>
        </div>,
        document.body
      )}

      {/* Toasts */}
      {toast && (
        <div style={{ position: "fixed", bottom: "2rem", right: "2rem", background: toast.type === "success" ? "var(--brand)" : "var(--error)", color: "#fff", padding: "1rem 1.5rem", borderRadius: "var(--r-md)", boxShadow: "0 10px 30px rgba(0,0,0,0.2)", zIndex: 99999, fontWeight: "700", display: "flex", alignItems: "center", gap: "1rem" }}>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", display: "flex" }}><X size={16}/></button>
        </div>
      )}
      
    </div>
  );
}
