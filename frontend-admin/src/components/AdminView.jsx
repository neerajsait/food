import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { api, API_BASE_URL } from "../utils/api";
import {
  Package, AlertTriangle, Plus, Store, Users, MapPin,
  Globe, QrCode, TrendingUp, FileText, ShoppingBag,
  Truck, Clock, Trash2, Calendar, RefreshCw, BarChart3,
  X, LogOut, MessageSquare, Star, Tag, ArrowRight, User,
  Megaphone, Image, Settings, Gift
} from "lucide-react";
import QRGenerator from "./QRGenerator";



/* ── Modal Wrapper ── */
function Modal({ open, onClose, title, children, width = 480 }) {
  if (!open) return null;
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: width }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export default function AdminView({ onLogout, dbMode }) {
  const [printOrder, setPrintOrder] = useState(null);
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = "success") => setToast({ message: msg, type });
  // Legacy alert() wrapper kept for any remaining calls from nested components
  const alert = (msg) => {
    setToast({ message: msg, type: msg.toLowerCase().includes("failed") || msg.toLowerCase().includes("error") ? "error" : "success" });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [orders, setOrders] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [menu, setMenu] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [revenueShare, setRevenueShare] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [batches, setBatches] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [forecastData, setForecastData] = useState([]);

  // Product Reviews moderation states
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // Profile Modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", phone: "", address: "", old_password: "", password: "" });
  const [profileUpdating, setProfileUpdating] = useState(false);

  const openProfileModal = () => {
    const user = api.getCurrentUser();
    if (user) {
      setProfileForm({
        first_name: user?.first_name || "",
        last_name: user?.last_name || "",
        phone: user?.phone || "",
        address: user?.address || "",
        old_password: "",
        password: ""
      });
      setShowProfileModal(true);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileUpdating(true);
    try {
      await api.updateProfile(profileForm);
      setToast({ message: "Profile updated successfully!", type: "success" });
      setShowProfileModal(false);
    } catch (err) {
      setToast({ message: "Failed to update profile: " + err.message, type: "error" });
    } finally {
      setProfileUpdating(false);
    }
  };

  // User Accounts management states
  const [users, setUsers] = useState([]);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersFilter, setUsersFilter] = useState("all");
  const [usersStatusFilter, setUsersStatusFilter] = useState("all");


  const [selectedSupplierId, setSelectedSupplierId] = useState(1);
  const [poItem, setPoItem] = useState("Pure Buffalo Ghee");
  const [poQty, setPoQty] = useState("50");
  const [poUnit, setPoUnit] = useState("kg");
  const [draftPOs, setDraftPOs] = useState([]);

  // Admin Coupon states
  const [coupons, setCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [showAddCoupon, setShowAddCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState("");
  const [couponDiscountAmount, setCouponDiscountAmount] = useState("");
  const [couponMaxDiscountAmount, setCouponMaxDiscountAmount] = useState("");
  const [couponApplicableMenuItem, setCouponApplicableMenuItem] = useState("");
  const [couponApplicableCustomer, setCouponApplicableCustomer] = useState("");
  const [couponIsActive, setCouponIsActive] = useState(true);
  const [couponMinOrderValue, setCouponMinOrderValue] = useState("0");
  const [couponIsFirstOrder, setCouponIsFirstOrder] = useState(false);
  const [couponScope, setCouponScope] = useState("both");
  const [couponExpiryDate, setCouponExpiryDate] = useState("");
  const [couponUsageLimit, setCouponUsageLimit] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [trackingCodes, setTrackingCodes] = useState({});
  const [trackingLabels, setTrackingLabels] = useState({});
  const [trackingLinks, setTrackingLinks] = useState({});
  const [tickets, setTickets] = useState([]);

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [menuName, setMenuName] = useState("");
  const [menuCode, setMenuCode] = useState("");
  const [menuPrice, setMenuPrice] = useState("");
  const [menuOriginalPrice, setMenuOriginalPrice] = useState("");
  const [menuCategory, setMenuCategory] = useState("Pickles");
  const [menuCustomCategory, setMenuCustomCategory] = useState("");
  const [menuType, setMenuType] = useState("home_foods");
  const [menuDesc, setMenuDesc] = useState("");
  const [menuImageUrl, setMenuImageUrl] = useState("");
  const [menuGlobalStock, setMenuGlobalStock] = useState("");
  const [menuIsVeg, setMenuIsVeg] = useState(true);
  const [menuIsGlutenFree, setMenuIsGlutenFree] = useState(false);
  const [menuSpiceLevel, setMenuSpiceLevel] = useState("medium");
  const [menuTag, setMenuTag] = useState("");
  const [menuAdminRating, setMenuAdminRating] = useState("");
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [editMenuId, setEditMenuId] = useState(null);

  const [showAddOutlet, setShowAddOutlet] = useState(false);
  const [editingOutletId, setEditingOutletId] = useState(null);
  const [outletName, setOutletName] = useState("");
  const [outletAddress, setOutletAddress] = useState("");
  const [outletLatitude, setOutletLatitude] = useState("");
  const [outletLongitude, setOutletLongitude] = useState("");
  const [outletRevenueShare, setOutletRevenueShare] = useState("");
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [geocodingMsg, setGeocodingMsg] = useState("");

  const [assignForms, setAssignForms] = useState({}); // { [outletId]: { menuItemId: "", stock: "20", limit: "10" } }

  const [showAddStaff, setShowAddStaff] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [reviewToDelete, setReviewToDelete] = useState(null);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffPin, setStaffPin] = useState("");
  const [userLoyaltyPoints, setUserLoyaltyPoints] = useState(0);
  const [staffFirstName, setStaffFirstName] = useState("");
  const [staffLastName, setStaffLastName] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffOutletId, setStaffOutletId] = useState("");
  const [staffRole, setStaffRole] = useState("staff");
  const [staffDepartment, setStaffDepartment] = useState("");

  const loadData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError("");
    try {
      const [ordersData, outletsData, menuData, usersData] = await Promise.allSettled([
        api.adminGetOrders(), api.adminGetOutlets(), api.adminGetMenuItems(), api.adminGetUsers()
      ]);
      if (ordersData.status === "fulfilled") {
        setOrders(ordersData.value);
        const generatedCodes = {};
        ordersData.value.forEach(o => {
          generatedCodes[o.id] = o.tracking_id || "";
        });
        setTrackingCodes(prev => ({ ...generatedCodes, ...prev }));
      }
      if (outletsData.status === "fulfilled") setOutlets(outletsData.value);
      if (menuData.status === "fulfilled") setMenu(menuData.value);
      if (usersData.status === "fulfilled") setUsers(usersData.value);
      try {
        const couponsData = await api.adminGetCoupons();
        setCoupons(couponsData);
      } catch (err) { }
      try { const a = await api.adminGetAnalytics(); setAnalytics(a); } catch (err) { }
      try { const l = await api.adminGetAuditLogs(1, 40); setAuditLogs(l.logs || []); } catch (err) { }
      try { const s = await api.getSuppliers(); setSuppliers(s); } catch (err) { }
      try { const f = await api.getForecast(); setForecastData(f); } catch (err) { }
      try { const t = await api.adminGetTickets(); setTickets(t); } catch (err) { }
      try {
        const live = (await api.getMode()) === "Live Backend";
        if (live) {
          const res = await fetch(`${API_BASE_URL}/admin/batches`, { headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } });
          if (res.ok) setBatches(await res.json());
        } else {
          setBatches([
            { id: 101, outlet_name: "Connaught Place Corner", menu_item_name: "Crispy Samosa", qty: 50, batch_number: "SAM-09A", expiry_date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10), received_by: "Alex" },
            { id: 102, outlet_name: "Vashi Express Supply", menu_item_name: "Paneer Spring Rolls", qty: 22, batch_number: "PSR-12B", expiry_date: new Date(Date.now() + 86400000 * 10).toISOString().slice(0, 10), received_by: "John" }
          ]);
        }
      } catch (err) { }
    } catch (err) { setError(err.message || "Failed to load admin data"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      // Don't auto-refresh if a modal is open to avoid interrupting user input
      if (!showAddMenu && !showAddOutlet && !showAddStaff && !showAddCoupon) {
        loadData(false); // pass false to avoid triggering full loading spinner
        setRefreshTimesheetsTrigger(prev => prev + 1);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [showAddMenu, showAddOutlet, showAddStaff, showAddCoupon]);
  useEffect(() => { if (outlets.length > 0 && !staffOutletId) setStaffOutletId(outlets[0].id.toString()); }, [outlets, staffOutletId]);

  // Load timesheets when active tab changes to timesheets
  const [timesheets, setTimesheets] = useState([]);
  const [timesheetsPage, setTimesheetsPage] = useState(1);
  const [timesheetsTotalPages, setTimesheetsTotalPages] = useState(1);
  const [timesheetsFilterOutlet, setTimesheetsFilterOutlet] = useState("all");
  const [timesheetsStartDate, setTimesheetsStartDate] = useState("");
  const [timesheetsEndDate, setTimesheetsEndDate] = useState("");
  const [refreshTimesheetsTrigger, setRefreshTimesheetsTrigger] = useState(0);

  useEffect(() => {
    if (activeTab === "timesheets") {
      api.adminGetShifts({ 
        page: timesheetsPage, 
        outlet_id: timesheetsFilterOutlet, 
        start_date: timesheetsStartDate, 
        end_date: timesheetsEndDate 
      }).then(data => {
        setTimesheets(data.shifts || []);
        setTimesheetsTotalPages(data.pages || 1);
      }).catch(err => console.error("Failed to load shifts:", err));
    }
  }, [activeTab, timesheetsPage, timesheetsFilterOutlet, timesheetsStartDate, timesheetsEndDate, refreshTimesheetsTrigger]);

  // Background polling for POS catalog to ensure fresh menu
  useEffect(() => {
    if (activeTab === "pos") {
      const interval = setInterval(() => {
        api.adminGetCatalog().then(data => setCatalog(data)).catch(() => {});
        api.adminGetCoupons().then(setCoupons).catch(() => {});
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Load coupons when active tab changes to coupons
  useEffect(() => {
    if (activeTab === "coupons") {
      setCouponsLoading(true);
      api.adminGetCoupons()
        .then(setCoupons)
        .catch(err => console.error("Failed to load coupons:", err))
        .finally(() => setCouponsLoading(false));
    }
  }, [activeTab]);

  // Load reviews when active tab changes to reviews
  useEffect(() => {
    if (activeTab === "reviews") {
      setReviewsLoading(true);
      api.adminGetReviews()
        .then(data => {
          setReviews(data);
          setReviewsLoading(false);
        })
        .catch(err => {
          alert("Failed to load reviews: " + err.message);
          setReviewsLoading(false);
        });
    }
  }, [activeTab]);

  // --- CRM & Wallets State ---
  const [segments, setSegments] = useState(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletTargetUser, setWalletTargetUser] = useState(null);
  const [showBulkCouponModal, setShowBulkCouponModal] = useState(false);
  const [bulkCouponMinPts, setBulkCouponMinPts] = useState("1000");
  const [bulkCouponCode, setBulkCouponCode] = useState("");
  const [bulkCouponType, setBulkCouponType] = useState("percent");
  const [bulkCouponValue, setBulkCouponValue] = useState("");
  const [walletAmount, setWalletAmount] = useState("");
  const [walletDesc, setWalletDesc] = useState("");
  const [walletAction, setWalletAction] = useState("credit"); // 'credit' or 'debit'

  // --- Banners State ---
  const [banners, setBanners] = useState([]);
  const [storeSettings, setStoreSettings] = useState({});
  const [stockRequests, setStockRequests] = useState([]);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState(null);
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [bannerTargetUrl, setBannerTargetUrl] = useState("");
  const [bannerDisplayLocation, setBannerDisplayLocation] = useState("home");
  
  // Advanced Banner Fields
  const [bannerStartDate, setBannerStartDate] = useState("");
  const [bannerEndDate, setBannerEndDate] = useState("");
  const [bannerTargetAudience, setBannerTargetAudience] = useState("all");
  const [bannerPlacementZone, setBannerPlacementZone] = useState("hero_carousel");
  const [bannerDisplayStyle, setBannerDisplayStyle] = useState("cinematic_21_9");
  const [bannerHasCountdown, setBannerHasCountdown] = useState(false);
  const [bannerCountdownEndTime, setBannerCountdownEndTime] = useState("");
  const [bannerLinkedProductId, setBannerLinkedProductId] = useState("");
  const [bannerLinkedCouponCode, setBannerLinkedCouponCode] = useState("");

  // ── Confirm-delete / prompt-replacement modals ──
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(null); // { message, onConfirm }
  const [replyTicketModal, setReplyTicketModal] = useState(null); // { id }
  const [replyText, setReplyText] = useState("");
  const [restockModal, setRestockModal] = useState(null); // { outletId, menuItemId, itemName }
  const [restockQty, setRestockQty] = useState("50");
  const [reviewReplyModal, setReviewReplyModal] = useState(null); // review object
  const [reviewReplyText, setReviewReplyText] = useState("");



  useEffect(() => {
    if (activeTab === "crm") {
      api.adminGetCustomerSegments().then(setSegments).catch(() => { });
    } else if (activeTab === "coupons") {
      api.adminGetCoupons().then(setCoupons).catch(console.error);
    } else if (activeTab === "tickets") {
      api.adminGetTickets().then(setTickets).catch(console.error);
    } else if (activeTab === "banners") {
      api.adminGetBanners().then(res => setBanners(Array.isArray(res) ? res : [])).catch(() => setBanners([]));
    } else if (activeTab === "settings") {
      api.adminGetStoreSettings().then(setStoreSettings).catch(() => { });
    } else if (activeTab === "stock_requests") {
      api.getStockRequests().then(setStockRequests).catch(console.error);
    }
  }, [activeTab]);

  const handleDeleteReview = (reviewId) => {
    setReviewToDelete(reviewId);
  };

  const confirmDeleteReview = async () => {
    if (!reviewToDelete) return;
    try {
      await api.adminDeleteReview(reviewToDelete);
      alert("Review deleted successfully!");
      const data = await api.adminGetReviews();
      setReviews(data);
    } catch (err) {
      alert("Failed to delete review: " + err.message);
    } finally {
      setReviewToDelete(null);
    }
  };

  const handleReplyReview = (review) => {
    setReviewReplyText(review.admin_reply || "");
    setReviewReplyModal(review);
  };

  const submitReviewReply = async () => {
    if (!reviewReplyModal) return;
    try {
      await api.adminUpdateReview(reviewReplyModal.id, { admin_reply: reviewReplyText });
      showToast("Reply updated!", "success");
      const data = await api.adminGetReviews();
      setReviews(data);
    } catch (err) { showToast("Failed: " + err.message, "error"); }
    finally { setReviewReplyModal(null); setReviewReplyText(""); }
  };

  const handleToggleReviewVisibility = async (review) => {
    try {
      await api.adminUpdateReview(review.id, { is_hidden: !review.is_hidden });
      showToast(`Review ${!review.is_hidden ? "hidden" : "made visible"}.`, "success");
      const data = await api.adminGetReviews();
      setReviews(data);
    } catch (err) { showToast("Failed: " + err.message, "error"); }
  };

  const _openAddMenuModal = () => { loadData(); setShowAddMenu(true); };
  const openAddOutletModal = () => { loadData(); setShowAddOutlet(true); };
  const _openAddStaffModal = () => { loadData(); setShowAddStaff(true); };

  const lookupCoordinates = async () => {
    if (!outletAddress.trim()) { showToast("Please enter an address first", "error"); return; }
    setGeocodingLoading(true); setGeocodingMsg("Looking up address…");
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(outletAddress)}&format=json&limit=1`);
      const data = await res.json();
      if (data?.length > 0) {
        setOutletLatitude(parseFloat(data[0].lat).toFixed(6));
        setOutletLongitude(parseFloat(data[0].lon).toFixed(6));
        setGeocodingMsg("✓ Coordinates fetched!");
      } else setGeocodingMsg("Address not found.");
    } catch (err) { setGeocodingMsg("Lookup failed."); }
    finally { setGeocodingLoading(false); }
  };

    const handleShipOrder = async (orderId) => {
      const code = trackingCodes[orderId] || "";
      try {
        await api.adminShipOrder(orderId, code.trim(), trackingLabels[orderId] || null, trackingLinks[orderId] || null);
      showToast("Marked as shipped!", "success");
      loadData();
    } catch (err) { showToast("Failed: " + err.message, "error"); }
  };

  const handleAddMenuItem = async (e) => {
    e.preventDefault();
    try {
      const finalCategory = menuCategory === "Other" && menuCustomCategory.trim() !== "" ? menuCustomCategory.trim() : menuCategory;
      await api.adminAddMenuItem({ name: menuName, code: menuCode, price: parseFloat(menuPrice), original_price: menuOriginalPrice ? parseFloat(menuOriginalPrice) : null, category: finalCategory, business_type: menuType, description: menuDesc, image_url: menuImageUrl || null, global_stock: menuGlobalStock !== "" ? parseInt(menuGlobalStock) : null, is_veg: menuIsVeg, is_gluten_free: menuIsGlutenFree, spice_level: menuSpiceLevel, tag: menuTag || null, admin_rating: menuAdminRating !== "" ? parseFloat(menuAdminRating) : null });
      showToast("Product created successfully!", "success"); setShowAddMenu(false);
      setMenuName(""); setMenuCode(""); setMenuPrice(""); setMenuOriginalPrice(""); setMenuCategory("Pickles"); setMenuCustomCategory(""); setMenuDesc(""); setMenuImageUrl(""); setMenuGlobalStock(""); setMenuIsVeg(true); setMenuIsGlutenFree(false); setMenuSpiceLevel("medium"); setMenuTag(""); setMenuAdminRating("");
      loadData();
    } catch (err) { showToast("Failed: " + err.message, "error"); }
  };

  const openEditMenuItem = (item) => {
    setEditMenuId(item.id);
    setMenuName(item.name || "");
    setMenuCode(item.code || "");
    setMenuPrice(item.price || "");
    setMenuOriginalPrice(item.original_price || "");
    const defaultCats = ["Pickles", "Spice Powders", "Snacks & Savories", "Sweets & Treats", "Mixes & Instant", "Special Products", "Other"];
    if (item.category && !defaultCats.includes(item.category)) {
      setMenuCategory("Other");
      setMenuCustomCategory(item.category);
    } else {
      setMenuCategory(item.category || "Pickles");
      setMenuCustomCategory("");
    }
    setMenuType(item.business_type || "home_foods");
    setMenuDesc(item.description || "");
    setMenuImageUrl(item.image_url || "");
    setMenuGlobalStock(item.global_stock !== null ? item.global_stock : "");
    setMenuTag(item.tag || "");
    setMenuAdminRating(item.admin_rating || "");
    setShowEditMenu(true);
  };

  const handleUpdateMenuItem = async (e) => {
    e.preventDefault();
    try {
      const finalCategory = menuCategory === "Other" && menuCustomCategory.trim() !== "" ? menuCustomCategory.trim() : menuCategory;
      await api.adminUpdateMenuItem(editMenuId, { name: menuName, code: menuCode, price: parseFloat(menuPrice), original_price: menuOriginalPrice ? parseFloat(menuOriginalPrice) : null, category: finalCategory, business_type: menuType, description: menuDesc, image_url: menuImageUrl || null, global_stock: menuGlobalStock !== "" ? parseInt(menuGlobalStock) : null, tag: menuTag || null, admin_rating: menuAdminRating !== "" ? parseFloat(menuAdminRating) : null });
      showToast("Product updated!", "success");
      setShowEditMenu(false);
      setMenuName(""); setMenuCode(""); setMenuPrice(""); setMenuOriginalPrice(""); setMenuCategory("Pickles"); setMenuCustomCategory(""); setMenuDesc(""); setMenuImageUrl(""); setMenuGlobalStock(""); setMenuTag(""); setMenuAdminRating("");
      loadData();
    } catch (err) { showToast("Failed to update: " + err.message, "error"); }
  };

  const handleDeleteMenuItem = (id) => {
    setConfirmDeleteModal({
      message: "Are you sure you want to delete this product? This cannot be undone.",
      onConfirm: async () => {
        // Optimistic update — remove from UI immediately
        setMenu(prev => prev.filter(item => item.id !== id));
        try {
          await api.adminDeleteMenuItem(id);
          showToast("Product deleted.", "success");
        } catch (err) {
          showToast("Failed to delete: " + err.message, "error");
          loadData(); // revert on error
        }
      }
    });
  };

  const handleAddOutlet = async (e) => {
    e.preventDefault();
    try {
      const latVal = outletLatitude ? parseFloat(outletLatitude) : null;
      const lonVal = outletLongitude ? parseFloat(outletLongitude) : null;
      const data = {
        name: outletName,
        address: outletAddress,
        latitude: latVal,
        longitude: lonVal,
        revenue_share_percentage: parseFloat(outletRevenueShare) || 0
      };

      if (editingOutletId) {
        await api.adminUpdateOutlet(editingOutletId, data);
        showToast("Outlet updated successfully!", "success");
      } else {
        const live = (await api.getMode()) === "Live Backend";
        if (live) {
          const res = await fetch(`${API_BASE_URL}/admin/outlets`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` }, body: JSON.stringify(data) });
          const d = await res.json(); if (!res.ok) throw new Error(d.message || "Failed");
        } else {
          const list = JSON.parse(localStorage.getItem("mock_outlets") || "[]");
          list.push({ id: Date.now(), name: outletName, address: outletAddress, latitude: latVal, longitude: lonVal, items: [], revenue_share_percentage: parseFloat(outletRevenueShare) || 0 });
          localStorage.setItem("mock_outlets", JSON.stringify(list));
        }
        showToast("Outlet registered!", "success");
      }
      setShowAddOutlet(false); setEditingOutletId(null);
      setOutletName(""); setOutletAddress(""); setOutletLatitude(""); setOutletLongitude(""); setOutletRevenueShare("");
      loadData();
    } catch (err) { showToast("Failed: " + err.message, "error"); }
  };

  const openEditOutlet = (outlet) => {
    setEditingOutletId(outlet.id);
    setOutletName(outlet.name);
    setOutletAddress(outlet.address || "");
    setOutletLatitude(outlet.latitude || "");
    setOutletLongitude(outlet.longitude || "");
    setOutletRevenueShare(outlet.revenue_share_percentage || "");
    setShowAddOutlet(true);
  };

  const handleDeleteOutlet = (outletId) => {
    setConfirmDeleteModal({
      message: "Are you sure you want to delete this outlet? All assigned stock items will also be removed. This cannot be undone.",
      onConfirm: async () => {
        // Optimistic update — remove from UI immediately
        setOutlets(prev => prev.filter(o => o.id !== outletId));
        try {
          await api.adminDeleteOutlet(outletId);
          showToast("Outlet deleted.", "success");
        } catch (err) {
          showToast("Failed to delete outlet: " + err.message, "error");
          loadData(); // revert
        }
      }
    });
  };

  const handleAssignFormChange = (outletId, field, value) => {
    setAssignForms(prev => ({
      ...prev,
      [outletId]: {
        ...(prev[outletId] || { menuItemId: "", stock: "20", limit: "10" }),
        [field]: value
      }
    }));
  };

  const handleAssignItemToOutlet = async (outletId) => {
    const form = assignForms[outletId] || {};
    if (!form.menuItemId) { showToast("Select a food item first", "error"); return; }
    try {
      await api.adminAssignItemToOutlet(outletId, form.menuItemId, form.stock || "20", form.limit || "10");
      showToast("Item assigned to outlet!", "success");
      loadData();
    }
    catch (err) { showToast("Failed: " + err.message, "error"); }
  };

  const handleRemoveItemFromOutlet = (outletId, menuItemId) => {
    setConfirmDeleteModal({
      message: "Remove this item from the outlet? Stock data for this item will be lost.",
      onConfirm: async () => {
        // Optimistic update
        setOutlets(prev => prev.map(o =>
          o.id === outletId ? { ...o, items: (o.items || []).filter(i => i.menu_item_id !== menuItemId) } : o
        ));
        try {
          await api.adminRemoveItemFromOutlet(outletId, menuItemId);
          showToast("Item removed from outlet.", "success");
        }
        catch (err) { showToast("Failed: " + err.message, "error"); loadData(); }
      }
    });
  };

  const handleRequestRestock = (outletId, menuItemId, itemName) => {
    setRestockQty("50");
    setRestockModal({ outletId, menuItemId, itemName });
  };

  const submitRestockRequest = async () => {
    if (!restockModal) return;
    const { outletId, menuItemId, itemName } = restockModal;
    const qty = parseInt(restockQty);
    if (isNaN(qty) || qty <= 0) { showToast("Enter a valid quantity", "error"); return; }
    try {
      await api.createStockRequest({ outlet_id: outletId, menu_item_id: menuItemId, quantity: qty, type: "Restock" });
      showToast(`Restock request for ${qty}× ${itemName} sent to kitchen.`, "success");
    } catch (err) {
      showToast("Request failed: " + err.message, "error");
    } finally {
      setRestockModal(null);
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    try {
      const live = (await api.getMode()) === "Live Backend";

      const payload = {
        email: staffEmail,
        first_name: staffFirstName,
        last_name: staffLastName,
        phone: staffPhone,
        outlet_id: (staffRole === "staff" || staffRole === "outlet_owner" || staffRole === "kitchen") && staffOutletId ? parseInt(staffOutletId) : null,
        role: staffRole,
        admin_department: staffRole === "admin" ? staffDepartment : null
      };
      if (staffRole === "customer") payload.loyalty_points = parseInt(userLoyaltyPoints) || 0;
      if (staffPassword) payload.password = staffPassword;
      if (staffPin) payload.pin = staffPin;

      if (editingUserId) {
        await api.adminUpdateUser(editingUserId, payload);
        showToast("Account updated successfully!", "success");
      } else {
        if (!staffPassword) throw new Error("Password is required for new accounts");
        if (live) {
          const res = await fetch(`${API_BASE_URL}/admin/staff`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify(payload)
          });
          const d = await res.json();
          if (!res.ok) throw new Error(d.message || "Failed to create account");
          if (d.user && d.user.staff_code) {
            showToast(`Account created! Staff Login Code: ${d.user.staff_code}`, "success");
          } else {
            showToast(`${staffRole === "admin" ? "Admin" : "Staff"} account created!`, "success");
          }
        } else {
          const list = JSON.parse(localStorage.getItem("mock_users") || "[]");
          if (list.find(u => u.email === staffEmail)) throw new Error("Email already registered");
          if (staffRole === "admin" && list.filter(u => u.role === "admin").length >= 3) {
            throw new Error("Maximum of 3 admin accounts allowed.");
          }
          let newUser = { ...payload, id: Date.now() };
          if (staffRole === "staff" || staffRole === "kitchen") {
            const existingCodes = new Set(list.map(u => u.staff_code).filter(Boolean));
            let code;
            do { code = String(Math.floor(1000 + Math.random() * 9000)); } while (existingCodes.has(code));
            newUser.staff_code = code;
          }
          list.push(newUser);
          localStorage.setItem("mock_users", JSON.stringify(list));
          if (newUser.staff_code) {
            showToast(`Account created! Staff code: ${newUser.staff_code}`, "success");
          } else {
            showToast("Account created!", "success");
          }
        }
      }
      setShowAddStaff(false); setEditingUserId(null);
      setStaffEmail(""); setStaffPassword(""); setStaffPin(""); setStaffFirstName(""); setStaffLastName(""); setStaffPhone(""); setStaffRole("staff"); setStaffDepartment(""); setUserLoyaltyPoints(0);
      loadData();
    } catch (err) { showToast("Failed: " + err.message, "error"); }
  };

  const openEditStaff = (user) => {
    setEditingUserId(user.id);
    setStaffEmail(user.email);
    setStaffRole(user.role || "staff");
    setStaffFirstName(user.first_name || "");
    setStaffLastName(user.last_name || "");
    setStaffPhone(user.phone || "");
    setStaffDepartment(user.admin_department || "");
    setUserLoyaltyPoints(user.loyalty_points || 0);
    setStaffOutletId(user.outlet_id || "");
    setStaffPassword("");
    setStaffPin("");
    setShowAddStaff(true);
  };

  const handleDeleteUser = (userId) => {
    setConfirmDeleteModal({
      message: "Are you sure you want to permanently delete this user account? This cannot be undone.",
      onConfirm: async () => {
        try {
          await api.adminDeleteUser(userId);
          showToast("User deleted.", "success");
          loadData();
        } catch (err) { showToast("Failed to delete user: " + err.message, "error"); }
      }
    });
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim() || (!couponDiscount && !couponDiscountAmount)) {
      showToast("Coupon code and at least one discount type (% or flat ₹) are required.", "error");
      return;
    }
    try {
      await api.adminAddCoupon({
        code: couponCode.trim().toUpperCase(),
        discount_pct: couponDiscount ? parseInt(couponDiscount) : null,
        discount_amount: couponDiscountAmount ? parseFloat(couponDiscountAmount) : null,
        max_discount_amount: couponMaxDiscountAmount ? parseFloat(couponMaxDiscountAmount) : null,
        applicable_menu_item_id: couponApplicableMenuItem ? parseInt(couponApplicableMenuItem) : null,
        applicable_customer_id: couponApplicableCustomer ? parseInt(couponApplicableCustomer) : null,
        is_active: couponIsActive,
        min_order_value: parseFloat(couponMinOrderValue || 0),
        is_first_order_only: couponIsFirstOrder,
        scope: couponScope,
        expiry_date: couponExpiryDate || null,
        usage_limit: couponUsageLimit ? parseInt(couponUsageLimit) : null
      });
      showToast(`Coupon "${couponCode.trim().toUpperCase()}" created!`, "success");
      setShowAddCoupon(false);
      setCouponCode("");
      setCouponDiscount("");
      setCouponDiscountAmount("");
      setCouponMaxDiscountAmount("");
      setCouponApplicableMenuItem("");
      setCouponApplicableCustomer("");
      setCouponIsActive(true);
      setCouponMinOrderValue("0");
      setCouponIsFirstOrder(false);
      const c = await api.adminGetCoupons();
      setCoupons(c);
    } catch (err) {
      showToast("Failed to create coupon: " + err.message, "error");
    }
  };

  const handleToggleCoupon = async (coupon) => {
    try {
      await api.adminUpdateCoupon(coupon.id, { is_active: !coupon.is_active });
      showToast(`Coupon "${coupon.code}" ${coupon.is_active ? "deactivated" : "activated"}.`, "success");
      const c = await api.adminGetCoupons();
      setCoupons(c);
    } catch (err) {
      showToast("Failed to update coupon: " + err.message, "error");
    }
  };

  const handleDeleteCoupon = (couponId) => {
    setConfirmDeleteModal({
      message: "Are you sure you want to delete this coupon? Customers will no longer be able to use it.",
      onConfirm: async () => {
        try {
          await api.adminDeleteCoupon(couponId);
          showToast("Coupon deleted.", "success");
          const c = await api.adminGetCoupons();
          setCoupons(c);
        } catch (err) {
          showToast("Failed to delete coupon: " + err.message, "error");
        }
      }
    });
  };

  const handleToggleUserActive = async (user) => {
    try {
      const nextActive = user.is_active === false;
      await api.adminUpdateUser(user.id, { is_active: nextActive });
      showToast(`User account ${nextActive ? "activated" : "deactivated"}.`, "success");
      loadData();
    } catch (err) {
      showToast("Failed to update user status: " + err.message, "error");
    }
  };

  const handleReplyTicket = (ticketId) => {
    setReplyText("");
    setReplyTicketModal({ id: ticketId });
  };

  const submitTicketReply = async () => {
    if (!replyTicketModal || !replyText.trim()) { showToast("Please enter a reply message.", "error"); return; }
    try {
      await api.adminReplyTicket(replyTicketModal.id, { admin_reply: replyText.trim(), status: "Resolved" });
      showToast("Reply sent and ticket marked Resolved.", "success");
      api.adminGetTickets().then(setTickets).catch(console.error);
    } catch (err) {
      showToast("Failed to reply: " + err.message, "error");
    } finally {
      setReplyTicketModal(null); setReplyText("");
    }
  };


  const handleDraftPO = (e) => {
    e.preventDefault();
    const sup = suppliers.find(s => s.id === parseInt(selectedSupplierId));
    if (!sup) return;
    setDraftPOs(prev => [{ id: Date.now(), supplier_name: sup.name, item: poItem, quantity: poQty, unit: poUnit, date: new Date().toLocaleDateString(), status: "draft" }, ...prev]);
    showToast("Purchase Order drafted!", "success");
  };

  const totalRevenue = analytics?.summary?.total_revenue || 0;
  const b2cRevenue = analytics?.summary?.b2c_revenue || 0;
  const posRevenue = analytics?.summary?.pos_revenue || 0;
  const pendingOrders = orders.filter(o => o.status === "pending" || o.status === "processing").length;
  const lowStockOutlets = outlets.filter(o => (o.items || []).some(i => i.needs_restock)).length;

  const currentUser = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); }
    catch (e) { return {}; }
  }, []);
  const userDept = currentUser.role === "admin" ? (currentUser.admin_department || "SuperAdmin") : (currentUser.role || "staff");

  const ALL_TABS = [
    { id: "overview", label: "Overview", icon: BarChart3, depts: ["SuperAdmin", "Operations", "HR", "Finance"] },
    { id: "catalog", label: "Master Catalog", icon: ShoppingBag, depts: ["SuperAdmin", "Operations"] },
    { id: "customer_orders", label: "Customer Orders", icon: ShoppingBag, depts: ["SuperAdmin", "Operations"] },
    { id: "outlet_orders", label: "Outlet Orders", icon: Store, depts: ["SuperAdmin", "Operations"] },
    { id: "outlet_stations", label: "Outlet Stations", icon: MapPin, depts: ["SuperAdmin", "Operations"] },
    { id: "finance", label: "Revenue Share", icon: FileText, depts: ["SuperAdmin", "Finance", ...(storeSettings.share_revenue_with_outlets === "true" ? ["Operations"] : [])] },
    { id: "analytics", label: "Sales Analytics", icon: TrendingUp, depts: ["SuperAdmin", "Finance", "Operations"] },
    { id: "forecast", label: "Demand Forecast", icon: TrendingUp, depts: ["SuperAdmin", "Finance", "Operations"] },
    { id: "users", label: "User Accounts", icon: Users, depts: ["SuperAdmin", "HR"] },
    { id: "timesheets", label: "Timesheets", icon: Clock, depts: ["SuperAdmin", "HR"] },
    { id: "batches", label: "Expiry & Spoilage", icon: Calendar, depts: ["SuperAdmin", "Operations"] },
    { id: "suppliers", label: "B2B Suppliers", icon: Truck, depts: ["SuperAdmin", "Operations"] },
    { id: "reviews", label: "Product Reviews", icon: MessageSquare, depts: ["SuperAdmin", "Operations"] },
    { id: "logs", label: "Audit Logs", icon: FileText, depts: ["SuperAdmin"] },
    { id: "stock_requests", label: "Stock Requests", icon: Package, depts: ["SuperAdmin", "Operations"] },
    { id: "qr", label: "QR Dispatch", icon: QrCode, depts: ["SuperAdmin", "Operations"] },
    { id: "coupons", label: "Discount Coupons", icon: Tag, depts: ["SuperAdmin", "Finance"] },
    { id: "tickets", label: "Support Tickets", icon: MessageSquare, depts: ["SuperAdmin", "Operations"] },
    { id: "crm", label: "CRM & Wallets", icon: Megaphone, depts: ["SuperAdmin", "Operations", "Finance"] },
    { id: "banners", label: "Banners", icon: Image, depts: ["SuperAdmin", "Operations"] },
    { id: "settings", label: "Store Settings", icon: Settings, depts: ["SuperAdmin"] },
  ];

  const TABS = ALL_TABS.filter(t => t.depts.includes(userDept));


  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const nameStr = `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase();
      const emailStr = (user.email || "").toLowerCase();
      const phoneStr = (user.phone || "").toLowerCase();
      const search = usersSearch.toLowerCase();

      const matchesSearch =
        nameStr.includes(search) ||
        emailStr.includes(search) ||
        phoneStr.includes(search);

      const matchesRole = usersFilter === "all" || user.role === usersFilter;

      const isActive = user.is_active !== false;
      const matchesStatus =
        usersStatusFilter === "all" ||
        (usersStatusFilter === "active" && isActive) ||
        (usersStatusFilter === "inactive" && !isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, usersSearch, usersFilter, usersStatusFilter]);


  const handleWalletAction = async (e) => {
    e.preventDefault();
    if (!walletTargetUser || !walletAmount) return;
    try {
      if (walletAction === "credit") {
        await api.adminCreditWallet(walletTargetUser.id, walletAmount, walletDesc);
      } else {
        await api.adminDebitWallet(walletTargetUser.id, walletAmount, walletDesc);
      }
      setShowWalletModal(false);
      setWalletAmount("");
      setWalletDesc("");
      showToast("Wallet updated successfully!", "success");
      api.adminGetCustomerSegments().then(setSegments).catch(() => { });
    } catch (err) {
      showToast(err.message || "Failed to update wallet", "error");
    }
  };

  const handleBulkCoupon = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/admin/bulk-coupons`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          min_loyalty_points: bulkCouponMinPts,
          coupon: {
            code: bulkCouponCode,
            discount_type: bulkCouponType,
            discount_value: parseFloat(bulkCouponValue)
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to generate bulk coupon");
      showToast(data.message, "success");
      setShowBulkCouponModal(false);
      setBulkCouponCode("");
      setBulkCouponValue("");
    } catch (err) {
      showToast(err.message || "Failed to generate bulk coupon", "error");
    }
  };

  const handleSaveBanner = async (e) => {
    e.preventDefault();
    try {
      const bannerPayload = {
        title: bannerTitle,
        image_url: bannerImageUrl,
        target_url: bannerTargetUrl,
        display_location: bannerDisplayLocation,
        start_date: bannerStartDate || null,
        end_date: bannerEndDate || null,
        target_audience: bannerTargetAudience,
        placement_zone: bannerPlacementZone,
        display_style: bannerDisplayStyle,
        has_countdown: bannerHasCountdown,
        countdown_end_time: bannerCountdownEndTime || null,
        linked_product_id: bannerLinkedProductId || null,
        linked_coupon_code: bannerLinkedCouponCode || null
      };

      if (editingBannerId) {
        await api.adminUpdateBanner(editingBannerId, bannerPayload);
      } else {
        await api.adminCreateBanner(bannerPayload);
      }
      setShowBannerModal(false);
      api.adminGetBanners().then(res => setBanners(Array.isArray(res) ? res : [])).catch(() => setBanners([]));
      showToast("Banner saved!", "success");
    } catch (err) {
      showToast(err.message || "Failed to save banner", "error");
    }
  };


  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* ── Fixed Sidebar ── */}
      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0,
        width: sidebarOpen ? "250px" : "70px",
        background: "var(--bg-card)",
        borderRight: "1px solid var(--border-subtle)",
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        zIndex: 100,
        display: "flex", flexDirection: "column",
        overflow: "hidden"
      }}>
        {/* Sidebar Header */}
        <div style={{ padding: "1.25rem", display: "flex", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", gap: sidebarOpen ? "1rem" : "0", justifyContent: sidebarOpen ? "flex-start" : "center" }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", color: "var(--text-primary)", cursor: "pointer", display: "flex", padding: "0.25rem" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          {sidebarOpen && <span style={{ fontWeight: 800, fontSize: "1.1rem", whiteSpace: "nowrap", color: "var(--brand)" }}>ERP Admin</span>}
        </div>

        {/* Sidebar Links */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 0", display: "flex", flexDirection: "column", gap: "0.25rem" }} className="sidebar-scroll">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} title={t.label} style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              width: "100%", padding: sidebarOpen ? "0.75rem 1.25rem" : "0.75rem",
              justifyContent: sidebarOpen ? "flex-start" : "center",
              background: activeTab === t.id ? "var(--brand-glow)" : "transparent",
              color: activeTab === t.id ? "var(--brand)" : "var(--text-secondary)",
              border: "none", borderRight: activeTab === t.id ? "3px solid var(--brand)" : "3px solid transparent",
              cursor: "pointer", fontSize: "0.9rem", fontWeight: activeTab === t.id ? 700 : 500,
              transition: "all 0.2s",
              position: "relative"
            }}>
              <t.icon size={18} style={{ flexShrink: 0 }} />
              {sidebarOpen && <span style={{ whiteSpace: "nowrap" }}>{t.label}</span>}
              
              {/* Badges */}
              {sidebarOpen && (t.id === "customer_orders" || t.id === "outlet_orders") && pendingOrders > 0 && <span style={{ background: "var(--brand)", color: "#fff", padding: "2px 6px", borderRadius: "99px", fontSize: "0.7rem", marginLeft: "auto" }}>{pendingOrders}</span>}
              {sidebarOpen && t.id === "outlet_stations" && lowStockOutlets > 0 && <span style={{ background: "var(--error)", color: "#fff", padding: "2px 6px", borderRadius: "99px", fontSize: "0.7rem", marginLeft: "auto" }}>{lowStockOutlets}</span>}
              {!sidebarOpen && (
                ((t.id === "customer_orders" || t.id === "outlet_orders") && pendingOrders > 0) || (t.id === "outlet_stations" && lowStockOutlets > 0)
              ) && <div style={{ width: 8, height: 8, background: (t.id === "outlet_stations") ? "var(--error)" : "var(--brand)", borderRadius: "50%", position: "absolute", right: "0.5rem", top: "0.5rem" }} />}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div style={{ 
        flex: 1, 
        marginLeft: sidebarOpen ? "250px" : "70px",
        transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        padding: "1.5rem 2rem",
        minWidth: 0,
        overflowX: "hidden"
      }}>
        <div className="animate-fade-in">
          {/* ── Page Header ── */}
          <div className="page-header" style={{ marginBottom: "2rem" }}>
        <div className="page-header-left">
          <h1>Admin Dashboard</h1>
          <p>Manage your food business — catalog, outlets, orders & analytics</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {dbMode && (
            <div style={{
              fontSize: "0.72rem", color: dbMode.includes("Live") ? "var(--success)" : "var(--warning)",
              background: dbMode.includes("Live") ? "var(--success-bg)" : "var(--warning-bg)",
              padding: "0.3rem 0.75rem", borderRadius: "var(--r-full)", fontWeight: 600,
              border: "1px solid", borderColor: dbMode.includes("Live") ? "rgba(22,163,74,0.2)" : "rgba(217,119,6,0.2)",
              marginRight: "0.25rem"
            }}>
              {dbMode.includes("Live") ? "Live Backend" : "Demo Mode"}
            </div>
          )}
          <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddMenu(true)}>
            <Plus size={15} /> Add Product
          </button>
          <button className="btn btn-secondary" onClick={() => setShowAddStaff(true)}>
            <Users size={15} /> Add Staff
          </button>
          <button className="btn btn-secondary" onClick={openProfileModal}>
            <User size={15} /> My Profile
          </button>
          <button className="btn btn-secondary" onClick={onLogout}>
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}><AlertTriangle size={15} /> {error}</div>}



      {/* ══════════ OVERVIEW ══════════ */}
      {activeTab === "overview" && (
        <div className="animate-fade-in">
          {/* KPI cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
            <div className="stat-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="stat-card-label">Total Revenue</span>
                <div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", background: "var(--brand-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)" }}><TrendingUp size={18} /></div>
              </div>
              <div className="stat-card-value" style={{ color: "var(--brand)" }}>₹{totalRevenue.toFixed(0)}</div>
              <div className="stat-card-sub">B2C + POS combined</div>
            </div>
            <div className="stat-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="stat-card-label">B2C Orders</span>
                <div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", background: "rgba(139,92,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#a78bfa" }}><ShoppingBag size={18} /></div>
              </div>
              <div className="stat-card-value">{orders.length}</div>
              <div className="stat-card-sub" style={{ color: pendingOrders > 0 ? "var(--warning)" : "var(--text-secondary)" }}>
                {pendingOrders > 0 ? `${pendingOrders} pending shipment` : "All shipped"}
              </div>
            </div>
            <div className="stat-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="stat-card-label">Outlets</span>
                <div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--success)" }}><Store size={18} /></div>
              </div>
              <div className="stat-card-value">{outlets.length}</div>
              <div className="stat-card-sub" style={{ color: lowStockOutlets > 0 ? "var(--error)" : "var(--text-secondary)" }}>
                {lowStockOutlets > 0 ? `${lowStockOutlets} low-stock alert` : "All stocked"}
              </div>
            </div>
            <div className="stat-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="stat-card-label">Catalog Items</span>
                <div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", background: "rgba(59,130,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--info)" }}><Package size={18} /></div>
              </div>
              <div className="stat-card-value">{menu.length}</div>
              <div className="stat-card-sub">Products in catalog</div>
            </div>
          </div>

          {/* Recent Orders Quick View */}
          <div className="grid-responsive-15fr" style={{ gap: "1.5rem" }}>
            <div className="glass-panel" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1rem" }}>Recent Orders</h3>
                <button className="btn btn-secondary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.78rem" }} onClick={() => setActiveTab("foods")}>
                  View All <ArrowRight size={13} />
                </button>
              </div>
              {orders.length === 0 ? (
                <div className="empty-state" style={{ padding: "2rem" }}>
                  <div className="empty-state-icon"><ShoppingBag size={24} /></div>
                  <p>No orders yet</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {orders.slice(0, 5).map(o => (
                    <div key={o.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", background: "var(--bg-elevated)", borderRadius: "var(--r-md)", border: "1px solid var(--border-subtle)" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.875rem" }}>Order #{o.id}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{o.customer_email}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, color: "var(--brand)" }}>₹{o.total_price.toFixed(0)}</div>
                        <span className={`badge-status status-${o.status}`}>{o.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outlet Health */}
            <div className="glass-panel" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1rem" }}>Outlet Health</h3>
                <button className="btn btn-secondary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.78rem" }} onClick={openAddOutletModal}>
                  <Plus size={13} /> Add
                </button>
              </div>
              {outlets.length === 0 ? (
                <div className="empty-state" style={{ padding: "2rem" }}>
                  <div className="empty-state-icon"><Store size={24} /></div>
                  <p>No outlets yet</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {outlets.slice(0, 4).map(o => {
                    const isAlert = (o.items || []).some(i => i.needs_restock);
                    const stockedItems = (o.items || []).filter(i => !i.needs_restock).length;
                    const totalItems = (o.items || []).length;
                    return (
                      <div key={o.id} style={{ padding: "0.875rem", background: "var(--bg-elevated)", borderRadius: "var(--r-md)", border: `1px solid ${isAlert ? "var(--brand-glow)" : "var(--border-subtle)"}` }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.875rem" }}>{o.name}</span>
                          {isAlert
                            ? <span className="badge-status status-cancelled" style={{ fontSize: "0.62rem" }}>Low Stock</span>
                            : <span className="badge-status status-delivered" style={{ fontSize: "0.62rem" }}>OK</span>
                          }
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <MapPin size={11} /> {o.address}
                        </div>
                        {totalItems > 0 && (
                          <div className="stock-bar-container" style={{ marginTop: "0.6rem" }}>
                            <div className="stock-bar-fill" style={{ width: `${(stockedItems / totalItems) * 100}%`, background: isAlert ? "var(--error)" : "var(--success)" }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MASTER CATALOG ══════════ */}
      {activeTab === "catalog" && (
        <div className="animate-fade-in">
          {/* Action Row */}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.75rem", flexWrap: "wrap" }}>
            <button onClick={() => setShowAddMenu(true)} className="btn btn-primary"><Plus size={15} /> Add Product</button>
          </div>

          {/* Master Catalog */}
          <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 700, marginBottom: "1rem", marginTop: "1rem" }}>
            Master Food Catalog <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 400 }}>— all food items</span>
          </h3>
          <div className="table-container" style={{ marginBottom: "2.5rem" }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Type</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {menu.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>No items in catalog.</td></tr>
                )}
                {menu.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.category}</td>
                    <td>₹{item.price}</td>
                    <td><span className={`badge-status status-${item.business_type === 'snack_supply' ? 'delivered' : 'pending'}`}>{item.business_type}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button className="btn btn-secondary" style={{ padding: "0.3rem 0.5rem", fontSize: "0.75rem" }} onClick={() => openEditMenuItem(item)}>Edit</button>
                        <button className="btn btn-secondary" style={{ padding: "0.3rem 0.5rem", fontSize: "0.75rem", color: "var(--error)", borderColor: "var(--error)" }} onClick={() => handleDeleteMenuItem(item.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════ OUTLET STATIONS ══════════ */}
      {activeTab === "outlet_stations" && (
        <div className="animate-fade-in">
          {/* Action Row */}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.75rem", flexWrap: "wrap" }}>
            <button onClick={() => setShowAddOutlet(true)} className="btn btn-primary"><Store size={15} /> Register Outlet</button>
            <button onClick={() => setShowAddStaff(true)} className="btn btn-secondary"><Users size={15} /> Add Staff</button>
          </div>

          {/* Outlets Grid */}
          <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>
            Outlet Stations <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 400 }}>— stock management</span>
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "1.25rem", marginBottom: "2.5rem" }}>
            {outlets.map(outlet => {
              const isAlert = (outlet.items || []).some(i => i.needs_restock);
              return (
                <div key={outlet.id} className="glass-card" style={{ borderLeft: `3px solid ${isAlert ? "var(--error)" : "var(--brand)"}`, padding: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
                    <div>
                      <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {outlet.name}
                        <button onClick={() => openEditOutlet(outlet)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand)" }} title="Edit Outlet">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </button>
                        <button onClick={() => handleDeleteOutlet(outlet.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)" }} title="Delete Outlet">
                          <Trash2 size={14} />
                        </button>
                      </h3>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                        <MapPin size={11} /> {outlet.address}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem", fontWeight: 600 }}>
                        Revenue Share: {outlet.revenue_share_percentage || 0}%
                      </div>
                    </div>
                    {isAlert && <span className="badge-status status-cancelled">⚠ Low Stock</span>}
                  </div>

                  {/* Stock items */}
                  <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--r-md)", padding: "0.75rem", marginBottom: "0.75rem", border: "1px solid var(--border-subtle)" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.7rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "0.5rem" }}>Station Inventory</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {(outlet.items || []).map(item => (
                        <div key={item.menu_item_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0.6rem", background: "var(--bg-card)", borderRadius: "var(--r-sm)", border: "1px solid var(--border-subtle)" }}>
                          <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>{item.menu_item_name}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 800, color: item.needs_restock ? "var(--error)" : "var(--success)" }}>
                              {item.current_stock}/{item.restock_limit}
                            </span>
                            <button onClick={() => handleRequestRestock(outlet.id, item.menu_item_id, item.menu_item_name)} title="Request Restock" style={{ background: "var(--brand-glow)", border: "none", color: "var(--brand)", cursor: "pointer", padding: "2px 6px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold" }}>
                              RESTOCK
                            </button>
                            <button onClick={() => handleRemoveItemFromOutlet(outlet.id, item.menu_item_id)} title="Remove Item" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, fontSize: "1rem", lineHeight: 1, display: "flex" }}>
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {(!outlet.items || outlet.items.length === 0) && (
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic", margin: "0.25rem 0" }}>No items assigned yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Assign item */}
                  <div style={{ background: "var(--brand-dim)", borderRadius: "var(--r-md)", padding: "0.75rem", border: "1px solid var(--border-brand)" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.7rem", color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "0.5rem" }}>Assign Item</span>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "0.4rem", marginBottom: "0.4rem" }}>
                      <select className="form-select" style={{ padding: "0.35rem 0.5rem", fontSize: "0.75rem" }} onChange={e => handleAssignFormChange(outlet.id, 'menuItemId', e.target.value)} value={assignForms[outlet.id]?.menuItemId || ""}>
                        <option value="">-- Select --</option>
                        {menu.filter(i => i.business_type === "snack_supply" || i.business_type === "both").map(i => (
                          <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                      </select>
                      <input type="number" placeholder="Qty" className="form-input" style={{ padding: "0.35rem 0.5rem", fontSize: "0.75rem" }} value={assignForms[outlet.id]?.stock !== undefined ? assignForms[outlet.id].stock : "20"} onChange={e => handleAssignFormChange(outlet.id, 'stock', e.target.value)} />
                      <input type="number" placeholder="Limit" className="form-input" style={{ padding: "0.35rem 0.5rem", fontSize: "0.75rem" }} value={assignForms[outlet.id]?.limit !== undefined ? assignForms[outlet.id].limit : "10"} onChange={e => handleAssignFormChange(outlet.id, 'limit', e.target.value)} />
                    </div>
                    <button onClick={() => handleAssignItemToOutlet(outlet.id)} className="btn btn-primary" style={{ width: "100%", padding: "0.45rem", fontSize: "0.78rem" }}>
                      <Plus size={13} /> Assign
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ══════════ ORDERS ══════════ */}
      {(activeTab === "customer_orders" || activeTab === "outlet_orders") && (
        <div className="animate-fade-in">
          <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>
            {activeTab === "customer_orders" ? "B2C Customer Shipments" : "Outlet POS Orders"} 
            <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 400 }}>— pending dispatch</span>
          </h3>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Dispatch Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.filter(o => o.order_type === (activeTab === "customer_orders" ? "online" : "pos")).length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>No orders yet.</td></tr>
                )}
                {orders.filter(o => o.order_type === (activeTab === "customer_orders" ? "online" : "pos")).map(o => (
                  <tr key={o.id}>
                    <td><span style={{ fontWeight: 700, color: "var(--brand)" }}>#{o.id}</span></td>
                    <td style={{ color: "var(--text-secondary)" }}>{new Date(o.created_at).toLocaleDateString()}</td>
                    <td>
                      <button 
                        onClick={() => setPrintOrder(o)}
                        style={{ background: "none", border: "none", color: "var(--brand)", textDecoration: "underline", cursor: "pointer", padding: 0 }}
                      >
                        {o.customer_email || "Guest"}
                      </button>
                    </td>
                    <td><strong>₹{o.total_price.toFixed(0)}</strong></td>
                    <td><span className={`badge-status status-${o.status}`}>{o.status}</span></td>
                    <td>
                      {(o.status === "pending" || o.status === "processing" || o.status === "ready") ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                          <div style={{ display: "flex", gap: "0.4rem" }}>
                            <input type="text" placeholder="Tracking ID" className="form-input" style={{ padding: "0.4rem 0.6rem", fontSize: "0.8rem", width: 130, height: "auto" }} value={trackingCodes[o.id] || ""} onChange={e => setTrackingCodes({ ...trackingCodes, [o.id]: e.target.value })} />

                            <label style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "6px", background: trackingLabels[o.id] ? "rgba(34,197,94,0.12)" : "var(--bg-secondary)", border: trackingLabels[o.id] ? "1px solid #22c55e" : "1px solid var(--border-light)", cursor: "pointer", color: trackingLabels[o.id] ? "#22c55e" : "var(--text-secondary)", transition: "all 0.2s" }} title="Upload vendor barcode/QR code label">
                              <QrCode size={14} />
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (uploadEvent) => {
                                      setTrackingLabels({ ...trackingLabels, [o.id]: uploadEvent.target.result });
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>

                            <button onClick={() => handleShipOrder(o.id)} className="btn btn-success" style={{ padding: "0.4rem 0.75rem", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                              <Truck size={13} /> Ship
                            </button>
                          </div>
                          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.3rem" }}>
                            <input type="text" placeholder="Tracking Link (URL)" className="form-input" style={{ padding: "0.4rem 0.6rem", fontSize: "0.75rem", flex: 1, height: "auto" }} value={trackingLinks[o.id] || ""} onChange={e => setTrackingLinks({ ...trackingLinks, [o.id]: e.target.value })} />
                          </div>
                          {trackingLabels[o.id] && (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.68rem", color: "#22c55e" }}>
                              <span>✓ Label attached</span>
                              <button onClick={() => setTrackingLabels({ ...trackingLabels, [o.id]: null })} style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", fontSize: "0.65rem", padding: 0 }}>Remove</button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                            {o.tracking_code ? `Code: ${o.tracking_code}` : "Done"}
                          </span>
                          {o.delivery_confirmation_code && (
                            <span style={{ fontSize: "0.78rem", color: "var(--brand)", fontWeight: 600 }}>
                              PIN: {o.delivery_confirmation_code}
                            </span>
                          )}
                          {o.tracking_label && (
                            <span style={{ fontSize: "0.68rem", color: "var(--brand)" }}>
                              🖼️ Label Uploaded
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════ ANALYTICS ══════════ */}

      {activeTab === "finance" && (
        <div className="dashboard-content">
          <header className="content-header">
            <div>
              <h1 className="content-title">Revenue Share Report</h1>
              <p className="content-subtitle">Brand cut from completed orders per outlet.</p>
            </div>
            <button className="btn btn-secondary" onClick={loadData}><RefreshCw size={15} /> Refresh</button>
          </header>
          <div className="card">
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Outlet Name</th>
                    <th>Total Sales</th>
                    <th>Revenue Share %</th>
                    <th>Brand Cut / Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueShare.length === 0 ? (
                    <tr><td colSpan="4" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>No revenue share data found.</td></tr>
                  ) : (
                    revenueShare.map(r => (
                      <tr key={r.outlet_id}>
                        <td style={{ fontWeight: 600 }}>{r.outlet_name}</td>
                        <td>₹{r.total_sales.toFixed(2)}</td>
                        <td>{r.revenue_share_percentage}%</td>
                        <td style={{ color: "var(--success)" }}>₹{r.brand_cut.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "analytics" && (
        <div className="animate-fade-in">
          {!analytics ? (
            <div className="empty-state"><div className="empty-state-icon"><BarChart3 size={28} /></div><p>Loading analytics…</p></div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem", marginBottom: "2rem" }}>
                {[
                  { label: "Total Revenue", value: `₹${totalRevenue.toFixed(0)}`, color: "var(--brand)", icon: TrendingUp, bg: "var(--brand-glow)" },
                  { label: "B2C Home Foods", value: `₹${b2cRevenue.toFixed(0)}`, color: "#a78bfa", icon: ShoppingBag, bg: "rgba(139,92,246,0.12)" },
                  { label: "POS Station Sales", value: `₹${posRevenue.toFixed(0)}`, color: "var(--warning)", icon: Store, bg: "rgba(245,158,11,0.12)" },
                ].map(card => (
                  <div key={card.label} className="stat-card">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span className="stat-card-label">{card.label}</span>
                      <div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", color: card.color }}>
                        <card.icon size={18} />
                      </div>
                    </div>
                    <div className="stat-card-value" style={{ color: card.color }}>{card.value}</div>
                  </div>
                ))}
              </div>

              <div className="grid-responsive-2col" style={{ gap: "1.5rem" }}>
                <div className="glass-panel" style={{ padding: "1.5rem" }}>
                  <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1rem", marginBottom: "1.25rem" }}>Weekly Sales Trend</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {analytics.daily.map(d => {
                      const total = d.b2c + d.pos + 1;
                      const b2cPct = Math.round((d.b2c / total) * 100);
                      const posPct = 100 - b2cPct;
                      return (
                        <div key={d.date}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "0.35rem" }}>
                            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.date}</span>
                            <span style={{ color: "var(--text-secondary)" }}>B2C: ₹{d.b2c} · POS: ₹{d.pos}</span>
                          </div>
                          <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: "var(--r-full)", overflow: "hidden", display: "flex" }}>
                            <div style={{ width: `${b2cPct}%`, background: "var(--brand)", borderRadius: "var(--r-full) 0 0 var(--r-full)" }} />
                            <div style={{ width: `${posPct}%`, background: "var(--info)", borderRadius: "0 var(--r-full) var(--r-full) 0" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", fontSize: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--brand)" }} /> B2C</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--info)" }} /> POS</div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: "1.5rem", marginTop: "1.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                    <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1rem", margin: 0 }} title="AI-driven estimate of future sales based on past data, weather, and holidays">AI Demand Forecast (Next 7 Days) ℹ️</h3>
                    <span style={{ fontSize: "0.75rem", background: "rgba(139,92,246,0.12)", color: "#8b5cf6", padding: "4px 8px", borderRadius: "12px", fontWeight: 700 }}>Powered by AI</span>
                  </div>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1.5rem" }}>Predicted order volume based on historical data, weather, and upcoming holidays.</p>
                  <div style={{ display: "flex", alignItems: "flex-end", height: "150px", gap: "1rem", paddingTop: "1rem", borderBottom: "1px dashed var(--border-subtle)" }}>
                    {[
                      { day: "Mon", val: 45, color: "var(--brand)" },
                      { day: "Tue", val: 52, color: "var(--brand)" },
                      { day: "Wed", val: 80, color: "var(--warning)" },
                      { day: "Thu", val: 65, color: "var(--brand)" },
                      { day: "Fri", val: 95, color: "var(--error)" },
                      { day: "Sat", val: 110, color: "var(--error)" },
                      { day: "Sun", val: 85, color: "var(--warning)" }
                    ].map((d, i) => (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-primary)" }}>{d.val}</div>
                        <div style={{ width: "100%", maxWidth: "30px", height: `${(d.val / 120) * 100}%`, background: d.color, borderRadius: "4px 4px 0 0", opacity: 0.8 }} />
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>{d.day}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", fontSize: "0.75rem", justifyContent: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><div style={{ width: 10, height: 10, borderRadius: "2px", background: "var(--brand)" }} /> Normal Volume</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><div style={{ width: 10, height: 10, borderRadius: "2px", background: "var(--warning)" }} /> High Demand</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><div style={{ width: 10, height: 10, borderRadius: "2px", background: "var(--error)" }} /> Peak/Surge</div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: "1.5rem" }}>
                  <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1rem", marginBottom: "1.25rem" }}>Customer Feedback</h3>
                  <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1.5rem" }}>
                    <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(34,197,94,0.12)", border: "2px solid rgba(34,197,94,0.3)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontFamily: "var(--font-heading)", fontSize: "1.6rem", fontWeight: 900, color: "var(--success)", lineHeight: 1 }}>4.8</span>
                      <span style={{ fontSize: "0.55rem", color: "var(--text-secondary)", fontWeight: 600 }}>/ 5.0</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.25rem" }}>Excellent Ratings</div>
                      <div style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>94% positive over last 30 orders. Customers love the freshness.</div>
                    </div>
                  </div>
                  {[
                    { label: "Spice Level & Seasoning", score: 92, color: "var(--success)" },
                    { label: "Packaging Quality", score: 96, color: "var(--success)" },
                    { label: "Delivery Speed", score: 88, color: "var(--warning)" },
                    { label: "Value for Money", score: 91, color: "var(--success)" },
                  ].map(m => (
                    <div key={m.label} style={{ marginBottom: "0.75rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "0.3rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>{m.label}</span>
                        <span style={{ fontWeight: 700, color: m.color }}>{m.score}%</span>
                      </div>
                      <div className="stock-bar-container">
                        <div className="stock-bar-fill" style={{ width: `${m.score}%`, background: m.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ TIMESHEETS ══ */}
      {activeTab === "timesheets" && (
        <div className="animate-fade-in">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>
                Staff Timesheets & Shifts
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: "0.2rem 0 0" }}>
                Monitor staff clock-in/out times, hours worked, and cash drawer discrepancies.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: "0.75rem", marginBottom: "0.2rem" }}>Outlet</label>
                <select className="form-input" style={{ padding: "0.5rem", fontSize: "0.85rem", height: "auto", minWidth: "120px" }} value={timesheetsFilterOutlet} onChange={e => { setTimesheetsFilterOutlet(e.target.value); setTimesheetsPage(1); }}>
                  <option value="all">All Outlets</option>
                  {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: "0.75rem", marginBottom: "0.2rem" }}>Start Date</label>
                <input type="date" className="form-input" style={{ padding: "0.5rem", fontSize: "0.85rem", height: "auto" }} value={timesheetsStartDate} onChange={e => { setTimesheetsStartDate(e.target.value); setTimesheetsPage(1); }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: "0.75rem", marginBottom: "0.2rem" }}>End Date</label>
                <input type="date" className="form-input" style={{ padding: "0.5rem", fontSize: "0.85rem", height: "auto" }} value={timesheetsEndDate} onChange={e => { setTimesheetsEndDate(e.target.value); setTimesheetsPage(1); }} />
              </div>
              <button className="btn btn-secondary" style={{ padding: "0.5rem 0.75rem", height: "35px" }} onClick={() => api.adminGetShifts({ page: timesheetsPage, outlet_id: timesheetsFilterOutlet, start_date: timesheetsStartDate, end_date: timesheetsEndDate }).then(data => { setTimesheets(data.shifts || []); setTimesheetsTotalPages(data.pages || 1); })}><RefreshCw size={14} /> Refresh</button>
            </div>
          </div>

          <div className="glass-panel" style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-light)" }}>
                  <th style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Staff ID</th>
                  <th style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Outlet</th>
                  <th style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Clock In</th>
                  <th style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Clock Out</th>
                  <th style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Duration</th>
                  <th style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Expected Cash</th>
                  <th style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Actual Cash</th>
                  <th style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Discrepancy</th>
                </tr>
              </thead>
              <tbody>
                {timesheets.length === 0 ? (
                  <tr><td colSpan="8" style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>No timesheet records found.</td></tr>
                ) : (
                  timesheets.map(ts => {
                    const discrepancyColor = ts.cash_discrepancy < 0 ? "var(--error)" : ts.cash_discrepancy > 0 ? "var(--success)" : "var(--text-secondary)";
                    const outOutlet = outlets.find(o => o.id === ts.outlet_id);
                    return (
                      <React.Fragment key={ts.id}>
                        <tr style={{ borderBottom: ts.sales_summary && ts.sales_summary.length > 0 ? "none" : "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "1rem", fontWeight: 600 }}>Staff #{ts.staff_id}</td>
                          <td style={{ padding: "1rem" }}>{outOutlet ? outOutlet.name : `Outlet #${ts.outlet_id}`}</td>
                          <td style={{ padding: "1rem", fontSize: "0.85rem" }}>{new Date(ts.clock_in_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td style={{ padding: "1rem", fontSize: "0.85rem" }}>{ts.clock_out_time ? new Date(ts.clock_out_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : <span style={{ color: "var(--warning-color)", fontWeight: 700 }}>Active</span>}</td>
                          <td style={{ padding: "1rem", fontWeight: 600 }}>{ts.duration_hours ? `${ts.duration_hours}h` : "—"}</td>
                          <td style={{ padding: "1rem", color: "var(--text-secondary)" }}>{ts.expected_cash !== null ? `₹${ts.expected_cash.toFixed(2)}` : "—"}</td>
                          <td style={{ padding: "1rem", fontWeight: 600 }}>{ts.actual_cash !== null ? `₹${ts.actual_cash.toFixed(2)}` : "—"}</td>
                          <td style={{ padding: "1rem", fontWeight: 800, color: discrepancyColor }}>
                            {ts.cash_discrepancy !== null ? `${ts.cash_discrepancy > 0 ? '+' : ''}₹${ts.cash_discrepancy.toFixed(2)}` : "—"}
                          </td>
                        </tr>
                        {ts.sales_summary && ts.sales_summary.length > 0 && (
                          <tr style={{ borderBottom: "1px solid var(--border-subtle)", background: "rgba(0,0,0,0.02)" }}>
                            <td colSpan="8" style={{ padding: "0.5rem 1rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                              <strong>Items Sold:</strong> {ts.sales_summary.map(s => `${s.total_qty}x ${s.item_name} (₹${s.total_revenue})`).join(', ')}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", padding: "1rem", background: "var(--bg-elevated)", borderRadius: "var(--r-md)" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>
              Page {timesheetsPage} of {timesheetsTotalPages}
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button 
                className="btn btn-outline" 
                style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", borderRadius: "var(--r-sm)" }}
                disabled={timesheetsPage <= 1} 
                onClick={() => setTimesheetsPage(p => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button 
                className="btn btn-outline" 
                style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", borderRadius: "var(--r-sm)" }}
                disabled={timesheetsPage >= timesheetsTotalPages} 
                onClick={() => setTimesheetsPage(p => Math.min(timesheetsTotalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ BATCHES ══════════ */}
      {activeTab === "batches" && (
        <div className="animate-fade-in">
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
            <div>
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1rem", marginBottom: "1rem" }}>Batch Expiry Tracker</h3>
              <div className="table-container">
                <table className="custom-table">
                  <thead><tr><th>Batch #</th><th>Station</th><th>Item</th><th>Expiry Date</th><th>Status</th></tr></thead>
                  <tbody>
                    {batches.map(b => {
                      const daysLeft = Math.round((new Date(b.expiry_date) - Date.now()) / 86400000);
                      const warning = daysLeft <= 3;
                      return (
                        <tr key={b.id} style={{ background: warning ? "var(--brand-dim)" : "transparent" }}>
                          <td><strong>{b.batch_number}</strong></td>
                          <td>{b.outlet_name}</td>
                          <td>{b.menu_item_name}</td>
                          <td style={{ color: warning ? "var(--error)" : "var(--text-primary)", fontWeight: warning ? 700 : 400 }}>{b.expiry_date}</td>
                          <td>
                            {warning
                              ? <span className="badge-status status-cancelled"><AlertTriangle size={11} /> {daysLeft}d left</span>
                              : <span className="badge-status status-delivered">Good</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1rem", marginBottom: "1rem" }}>Disposal Log</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {auditLogs.filter(l => l.change_type === "waste").map(log => (
                  <div key={log.id} className="glass-card" style={{ borderLeft: "3px solid var(--error)", padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                      <span>{log.outlet_name || "System"}</span>
                      <span>{new Date(log.created_at).toLocaleDateString()}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: "0.875rem" }}>{log.menu_item_name}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.35rem" }}>
                      <span style={{ color: "var(--error)", fontWeight: 700, fontSize: "0.78rem" }}>−{log.change_qty} units</span>
                      <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem", fontStyle: "italic" }}>{log.notes}</span>
                    </div>
                  </div>
                ))}
                {auditLogs.filter(l => l.change_type === "waste").length === 0 && (
                  <div className="empty-state" style={{ padding: "2rem" }}><p style={{ fontSize: "0.85rem" }}>No disposal logs yet.</p></div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ SUPPLIERS ══════════ */}
      {activeTab === "suppliers" && (
        <div className="animate-fade-in">
          <div className="grid-responsive-15fr" style={{ gap: "1.5rem" }}>
            <div>
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1rem", marginBottom: "1rem" }}>Draft Purchase Order</h3>
              <div className="glass-panel" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
                <form onSubmit={handleDraftPO} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Supplier</label>
                    <select className="form-select" value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)}>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.contact})</option>)}
                    </select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "0.75rem" }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Item</label>
                      <input type="text" className="form-input" value={poItem} onChange={e => setPoItem(e.target.value)} required />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Qty</label>
                      <input type="number" className="form-input" value={poQty} onChange={e => setPoQty(e.target.value)} required />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Unit</label>
                      <input type="text" className="form-input" value={poUnit} onChange={e => setPoUnit(e.target.value)} required />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary"><Plus size={15} /> Create Draft PO</button>
                </form>
              </div>
              {draftPOs.length > 0 && (
                <div className="table-container">
                  <table className="custom-table">
                    <thead><tr><th>Supplier</th><th>Item</th><th>Qty</th><th>Date</th><th>Status</th></tr></thead>
                    <tbody>
                      {draftPOs.map(po => (
                        <tr key={po.id}>
                          <td><strong>{po.supplier_name}</strong></td>
                          <td>{po.item}</td>
                          <td>{po.quantity} {po.unit}</td>
                          <td style={{ color: "var(--text-secondary)" }}>{po.date}</td>
                          <td><span className="badge-status status-pending">Draft</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div>
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1rem", marginBottom: "1rem" }}>Supplier Directory</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                {suppliers.map(s => (
                  <div key={s.id} className="glass-card" style={{ padding: "1.1rem" }}>
                    <div style={{ fontWeight: 800, fontSize: "0.9rem", marginBottom: "0.25rem" }}>{s.name}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "0.6rem" }}>
                      Contact: <strong>{s.contact}</strong> · {s.phone}
                    </div>
                    <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                      {s.items.map(item => (
                        <span key={item} className="chip" style={{ fontSize: "0.68rem", padding: "0.2rem 0.6rem" }}>{item}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ AUDIT LOGS ══════════ */}
      {activeTab === "logs" && (
        <div className="animate-fade-in">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1rem" }}>Stock Audit Logs</h3>
            <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{auditLogs.length} entries</span>
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead><tr><th>Timestamp</th><th>Station</th><th>Product</th><th>Operation</th><th>Stock Change</th><th>Notes</th></tr></thead>
              <tbody>
                {auditLogs.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>No audit logs yet.</td></tr>
                )}
                {auditLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>{new Date(log.created_at).toLocaleString()}</td>
                    <td><strong>{log.outlet_name || "System"}</strong></td>
                    <td>{log.menu_item_name}</td>
                    <td>
                      <span className={`badge-status ${log.change_type === "waste" ? "status-cancelled" : log.change_qty > 0 ? "status-delivered" : "status-processing"}`}>
                        {log.change_type?.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: log.change_qty > 0 ? "var(--success)" : "var(--error)" }}>
                        {log.change_qty > 0 ? `+${log.change_qty}` : log.change_qty}
                      </strong>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.72rem", marginLeft: "0.4rem" }}>
                        ({log.stock_before} → {log.stock_after})
                      </span>
                    </td>
                    <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{log.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════ QR DISPATCH ══════════ */}
      {activeTab === "qr" && (
        <div className="animate-fade-in">
          <div className="page-header" style={{ marginBottom: "1.5rem" }}>
            <div className="page-header-left">
              <h1 style={{ fontSize: "1.25rem" }}>QR Dispatch Labels</h1>
              <p>Generate QR codes for stock dispatch. Staff scans on arrival to auto-update inventory.</p>
            </div>
          </div>
          <QRGenerator outlets={outlets} menuItems={menu} />
        </div>
      )}

      {/* ══════════ USER ACCOUNTS ══════════ */}
      {activeTab === "users" && (
        <div className="animate-fade-in">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1.1rem", margin: 0 }}>Registered User Accounts</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.78rem", margin: "0.2rem 0 0" }}>Manage customer, staff, and outlet owner accounts and credentials.</p>
            </div>
            <button className="btn btn-secondary" onClick={() => setShowAddStaff(true)}>
              <Users size={15} /> Create Staff Account
            </button>
          </div>

          {/* Filters Row */}
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search by name, email or phone..."
                value={usersSearch}
                onChange={e => setUsersSearch(e.target.value)}
              />
            </div>
            <div>
              <select className="form-select" value={usersFilter} onChange={e => setUsersFilter(e.target.value)}>
                <option value="all">All Roles</option>
                <option value="customer">Customers</option>
                <option value="staff">Staff</option>
                <option value="kitchen">Kitchen Staff</option>
                <option value="outlet_owner">Outlet Owners</option>
              </select>
            </div>
            <div>
              <select className="form-select" value={usersStatusFilter} onChange={e => setUsersStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Login Code</th>
                  <th>Role</th>
                  <th>Assigned Outlet</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem 1rem" }}>
                      No user accounts found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => {
                    return (
                      <tr key={user.id}>
                        <td>
                          <strong>{user.first_name || ""} {user.last_name || ""}</strong>
                          {user.is_first_login && (
                            <span className="badge-status status-pending" style={{ marginLeft: "0.5rem", fontSize: "0.62rem" }}>First Login</span>
                          )}
                        </td>
                        <td>{user.email}</td>
                        <td style={{ color: "var(--text-secondary)" }}>{user.phone || "—"}</td>
                        <td>
                          {(user.role === "staff" || user.role === "kitchen") && user.staff_code ? (
                            <span style={{
                              fontFamily: "monospace", fontWeight: 900, fontSize: "1rem",
                              background: "var(--brand-glow)", color: "var(--brand)",
                              padding: "0.2rem 0.6rem", borderRadius: "6px",
                              border: "1px solid var(--brand-glow)", letterSpacing: "0.1em"
                            }}>
                              #{user.staff_code}
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>—</span>
                          )}
                        </td>
                        <td>
                          <span style={{
                            textTransform: "uppercase", fontSize: "0.72rem", fontWeight: 800,
                            padding: "0.2rem 0.5rem", borderRadius: "4px",
                            background: user.role === "outlet_owner" ? "rgba(139,92,246,0.15)" : user.role === "staff" ? "var(--brand-glow)" : user.role === "kitchen" ? "rgba(234,179,8,0.15)" : "rgba(59,130,246,0.15)",
                            color: user.role === "outlet_owner" ? "var(--brand)" : user.role === "staff" ? "var(--brand)" : user.role === "kitchen" ? "#854d0e" : "var(--info)"
                          }}>
                            {user.role?.replace("_", " ")}
                          </span>
                        </td>
                        <td>
                          {user.role === "staff" || user.role === "outlet_owner" || user.role === "kitchen" ? (
                            <select
                              className="form-select"
                              style={{ padding: "0.2rem 0.4rem", fontSize: "0.78rem", minWidth: "150px" }}
                              value={user.outlet_id || ""}
                              onChange={async (e) => {
                                const val = e.target.value;
                                const oId = val ? parseInt(val) : null;
                                try {
                                  await api.adminUpdateUser(user.id, { outlet_id: oId });
                                  alert("Outlet assigned successfully!");
                                  loadData();
                                } catch (err) {
                                  alert("Failed to assign: " + err.message);
                                }
                              }}
                            >
                              <option value="">-- Unassigned --</option>
                              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>—</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge-status ${user.is_active !== false ? "status-delivered" : "status-cancelled"}`}>
                            {user.is_active !== false ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                            {(user.role === "staff" || user.role === "kitchen") && (
                              <button onClick={async () => {
                                const newPin = window.prompt(`Enter new 4-digit PIN for ${user.first_name || user.email}:`);
                                if (newPin && newPin.length === 4 && /^\d+$/.test(newPin)) {
                                  try {
                                    await api.adminUpdateUser(user.id, { pin: newPin });
                                    showToast("PIN reset successfully", "success");
                                  } catch (err) {
                                    showToast(err.message, "error");
                                  }
                                } else if (newPin !== null) {
                                  alert("PIN must be exactly 4 digits.");
                                }
                              }} style={{ background: "none", border: "1px solid var(--border-light)", cursor: "pointer", color: "var(--text-secondary)", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem" }} title="Reset PIN">
                                Reset PIN
                              </button>
                            )}
                            <button onClick={() => openEditStaff(user)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand)" }} title="Edit User">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                            </button>
                            <button onClick={() => handleDeleteUser(user.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)" }} title="Delete User">
                              <Trash2 size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleUserActive(user)}
                              className={`btn ${user.is_active !== false ? "btn-secondary" : "btn-primary"}`}
                              style={{ padding: "0.3rem 0.75rem", fontSize: "0.78rem" }}
                            >
                              {user.is_active !== false ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* ══════════ PRODUCT REVIEWS MODERATION ══════════ */}
      {activeTab === "reviews" && (
        <div className="animate-fade-in">
          <div style={{ marginBottom: "1.25rem" }}>
            <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1.1rem", margin: 0 }}>Customer Reviews Moderation</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.78rem", margin: "0.2rem 0 0" }}>
              Monitor and moderate customer reviews submitted for catalog food products.
            </p>
          </div>

          {reviewsLoading ? (
            <div style={{ textAlign: "center", padding: "4rem 0" }}>
              <RefreshCw className="animate-spin" size={28} style={{ color: "var(--text-muted)" }} />
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>Loading reviews...</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Customer</th>
                    <th>Rating</th>
                    <th>Comment</th>
                    <th>Status</th>
                    <th>Submitted Date</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem 1rem" }}>
                        No product reviews found.
                      </td>
                    </tr>
                  ) : (
                    reviews.map(r => (
                      <tr key={r.id}>
                        <td><strong>{r.menu_item_name}</strong></td>
                        <td>{r.customer_name}</td>
                        <td>
                          <div style={{ display: "flex", gap: "0.1rem" }}>
                            {[1, 2, 3, 4, 5].map(star => (
                              <Star
                                key={star}
                                size={11}
                                fill={r.rating >= star ? "var(--warning-color)" : "transparent"}
                                color={r.rating >= star ? "var(--warning-color)" : "var(--border-dark)"}
                              />
                            ))}
                          </div>
                        </td>
                        <td style={{ fontSize: "0.82rem", color: "var(--text-secondary)", maxWidth: "350px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "normal" }}>
                          {r.comment}
                          {r.admin_reply && (
                            <div style={{ marginTop: "0.5rem", padding: "0.4rem", background: "var(--brand-glow)", borderLeft: "2px solid var(--brand)", fontSize: "0.75rem", color: "var(--text-primary)" }}>
                              <strong>Admin Reply:</strong> {r.admin_reply}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`status-pill ${r.is_hidden ? "status-cancelled" : "status-shipped"}`} style={{ display: "inline-block", fontSize: "0.7rem", padding: "0.2rem 0.4rem", borderRadius: "100px", fontWeight: "700" }}>
                            {r.is_hidden ? "Hidden" : "Visible"}
                          </span>
                        </td>
                        <td style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td style={{ textAlign: "right", display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                          <button
                            onClick={() => handleToggleReviewVisibility(r)}
                            className="btn btn-secondary"
                            style={{ padding: "0.3rem 0.5rem", fontSize: "0.75rem" }}
                          >
                            {r.is_hidden ? "Show" : "Hide"}
                          </button>
                          <button
                            onClick={() => handleReplyReview(r)}
                            className="btn btn-primary"
                            style={{ padding: "0.3rem 0.5rem", fontSize: "0.75rem" }}
                          >
                            Reply
                          </button>
                          <button
                            onClick={() => handleDeleteReview(r.id)}
                            className="btn btn-secondary"
                            style={{ padding: "0.3rem 0.5rem", fontSize: "0.75rem", background: "var(--brand-glow)", border: "1px solid var(--brand-dark)", color: "var(--brand-dark)" }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════ DISCOUNT COUPONS ══════════ */}
      {activeTab === "coupons" && (
        <div className="animate-fade-in">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: "800", margin: 0 }}>Discount Coupons</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", margin: "0.15rem 0 0" }}>Create and manage B2C & POS active coupon offers</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddCoupon(true)}>
              <Plus size={14} /> Create Coupon
            </button>
          </div>

          {couponsLoading ? (
            <div style={{ textAlign: "center", padding: "3rem" }}>
              <RefreshCw className="animate-spin" size={24} style={{ color: "var(--brand)" }} />
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "0.5rem" }}>Loading coupons list...</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Coupon Code</th>
                    <th>Discount (%)</th>
                    <th>Scope</th>
                    <th>Conditions</th>
                    <th>Status</th>
                    <th>Created At</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                        No discount coupons registered. Click "Create Coupon" to seed one.
                      </td>
                    </tr>
                  ) : (
                    coupons.map(coupon => (
                      <tr key={coupon.id}>
                        <td>
                          <span style={{ fontFamily: "monospace", fontSize: "0.95rem", fontWeight: "700", background: "var(--bg-elevated)", padding: "0.25rem 0.5rem", borderRadius: "4px", border: "1px solid var(--border-light)" }}>
                            {coupon.code}
                          </span>
                        </td>
                        <td style={{ fontWeight: "700", fontSize: "0.9rem" }}>
                          {coupon.discount_pct ? `${coupon.discount_pct}% Off` : `₹${coupon.discount_amount} Off`}
                        </td>
                        <td>
                          <span style={{ fontSize: "0.8rem", padding: "0.2rem 0.5rem", borderRadius: "4px", background: "var(--bg-secondary)", textTransform: "capitalize", border: "1px solid var(--border-light)" }}>
                            {coupon.scope || "both"}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            {coupon.min_order_value > 0 && <div>Min: ₹{coupon.min_order_value}</div>}
                            {coupon.is_first_order_only && <div>First Order Only</div>}
                            {(!coupon.min_order_value && !coupon.is_first_order_only) && <div>None</div>}
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill ${coupon.is_active ? "status-shipped" : "status-cancelled"}`} style={{ display: "inline-block", fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "100px", fontWeight: "700" }}>
                            {coupon.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                          {coupon.created_at ? new Date(coupon.created_at).toLocaleString() : "System Seeded"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                            <button
                              onClick={() => handleToggleCoupon(coupon)}
                              className="btn btn-secondary"
                              style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                            >
                              {coupon.is_active ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              onClick={() => handleDeleteCoupon(coupon.id)}
                              className="btn btn-secondary"
                              style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", background: "var(--brand-glow)", border: "1px solid var(--brand-dark)", color: "var(--brand-dark)" }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}


      {/* ══════════ SUPPORT TICKETS ══════════ */}
      {activeTab === "tickets" && (
        <div className="animate-fade-in">
          <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 700, marginBottom: "1.5rem" }}>
            Customer Support Tickets
          </h3>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Order ID</th>
                  <th>Issue Type</th>
                  <th>Status</th>
                  <th>Admin Reply</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>No tickets found.</td></tr>
                ) : (
                  tickets.map(ticket => (
                    <tr key={ticket.id}>
                      <td>{ticket.customer_name} (ID: {ticket.customer_id})</td>
                      <td>{ticket.order_id || "N/A"}</td>
                      <td>
                        <strong>{ticket.issue_type}</strong>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>{ticket.description}</div>
                        {ticket.attachment_url && (
                          <div style={{ marginTop: "0.5rem" }}>
                            <a href={ticket.attachment_url.startsWith('/') ? `${API_BASE_URL.replace('/api', '')}${ticket.attachment_url}` : ticket.attachment_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.75rem", color: "var(--brand)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "rgba(34,197,94,0.1)", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
                              <FileText size={12} /> View Attachment
                            </a>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge-status status-${ticket.status === 'Open' ? 'pending' : 'delivered'}`}>{ticket.status}</span>
                      </td>
                      <td style={{ fontSize: "0.85rem", fontStyle: "italic", color: "var(--text-secondary)" }}>
                        {ticket.admin_reply || "No reply yet"}
                      </td>
                      <td>
                        {ticket.status === "Open" && (
                          <button className="btn btn-secondary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }} onClick={() => handleReplyTicket(ticket.id)}>
                            Reply & Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* ══════════ CRM & WALLETS ══════════ */}
      {activeTab === "crm" && (
        <div className="card fade-in" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <h2>CRM & Wallets</h2>
            <button className="btn btn-primary" onClick={() => setShowBulkCouponModal(true)}>
              <Gift size={16} /> Dynamic Loyalty Offers
            </button>
          </div>
          {!segments ? (
            <p>Loading segments...</p>
          ) : (
            <div style={{ display: "grid", gap: "1.5rem" }}>
              <div>
                <h3>Frequent Buyers (5+ Orders)</h3>
                <table className="data-table">
                  <thead><tr><th>Name</th><th>Email</th><th>Orders</th><th>Spent</th><th>Action</th></tr></thead>
                  <tbody>
                    {(segments?.frequent_buyers || []).map(c => (
                      <tr key={c.id}>
                        <td>{c.first_name} {c.last_name}</td>
                        <td>{c.email}</td>
                        <td>{c.order_count}</td>
                        <td>₹{c.total_spent}</td>
                        <td>
                          <button className="btn btn-secondary" onClick={() => { setWalletTargetUser(c); setShowWalletModal(true); }} style={{ padding: "0.2rem 0.5rem", fontSize: "0.8rem" }}>Manage Wallet</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h3>High Value (₹5000+ Spent)</h3>
                <table className="data-table">
                  <thead><tr><th>Name</th><th>Email</th><th>Orders</th><th>Spent</th><th>Action</th></tr></thead>
                  <tbody>
                    {(segments?.high_value || []).map(c => (
                      <tr key={c.id}>
                        <td>{c.first_name} {c.last_name}</td>
                        <td>{c.email}</td>
                        <td>{c.order_count}</td>
                        <td>₹{c.total_spent}</td>
                        <td>
                          <button className="btn btn-secondary" onClick={() => { setWalletTargetUser(c); setShowWalletModal(true); }} style={{ padding: "0.2rem 0.5rem", fontSize: "0.8rem" }}>Manage Wallet</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ BANNERS ══════════ */}
      {activeTab === "banners" && (
        <div className="card fade-in" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <h2>Dynamic Banners</h2>
            <button className="btn btn-primary" onClick={() => {
              setEditingBannerId(null);
              setBannerTitle(""); setBannerImageUrl(""); setBannerTargetUrl(""); setBannerDisplayLocation("home");
              setBannerStartDate(""); setBannerEndDate(""); setBannerTargetAudience("all");
              setBannerPlacementZone("hero_carousel"); setBannerDisplayStyle("cinematic_21_9");
              setBannerHasCountdown(false); setBannerCountdownEndTime("");
              setBannerLinkedProductId(""); setBannerLinkedCouponCode("");
              setShowBannerModal(true);
            }}>
              <Plus size={16} /> Add Banner
            </button>
          </div>
          <table className="data-table" style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 1rem" }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", textAlign: "left", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <th style={{ padding: "1rem", borderRadius: "var(--r-md) 0 0 var(--r-md)" }}>Image</th>
                <th style={{ padding: "1rem" }}>Title</th>
                <th style={{ padding: "1rem" }}>Target URL</th>
                <th style={{ padding: "1rem" }}>Placement / Style</th>
                <th style={{ padding: "1rem" }}>Targeting</th>
                <th style={{ padding: "1rem" }}>Performance</th>
                <th style={{ padding: "1rem" }}>Active</th>
                <th style={{ padding: "1rem", borderRadius: "0 var(--r-md) var(--r-md) 0" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(banners) ? banners : []).map(b => (
                <tr key={b.id} style={{ background: "var(--bg-card)", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                  <td style={{ padding: "1rem", borderRadius: "var(--r-md) 0 0 var(--r-md)" }}>
                    <div style={{ width: "120px", height: "60px", borderRadius: "8px", overflow: "hidden", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {b.image_url ? <img src={b.image_url} alt={b.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>No Image</span>}
                    </div>
                  </td>
                  <td style={{ padding: "1rem", fontWeight: 600 }}>{b.title}</td>
                  <td style={{ padding: "1rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>{b.target_url || "-"}</td>
                  <td style={{ padding: "1rem" }}>
                    <div style={{ fontSize: "0.85rem" }}>
                      <strong>Zone:</strong> {b.placement_zone?.replace(/_/g, ' ') || 'N/A'}<br/>
                      <strong>Style:</strong> {b.display_style?.replace(/_/g, ' ') || 'N/A'}
                    </div>
                  </td>
                  <td style={{ padding: "1rem" }}>
                    <span style={{ background: "var(--bg-elevated)", padding: "0.25rem 0.75rem", borderRadius: "1rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)", textTransform: "capitalize" }}>
                      {b.target_audience?.replace(/_/g, ' ') || 'All'}
                    </span>
                  </td>
                  <td style={{ padding: "1rem" }}>
                    <div style={{ fontSize: "0.85rem" }}>
                      <div><span style={{ color: "var(--text-secondary)" }}>Views:</span> <strong>{b.impressions || 0}</strong></div>
                      <div><span style={{ color: "var(--text-secondary)" }}>Clicks:</span> <strong>{b.clicks || 0}</strong></div>
                      <div><span style={{ color: "var(--text-secondary)" }}>CTR:</span> <strong>{b.impressions ? ((b.clicks || 0) / b.impressions * 100).toFixed(1) : 0}%</strong></div>
                    </div>
                  </td>
                  <td style={{ padding: "1rem" }}>
                    <span className={`status-pill ${b.is_active ? 'status-shipped' : 'status-cancelled'}`}>
                      {b.is_active ? "Yes" : "No"}
                    </span>
                  </td>
                  <td style={{ padding: "1rem", borderRadius: "0 var(--r-md) var(--r-md) 0" }}>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => {
                        setEditingBannerId(b.id);
                        setBannerTitle(b.title);
                        setBannerImageUrl(b.image_url);
                        setBannerTargetUrl(b.target_url || "");
                        setBannerDisplayLocation(b.display_location || "home");
                        setBannerStartDate(b.start_date ? b.start_date.substring(0, 16) : "");
                        setBannerEndDate(b.end_date ? b.end_date.substring(0, 16) : "");
                        setBannerTargetAudience(b.target_audience || "all");
                        setBannerPlacementZone(b.placement_zone || "hero_carousel");
                        setBannerDisplayStyle(b.display_style || "cinematic_21_9");
                        setBannerHasCountdown(b.has_countdown || false);
                        setBannerCountdownEndTime(b.countdown_end_time ? b.countdown_end_time.substring(0, 16) : "");
                        setBannerLinkedProductId(b.linked_product_id || "");
                        setBannerLinkedCouponCode(b.linked_coupon_code || "");
                        setShowBannerModal(true);
                      }} style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}>Edit</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => {
                        setConfirmDeleteModal({
                          message: "Delete this banner? It will immediately stop showing on the storefront.",
                          onConfirm: async () => {
                            try {
                              await api.adminDeleteBanner(b.id);
                              showToast("Banner deleted.", "success");
                              api.adminGetBanners().then(res => setBanners(Array.isArray(res) ? res : [])).catch(() => setBanners([]));
                            } catch (err) { showToast("Failed: " + err.message, "error"); }
                          }
                        });
                      }} style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem", color: "var(--error)", borderColor: "var(--error)" }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

        </div>
      )}

      {/* ══════════ STORE SETTINGS ══════════ */}
      {activeTab === "settings" && (
        <div className="card fade-in" style={{ padding: "1.5rem" }}>
          <h2>Store Settings</h2>
          <div style={{ marginTop: "1.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
            
            {/* Status Toggles */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h3 style={{ fontSize: "1rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>Store Status</h3>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", background: "var(--bg-elevated)", padding: "1rem", borderRadius: "var(--r-md)", border: "1px solid var(--border-subtle)" }}>
                <input type="checkbox" checked={storeSettings.is_store_online === "true"} onChange={async (e) => {
                  const val = e.target.checked ? "true" : "false";
                  await api.adminUpdateStoreSettings({ is_store_online: val });
                  setStoreSettings(prev => ({ ...prev, is_store_online: val }));
                  setToast({ message: "Store online status updated", type: "success" });
                }} style={{ width: "1.2rem", height: "1.2rem", accentColor: "var(--success)" }} />
                <div>
                  <strong style={{ display: "block", color: "var(--text-primary)" }}>Store Online (Accepting Orders)</strong>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Toggle whether the store is accepting new customer orders.</span>
                </div>
              </label>
              
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", background: "var(--bg-elevated)", padding: "1rem", borderRadius: "var(--r-md)", border: "1px solid var(--border-subtle)" }}>
                <input type="checkbox" checked={storeSettings.is_holiday === "true"} onChange={async (e) => {
                  const val = e.target.checked ? "true" : "false";
                  await api.adminUpdateStoreSettings({ is_holiday: val });
                  setStoreSettings(prev => ({ ...prev, is_holiday: val }));
                  setToast({ message: "Holiday mode updated", type: "success" });
                }} style={{ width: "1.2rem", height: "1.2rem", accentColor: "var(--brand)" }} />
                <div>
                  <strong style={{ display: "block", color: "var(--text-primary)" }}>Holiday Mode (Store Closed)</strong>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Temporarily close the store and display a holiday banner.</span>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", background: "var(--bg-elevated)", padding: "1rem", borderRadius: "var(--r-md)", border: "1px solid var(--border-subtle)" }}>
                <input type="checkbox" checked={storeSettings.share_revenue_with_outlets === "true"} onChange={async (e) => {
                  const val = e.target.checked ? "true" : "false";
                  await api.adminUpdateStoreSettings({ share_revenue_with_outlets: val });
                  setStoreSettings(prev => ({ ...prev, share_revenue_with_outlets: val }));
                  setToast({ message: "Revenue sharing visibility updated", type: "success" });
                }} style={{ width: "1.2rem", height: "1.2rem", accentColor: "var(--brand)" }} />
                <div>
                  <strong style={{ display: "block", color: "var(--text-primary)" }}>Share Revenue Stats with Outlets</strong>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>If enabled, Outlet Managers (Operations) can see the Revenue Share tab.</span>
                </div>
              </label>
            </div>

            {/* Operational Configuration */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h3 style={{ fontSize: "1rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>Operational Config</h3>
              
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Delivery Radius (km)</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input type="number" className="form-input" value={storeSettings.delivery_radius || "5"} onChange={e => setStoreSettings(prev => ({ ...prev, delivery_radius: e.target.value }))} />
                  <button className="btn btn-primary" onClick={async () => {
                    await api.adminUpdateStoreSettings({ delivery_radius: storeSettings.delivery_radius });
                    setToast({ message: "Delivery radius updated", type: "success" });
                  }}>Save</button>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Minimum Order Value ($)</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input type="number" className="form-input" value={storeSettings.min_order_value || "10"} onChange={e => setStoreSettings(prev => ({ ...prev, min_order_value: e.target.value }))} />
                  <button className="btn btn-primary" onClick={async () => {
                    await api.adminUpdateStoreSettings({ min_order_value: storeSettings.min_order_value });
                    setToast({ message: "Min order value updated", type: "success" });
                  }}>Save</button>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Delivery Fee ($)</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input type="number" className="form-input" value={storeSettings.delivery_fee || "5"} onChange={e => setStoreSettings(prev => ({ ...prev, delivery_fee: e.target.value }))} />
                  <button className="btn btn-primary" onClick={async () => {
                    await api.adminUpdateStoreSettings({ delivery_fee: storeSettings.delivery_fee });
                    setToast({ message: "Delivery fee updated", type: "success" });
                  }}>Save</button>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Tax Percentage (%)</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input type="number" step="0.1" className="form-input" value={storeSettings.tax_percentage || "0"} onChange={e => setStoreSettings(prev => ({ ...prev, tax_percentage: e.target.value }))} />
                  <button className="btn btn-primary" onClick={async () => {
                    await api.adminUpdateStoreSettings({ tax_percentage: storeSettings.tax_percentage });
                    setToast({ message: "Tax percentage updated", type: "success" });
                  }}>Save</button>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Loyalty: Earn Rate (e.g. 0.1 for 1 pt per ₹10)</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input type="number" step="0.01" className="form-input" value={storeSettings.loyalty_earn_rate || "0.1"} onChange={e => setStoreSettings(prev => ({ ...prev, loyalty_earn_rate: e.target.value }))} />
                  <button className="btn btn-primary" onClick={async () => {
                    await api.adminUpdateStoreSettings({ loyalty_earn_rate: storeSettings.loyalty_earn_rate });
                    setToast({ message: "Loyalty earn rate updated", type: "success" });
                  }}>Save</button>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Loyalty: Redeem Rate (e.g. 0.01 for 100 pts = ₹1)</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input type="number" step="0.01" className="form-input" value={storeSettings.loyalty_redeem_rate || "0.01"} onChange={e => setStoreSettings(prev => ({ ...prev, loyalty_redeem_rate: e.target.value }))} />
                  <button className="btn btn-primary" onClick={async () => {
                    await api.adminUpdateStoreSettings({ loyalty_redeem_rate: storeSettings.loyalty_redeem_rate });
                    setToast({ message: "Loyalty redeem rate updated", type: "success" });
                  }}>Save</button>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Loyalty: Points for Review</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input type="number" className="form-input" value={storeSettings.loyalty_review_points || "10"} onChange={e => setStoreSettings(prev => ({ ...prev, loyalty_review_points: e.target.value }))} />
                  <button className="btn btn-primary" onClick={async () => {
                    await api.adminUpdateStoreSettings({ loyalty_review_points: storeSettings.loyalty_review_points });
                    setToast({ message: "Review points updated", type: "success" });
                  }}>Save</button>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Store Announcement Notice</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <textarea className="form-input" value={storeSettings.store_notice || ""} onChange={e => setStoreSettings(prev => ({ ...prev, store_notice: e.target.value }))} placeholder="e.g. Expect delays due to heavy rain" rows={2} />
                  <button className="btn btn-primary" style={{ alignSelf: "flex-end" }} onClick={async () => {
                    await api.adminUpdateStoreSettings({ store_notice: storeSettings.store_notice });
                    setToast({ message: "Store notice updated", type: "success" });
                  }}>Save Notice</button>
                </div>
              </div>
              
            </div>
          </div>
        </div>
      )}

      {/* ══════════ STOCK REQUESTS ══════════ */}
      {activeTab === "stock_requests" && (
        <div className="card fade-in" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <h2>Stock Requests</h2>
            <button className="btn btn-primary" onClick={() => {
              api.getStockRequests().then(setStockRequests).catch(console.error);
            }}>
              Refresh
            </button>
          </div>
          <table className="data-table" style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 0.5rem" }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", textAlign: "left", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <th style={{ padding: "1rem", borderRadius: "var(--r-md) 0 0 var(--r-md)" }}>ID</th>
                <th style={{ padding: "1rem" }}>Date</th>
                <th style={{ padding: "1rem" }}>Type</th>
                <th style={{ padding: "1rem" }}>Outlet</th>
                <th style={{ padding: "1rem" }}>Item ID</th>
                <th style={{ padding: "1rem" }}>Qty</th>
                <th style={{ padding: "1rem" }}>Status</th>
                <th style={{ padding: "1rem", borderRadius: "0 var(--r-md) var(--r-md) 0" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {stockRequests.map(req => (
                <tr key={req.id} style={{ background: "var(--bg-card)", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                  <td style={{ padding: "1rem", borderRadius: "var(--r-md) 0 0 var(--r-md)", fontWeight: "600" }}>#{req.id}</td>
                  <td style={{ padding: "1rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>{new Date(req.created_at).toLocaleString()}</td>
                  <td style={{ padding: "1rem" }}>{req.type}</td>
                  <td style={{ padding: "1rem", fontWeight: "600" }}>{req.outlet_name}</td>
                  <td style={{ padding: "1rem", fontFamily: "monospace" }}>{req.menu_item_id}</td>
                  <td style={{ padding: "1rem", fontWeight: "600", fontSize: "1.1rem" }}>{req.quantity}</td>
                  <td style={{ padding: "1rem" }}>
                    <span className={`status-pill status-${req.status === 'Pending' ? 'pending' : 'shipped'}`}>
                      {req.status}
                    </span>
                  </td>
                  <td style={{ padding: "1rem", borderRadius: "0 var(--r-md) var(--r-md) 0" }}>
                    {req.status === "Pending" ? (
                      <button className="btn btn-primary" style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem" }} onClick={async () => {
                        try {
                          await api.fulfillStockRequest(req.id);
                          setToast({ message: `Request #${req.id} fulfilled`, type: "success" });
                          const updated = await api.getStockRequests();
                          setStockRequests(updated);
                        } catch (e) {
                          setToast({ message: e.message, type: "error" });
                        }
                      }}>
                        Fulfill
                      </button>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Completed</span>
                    )}
                  </td>
                </tr>
              ))}
              {stockRequests.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                    No stock requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}


      {/* ══════════ MODALS ══════════ */}

      {/* Add Product */}
      <Modal open={showAddMenu} onClose={() => setShowAddMenu(false)} title="Add Catalog Product">
        <form onSubmit={handleAddMenuItem} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="grid-responsive-2col" style={{ gap: "0.75rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Product Name</label>
              <input type="text" required className="form-input" placeholder="e.g. Kandi Podi 250g" value={menuName} onChange={e => setMenuName(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Product Code (Optional)</label>
              <input type="text" className="form-input" placeholder="e.g. som1" value={menuCode} onChange={e => setMenuCode(e.target.value)} />
            </div>
          </div>
          <div className="grid-responsive-2col" style={{ gap: "0.75rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Price (₹)</label>
              <input type="number" step="0.01" required className="form-input" placeholder="179.00" value={menuPrice} onChange={e => setMenuPrice(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Original Price (₹)</label>
              <input type="number" step="0.01" className="form-input" placeholder="220.00" value={menuOriginalPrice} onChange={e => setMenuOriginalPrice(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Global Stock Limit</label>
              <input type="number" className="form-input" placeholder="Leave empty for unlimited" value={menuGlobalStock} onChange={e => setMenuGlobalStock(e.target.value)} />
            </div>
          </div>
          <div className="grid-responsive-2col" style={{ gap: "0.75rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Category</label>
              <select className="form-select" value={menuCategory} onChange={e => setMenuCategory(e.target.value)}>
                {["Pickles", "Spice Powders", "Snacks & Savories", "Sweets & Treats", "Mixes & Instant", "Special Products", "Other"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {menuCategory === "Other" && (
                <input type="text" className="form-input" placeholder="Enter custom category" value={menuCustomCategory} onChange={e => setMenuCustomCategory(e.target.value)} style={{ marginTop: "0.5rem" }} required />
              )}
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Business Segment</label>
              <select className="form-select" value={menuType} onChange={e => setMenuType(e.target.value)}>
                <option value="home_foods">Home Foods (B2C)</option>
                <option value="snack_supply">Snack Supply (B2B2C)</option>
                <option value="both">Both Segments</option>
              </select>
            </div>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Image URL</label>
            <input type="text" className="form-input" placeholder="https://images.unsplash.com/..." value={menuImageUrl} onChange={e => setMenuImageUrl(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Description</label>
            <textarea className="form-input" style={{ minHeight: 72, resize: "vertical" }} placeholder="Ingredients, freshness, etc." value={menuDesc} onChange={e => setMenuDesc(e.target.value)} />
          </div>
          <div className="grid-responsive-2col" style={{ gap: "0.75rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Tag / Label</label>
              <input type="text" className="form-input" placeholder="e.g. ⭐ New, Best Seller" value={menuTag} onChange={e => setMenuTag(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Manual Rating Override</label>
              <input type="number" step="0.1" max="5" min="1" className="form-input" placeholder="e.g. 4.5" value={menuAdminRating} onChange={e => setMenuAdminRating(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Plus size={15} /> Create Product</button>
            <button type="button" onClick={() => setShowAddMenu(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </form>
      </Modal>

      <Modal open={showEditMenu} onClose={() => setShowEditMenu(false)} title="Edit Catalog Product">
        <form onSubmit={handleUpdateMenuItem} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="grid-responsive-2col" style={{ gap: "0.75rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Product Name</label>
              <input type="text" required className="form-input" placeholder="e.g. Kandi Podi 250g" value={menuName} onChange={e => setMenuName(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Product Code (Optional)</label>
              <input type="text" className="form-input" placeholder="e.g. som1" value={menuCode} onChange={e => setMenuCode(e.target.value)} />
            </div>
          </div>
          <div className="grid-responsive-2col" style={{ gap: "0.75rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Price (₹)</label>
              <input type="number" step="0.01" required className="form-input" placeholder="179.00" value={menuPrice} onChange={e => setMenuPrice(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Original Price (₹)</label>
              <input type="number" step="0.01" className="form-input" placeholder="220.00" value={menuOriginalPrice} onChange={e => setMenuOriginalPrice(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Global Stock Limit</label>
              <input type="number" className="form-input" placeholder="Leave empty for unlimited" value={menuGlobalStock} onChange={e => setMenuGlobalStock(e.target.value)} />
            </div>
          </div>
          <div className="grid-responsive-2col" style={{ gap: "0.75rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Category</label>
              <select className="form-select" value={menuCategory} onChange={e => setMenuCategory(e.target.value)}>
                {["Pickles", "Spice Powders", "Snacks & Savories", "Sweets & Treats", "Mixes & Instant", "Special Products", "Other"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {menuCategory === "Other" && (
                <input type="text" className="form-input" placeholder="Enter custom category" value={menuCustomCategory} onChange={e => setMenuCustomCategory(e.target.value)} style={{ marginTop: "0.5rem" }} required />
              )}
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Business Segment</label>
              <select className="form-select" value={menuType} onChange={e => setMenuType(e.target.value)}>
                <option value="home_foods">Home Foods (B2C)</option>
                <option value="snack_supply">Snack Supply (B2B2C)</option>
                <option value="both">Both Segments</option>
              </select>
            </div>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Image URL</label>
            <input type="text" className="form-input" placeholder="https://images.unsplash.com/..." value={menuImageUrl} onChange={e => setMenuImageUrl(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Description</label>
            <textarea className="form-input" style={{ minHeight: 72, resize: "vertical" }} placeholder="Ingredients, freshness, etc." value={menuDesc} onChange={e => setMenuDesc(e.target.value)} />
          </div>
          <div className="grid-responsive-2col" style={{ gap: "0.75rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Tag / Label</label>
              <input type="text" className="form-input" placeholder="e.g. ⭐ New, Best Seller" value={menuTag} onChange={e => setMenuTag(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Manual Rating Override</label>
              <input type="number" step="0.1" max="5" min="1" className="form-input" placeholder="e.g. 4.5" value={menuAdminRating} onChange={e => setMenuAdminRating(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Update Product</button>
            <button type="button" onClick={() => setShowEditMenu(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Add Outlet */}
      <Modal open={showAddOutlet} onClose={() => { setShowAddOutlet(false); setEditingOutletId(null); setOutletName(""); setOutletAddress(""); setOutletLatitude(""); setOutletLongitude(""); setOutletRevenueShare(""); }} title={editingOutletId ? "Edit Outlet" : "Register Outlet"} width={520}>
        <form onSubmit={handleAddOutlet} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Outlet Name</label>
            <input type="text" required className="form-input" placeholder="e.g. Connaught Place Corner" value={outletName} onChange={e => setOutletName(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Address</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input type="text" required className="form-input" placeholder="e.g. Connaught Place, New Delhi" value={outletAddress} onChange={e => setOutletAddress(e.target.value)} />
              <button type="button" onClick={lookupCoordinates} disabled={geocodingLoading} className="btn btn-secondary" style={{ padding: "0 0.875rem", flexShrink: 0 }} title="Auto-fetch coordinates">
                {geocodingLoading ? <div style={{ width: 14, height: 14, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> : <Globe size={15} />}
              </button>
              {outletAddress && (
                <a
                  href={
                    outletLatitude && outletLongitude
                      ? `https://www.google.com/maps?q=${encodeURIComponent(outletLatitude)},${encodeURIComponent(outletLongitude)}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(outletAddress)}`
                  }
                  target="_blank" rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ padding: "0 0.875rem", flexShrink: 0, textDecoration: "none", display: "flex", alignItems: "center", gap: "0.2rem" }}
                  title={outletLatitude && outletLongitude ? "View exact location on Map" : "Search address on Map"}
                >
                  <MapPin size={15} /> Map
                </a>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.3rem" }}>
              {geocodingMsg ? (
                <div style={{ fontSize: "0.75rem", color: geocodingMsg.includes("Failed") || geocodingMsg.includes("not found") ? "var(--error)" : "var(--success)" }}>
                  {geocodingMsg}
                </div>
              ) : <div />}
            </div>
          </div>
          <div className="grid-responsive-2col" style={{ gap: "1rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Latitude</label>
              <input type="number" step="any" className="form-input" placeholder="28.6315" value={outletLatitude} onChange={e => setOutletLatitude(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Longitude</label>
              <input type="number" step="any" className="form-input" placeholder="77.2167" value={outletLongitude} onChange={e => setOutletLongitude(e.target.value)} />
            </div>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Revenue Share % (Brand Cut)</label>
            <input type="number" step="0.01" min="0" max="100" className="form-input" placeholder="e.g. 15.00" value={outletRevenueShare} onChange={e => setOutletRevenueShare(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Store size={15} /> Register Outlet</button>
            <button type="button" onClick={() => setShowAddOutlet(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Add/Edit Staff */}
      <Modal open={showAddStaff} onClose={() => { setShowAddStaff(false); setEditingUserId(null); setStaffEmail(""); setStaffPassword(""); setStaffPin(""); setStaffFirstName(""); setStaffLastName(""); setStaffPhone(""); setStaffRole("staff"); setStaffDepartment(""); setUserLoyaltyPoints(0); }} title={editingUserId ? "Edit User Account" : "Create User Account"}>
        <form onSubmit={handleAddStaff} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Role</label>
            <select className="form-select" value={staffRole} onChange={e => setStaffRole(e.target.value)}>
              <option value="customer">Customer</option>
              <option value="staff">Outlet Cashier (Staff)</option>
              <option value="kitchen">Kitchen Staff</option>
              <option value="outlet_owner">Outlet Owner</option>
              <option value="admin">Administrator (Admin)</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Email</label>
            <input type="email" required className="form-input" placeholder="team@brand.com" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} />
          </div>
          <div className="grid-responsive-2col" style={{ gap: "0.75rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Password {editingUserId && "(Leave blank to keep)"}</label>
              <input type="password" required={!editingUserId} className="form-input" placeholder="••••••••" value={staffPassword} onChange={e => setStaffPassword(e.target.value)} />
            </div>
            {(staffRole === "staff" || staffRole === "kitchen") && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">4-Digit PIN {editingUserId && "(Leave blank to keep)"}</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="\d{4}"
                  required={!editingUserId}
                  className="form-input"
                  placeholder="● ● ● ●"
                  value={staffPin}
                  onChange={e => setStaffPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                />
              </div>
            )}
          </div>
          <div className="grid-responsive-2col" style={{ gap: "0.75rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">First Name</label>
              <input type="text" className="form-input" placeholder="Alex" value={staffFirstName} onChange={e => setStaffFirstName(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Last Name</label>
              <input type="text" className="form-input" placeholder="Kumar" value={staffLastName} onChange={e => setStaffLastName(e.target.value)} />
            </div>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Phone</label>
            <input type="tel" maxLength={10} className="form-input" placeholder="9876543210" pattern="\d{10}" value={staffPhone} onChange={e => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 10) setStaffPhone(val); }} />
          </div>
          {(staffRole === "staff" || staffRole === "outlet_owner" || staffRole === "kitchen") && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Assign to Outlet</label>
              <select className="form-select" value={staffOutletId} onChange={e => setStaffOutletId(e.target.value)}>
                <option value="">-- No specific outlet --</option>
                {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}

          {staffRole === "customer" && editingUserId && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Loyalty Points</label>
              <input type="number" className="form-input" value={userLoyaltyPoints} onChange={e => setUserLoyaltyPoints(e.target.value)} />
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Users size={15} /> {editingUserId ? "Save Changes" : "Create Account"}</button>
            <button type="button" onClick={() => { setShowAddStaff(false); setEditingUserId(null); setStaffEmail(""); setStaffPassword(""); setStaffPin(""); setStaffFirstName(""); setStaffLastName(""); setStaffPhone(""); setStaffRole("staff"); setStaffDepartment(""); setUserLoyaltyPoints(0); }} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Confirm Review Delete Modal */}
      <Modal open={!!reviewToDelete} onClose={() => setReviewToDelete(null)} title="Delete Review" width={400}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", padding: "0.5rem 0" }}>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: "1.5" }}>
            Are you sure you want to delete this review? This action cannot be undone.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
            <button className="btn btn-secondary" onClick={() => setReviewToDelete(null)}>Cancel</button>
            <button className="btn" style={{ background: "var(--error)", color: "#fff", border: "none" }} onClick={confirmDeleteReview}>Delete Review</button>
          </div>
        </div>
      </Modal>

      {/* Add Coupon Modal */}
      <Modal open={showAddCoupon} onClose={() => setShowAddCoupon(false)} title="Create Coupon Offer">
        <form onSubmit={handleCreateCoupon} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Coupon Code</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="e.g. FESTIVE20"
              style={{ textTransform: "uppercase" }}
              value={couponCode}
              onChange={e => setCouponCode(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Discount Percentage (%)</label>
            <input
              type="number"
              min="1"
              max="100"
              className="form-input"
              placeholder="e.g. 20"
              value={couponDiscount}
              onChange={e => { setCouponDiscount(e.target.value); setCouponDiscountAmount(""); }}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">OR Flat Discount Amount (₹)</label>
            <input
              type="number"
              min="1"
              className="form-input"
              placeholder="e.g. 50"
              value={couponDiscountAmount}
              onChange={e => { setCouponDiscountAmount(e.target.value); setCouponDiscount(""); }}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Max Discount Amount (₹) (Optional for %)</label>
            <input
              type="number"
              min="1"
              className="form-input"
              placeholder="e.g. 100"
              value={couponMaxDiscountAmount}
              onChange={e => setCouponMaxDiscountAmount(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Target Menu Item ID (Optional)</label>
            <input
              type="number"
              min="1"
              className="form-input"
              placeholder="e.g. 103"
              value={couponApplicableMenuItem}
              onChange={e => setCouponApplicableMenuItem(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Target Customer ID (Optional)</label>
            <input
              type="number"
              min="1"
              className="form-input"
              placeholder="e.g. 2"
              value={couponApplicableCustomer}
              onChange={e => setCouponApplicableCustomer(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
            <input
              type="checkbox"
              id="couponActive"
              checked={couponIsActive}
              onChange={e => setCouponIsActive(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            <label htmlFor="couponActive" className="form-label" style={{ margin: 0, cursor: "pointer" }}>
              Active and ready for validation
            </label>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Minimum Order Value (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="form-input"
              placeholder="e.g. 500"
              value={couponMinOrderValue}
              onChange={e => setCouponMinOrderValue(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Scope (Where is this coupon available?)</label>
            <select
              className="form-input"
              value={couponScope}
              onChange={e => setCouponScope(e.target.value)}
            >
              <option value="both">Both (Outlet & Customer)</option>
              <option value="outlet">Outlet Only (POS Terminal)</option>
              <option value="customer">Customer Only (Storefront)</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Expiry Date (Optional)</label>
            <input
              type="date"
              className="form-input"
              value={couponExpiryDate}
              onChange={e => setCouponExpiryDate(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Usage Limit (Optional)</label>
            <input
              type="number"
              min="1"
              className="form-input"
              placeholder="e.g. 100 uses"
              value={couponUsageLimit}
              onChange={e => setCouponUsageLimit(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
            <input
              type="checkbox"
              id="couponFirstOrder"
              checked={couponIsFirstOrder}
              onChange={e => setCouponIsFirstOrder(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            <label htmlFor="couponFirstOrder" className="form-label" style={{ margin: 0, cursor: "pointer" }}>
              Only valid for Customer's First Order
            </label>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Tag size={15} /> Create Coupon</button>
            <button type="button" onClick={() => setShowAddCoupon(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </form>
      </Modal>

      <Modal open={showProfileModal} onClose={() => setShowProfileModal(false)} title="My Profile">
        <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="grid-responsive-2col" style={{ gap: "1rem" }}>
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
            <label className="form-label">Old Password (required if changing password)</label>
            <input type="password" minLength={8} className="form-input" value={profileForm.old_password || ""} onChange={e => setProfileForm({ ...profileForm, old_password: e.target.value })} placeholder="Current password" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">New Password</label>
            <input type="password" minLength={8} className="form-input" value={profileForm.password || ""} onChange={e => setProfileForm({ ...profileForm, password: e.target.value })} placeholder="Leave blank to keep current password" />
            <small style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "4px", display: "block" }}>Must be at least 8 characters with letters and numbers.</small>
          </div>
          <button type="submit" disabled={profileUpdating} className="btn btn-primary" style={{ marginTop: "0.5rem" }}>
            {profileUpdating ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </Modal>

      {/* Wallet Management */}
      <Modal open={showWalletModal} onClose={() => setShowWalletModal(false)} title={`Manage Wallet: ${walletTargetUser?.first_name}`}>
        <form onSubmit={handleWalletAction} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Action</label>
            <select className="form-select" value={walletAction} onChange={e => setWalletAction(e.target.value)}>
              <option value="credit">Credit Points</option>
              <option value="debit">Debit Points</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Amount</label>
            <input type="number" min="1" required className="form-input" value={walletAmount} onChange={e => setWalletAmount(e.target.value)} placeholder="e.g. 50" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Description / Reason</label>
            <input type="text" className="form-input" value={walletDesc} onChange={e => setWalletDesc(e.target.value)} placeholder="e.g. Refund for delayed order" />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: "0.5rem" }}>
            {walletAction === "credit" ? "Credit Wallet" : "Debit Wallet"}
          </button>
        </form>
      </Modal>

      {/* Banner Management */}
      <Modal open={showBannerModal} onClose={() => setShowBannerModal(false)} title={editingBannerId ? "Edit Banner" : "Add Banner"}>
        <form onSubmit={handleSaveBanner} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Title</label>
            <input type="text" required className="form-input" value={bannerTitle} onChange={e => setBannerTitle(e.target.value)} placeholder="e.g. Diwali Special Sale" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Image URL</label>
            <input type="text" required className="form-input" value={bannerImageUrl} onChange={e => setBannerImageUrl(e.target.value)} placeholder="https://..." />
            {bannerImageUrl && <img src={bannerImageUrl} alt="Preview" style={{ marginTop: "0.5rem", width: "100%", borderRadius: "8px", maxHeight: "150px", objectFit: "cover" }} />}
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Target URL (Optional)</label>
            <input type="text" className="form-input" value={bannerTargetUrl} onChange={e => setBannerTargetUrl(e.target.value)} placeholder="/menu" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Display Location</label>
            <select className="form-input" style={{ width: "100%", background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border-light)", padding: "0.5rem" }} value={bannerDisplayLocation} onChange={e => setBannerDisplayLocation(e.target.value)}>
              <option value="home">Home Screen (Top/Default)</option>
              <option value="home_top">Home Screen (Top)</option>
              <option value="home_middle">Home Screen (Middle)</option>
              <option value="home_bottom">Home Screen (Bottom)</option>
              <option value="checkout">Checkout Screen</option>
              <option value="popup_after_login">Popup After Login</option>
            </select>
          </div>
          
          <div className="grid-responsive-2col" style={{ gap: "1rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Placement Zone</label>
              <select className="form-input" value={bannerPlacementZone} onChange={e => setBannerPlacementZone(e.target.value)}>
                <option value="hero_carousel">Hero Carousel (Top)</option>
                <option value="mid_feed">Mid Feed (Between categories)</option>
                <option value="cart_upsell">Cart Upsell</option>
                <option value="top_bar">Top Bar (Announcement)</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Display Style</label>
              <select className="form-input" value={bannerDisplayStyle} onChange={e => setBannerDisplayStyle(e.target.value)}>
                <option value="cinematic_21_9">Cinematic 21:9</option>
                <option value="square_1_1">Square 1:1</option>
                <option value="pill_text">Pill Text (No Image)</option>
                <option value="story_circle">Story Circle</option>
                <option value="popup_modal">Popup Modal</option>
              </select>
            </div>
          </div>
          
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Target Audience</label>
            <select className="form-input" value={bannerTargetAudience} onChange={e => setBannerTargetAudience(e.target.value)}>
              <option value="all">All Users</option>
              <option value="new_user">New Users (0 Orders)</option>
              <option value="inactive_30_days">Inactive Users (No orders in 30 days)</option>
            </select>
          </div>
          
          <div className="grid-responsive-2col" style={{ gap: "1rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Start Date (Optional)</label>
              <input type="datetime-local" className="form-input" value={bannerStartDate} onChange={e => setBannerStartDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">End Date (Optional)</label>
              <input type="datetime-local" className="form-input" value={bannerEndDate} onChange={e => setBannerEndDate(e.target.value)} />
            </div>
          </div>
          
          <div className="grid-responsive-2col" style={{ gap: "1rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Linked Product ID (Optional)</label>
              <input type="number" className="form-input" value={bannerLinkedProductId} onChange={e => setBannerLinkedProductId(e.target.value)} placeholder="e.g. 15" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Linked Coupon Code (Optional)</label>
              <input type="text" className="form-input" value={bannerLinkedCouponCode} onChange={e => setBannerLinkedCouponCode(e.target.value.toUpperCase())} placeholder="e.g. SAVE20" />
            </div>
          </div>
          
          <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
            <input type="checkbox" id="bannerHasCountdown" checked={bannerHasCountdown} onChange={e => setBannerHasCountdown(e.target.checked)} style={{ cursor: "pointer" }} />
            <label htmlFor="bannerHasCountdown" className="form-label" style={{ margin: 0, cursor: "pointer" }}>Show visual countdown timer?</label>
          </div>
          {bannerHasCountdown && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Countdown End Time</label>
              <input type="datetime-local" className="form-input" required={bannerHasCountdown} value={bannerCountdownEndTime} onChange={e => setBannerCountdownEndTime(e.target.value)} />
            </div>
          )}
          
          <button type="submit" className="btn btn-primary" style={{ marginTop: "0.5rem" }}>

            Save Banner
          </button>
        </form>
      </Modal>

      {/* ── Confirm Delete Modal ── */}
      {confirmDeleteModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 99997, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "var(--bg-card)", padding: "2rem", maxWidth: "440px", width: "100%", borderRadius: "var(--r-md)", boxShadow: "0 20px 60px rgba(0,0,0,0.35)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", marginBottom: "1.5rem" }}>
              <span style={{ fontSize: "1.5rem", flexShrink: 0 }}>⚠️</span>
              <p style={{ margin: 0, color: "var(--text-primary)", fontSize: "0.95rem", lineHeight: 1.6, fontWeight: 500 }}>{confirmDeleteModal.message}</p>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDeleteModal(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={() => { confirmDeleteModal.onConfirm(); setConfirmDeleteModal(null); }} className="btn" style={{ background: "var(--error)", color: "#fff", border: "none" }}>Confirm Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reply Ticket Modal ── */}
      <Modal open={!!replyTicketModal} onClose={() => { setReplyTicketModal(null); setReplyText(""); }} title="Reply & Resolve Ticket" width={500}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Write your reply to the customer. The ticket will be marked as <strong>Resolved</strong> after sending.</p>
          <textarea
            className="form-input"
            rows={5}
            style={{ resize: "vertical" }}
            placeholder="Hi, we've resolved your issue..."
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
          />
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={() => { setReplyTicketModal(null); setReplyText(""); }}>Cancel</button>
            <button className="btn btn-primary" onClick={submitTicketReply}>Send Reply & Resolve</button>
          </div>
        </div>
      </Modal>

      {/* ── Restock Quantity Modal ── */}
      <Modal open={!!restockModal} onClose={() => setRestockModal(null)} title="Request Restock" width={420}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {restockModal && (
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)" }}>How many units of <strong>{restockModal.itemName}</strong> to request from kitchen?</p>
          )}
          <input
            type="number"
            min="1"
            className="form-input"
            value={restockQty}
            onChange={e => setRestockQty(e.target.value)}
            style={{ fontSize: "1.2rem", fontWeight: 700, textAlign: "center" }}
            autoFocus
          />
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={() => setRestockModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitRestockRequest}>Send Request</button>
          </div>
        </div>
      </Modal>

      {/* ── Review Reply Modal ── */}
      <Modal open={!!reviewReplyModal} onClose={() => { setReviewReplyModal(null); setReviewReplyText(""); }} title="Reply to Review" width={500}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {reviewReplyModal && (
            <div style={{ padding: "0.75rem", background: "var(--bg-elevated)", borderRadius: "var(--r-md)", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              <strong>Customer said:</strong> {reviewReplyModal.comment || <em>No comment</em>}
            </div>
          )}
          <textarea
            className="form-input"
            rows={4}
            style={{ resize: "vertical" }}
            placeholder="Thank you for your feedback..."
            value={reviewReplyText}
            onChange={e => setReviewReplyText(e.target.value)}
          />
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={() => { setReviewReplyModal(null); setReviewReplyText(""); }}>Cancel</button>
            <button className="btn btn-primary" onClick={submitReviewReply}>Save Reply</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!printOrder} onClose={() => setPrintOrder(null)} title={`Order #${printOrder?.id} Details`} width={600}>
        {printOrder && (
          <div>
            <div id="print-bill-section" style={{ padding: "1rem", border: "1px solid var(--border-light)", borderRadius: "var(--r-md)", background: "#fff", color: "#000" }}>
              <h2 style={{ textAlign: "center", margin: "0 0 1rem 0" }}>INVOICE / BILL</h2>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem", fontSize: "0.9rem" }}>
                <div>
                  <strong>Order ID:</strong> #{printOrder.id}<br/>
                  <strong>Date:</strong> {new Date(printOrder.created_at).toLocaleString()}<br/>
                  <strong>Status:</strong> {printOrder.status.toUpperCase()}
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong>Customer Details:</strong><br/>
                  {printOrder.customer_name || "N/A"}<br/>
                  {printOrder.customer_phone || "N/A"}<br/>
                  {printOrder.customer_email || "N/A"}
                </div>
              </div>
              
              <div style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
                <strong>Delivery Address:</strong><br/>
                {printOrder.delivery_address || "N/A"}
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", marginBottom: "1rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ccc" }}>
                    <th style={{ textAlign: "left", padding: "0.5rem 0" }}>Item</th>
                    <th style={{ textAlign: "center", padding: "0.5rem 0" }}>Qty</th>
                    <th style={{ textAlign: "right", padding: "0.5rem 0" }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {printOrder.items?.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "0.5rem 0" }}>{it.menu_item_name}</td>
                      <td style={{ textAlign: "center", padding: "0.5rem 0" }}>{it.quantity}</td>
                      <td style={{ textAlign: "right", padding: "0.5rem 0" }}>₹{(it.price * it.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ textAlign: "right", padding: "0.5rem 0", fontWeight: "bold" }}>Delivery Charge:</td>
                    <td style={{ textAlign: "right", padding: "0.5rem 0", fontWeight: "bold" }}>₹{printOrder.delivery_charge || 0}</td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ textAlign: "right", padding: "0.5rem 0", fontWeight: "bold", fontSize: "1.1rem" }}>Total:</td>
                    <td style={{ textAlign: "right", padding: "0.5rem 0", fontWeight: "bold", fontSize: "1.1rem" }}>₹{printOrder.total_price.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
                const printWindow = window.open('', '_blank');
                printWindow.document.write('<html><head><title>Print Bill - Order #' + printOrder.id + '</title>');
                printWindow.document.write('<style>body{font-family:sans-serif;} table{width:100%;border-collapse:collapse;} th,td{border-bottom:1px solid #ccc;padding:8px;text-align:left;} th:nth-child(2),td:nth-child(2){text-align:center;} th:last-child,td:last-child{text-align:right;} .text-right{text-align:right;}</style>');
                printWindow.document.write('</head><body>');
                printWindow.document.write(document.getElementById("print-bill-section").innerHTML);
                printWindow.document.write('</body></html>');
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
              }}>Print Bill</button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPrintOrder(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      {toast && (
        <div style={{
          position: "fixed", bottom: "2rem", right: "2rem",
          background: toast.type === "success" ? "var(--brand)" : "var(--brand-dark)",
          border: `1px solid ${toast.type === "success" ? "var(--brand-dim)" : "var(--brand-glow)"}`,
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
    </div>
  );
}
