import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { api, API_BASE_URL } from "../utils/api";
import {
  Package, AlertTriangle, Plus, Store, Users, MapPin,
  Globe, QrCode, TrendingUp, FileText, ShoppingBag,
  Truck, Clock, Trash2, Calendar, RefreshCw, BarChart3,
  X, LogOut, MessageSquare, Star, Tag, ArrowRight
} from "lucide-react";
import QRGenerator from "./QRGenerator";

const INITIAL_SUPPLIERS = [
  { id: 1, name: "Prasad Organics Ltd", contact: "Siva Prasad", phone: "9848022338", items: ["Organic Red Chillies", "Dry Ginger Root", "Toor Dal"] },
  { id: 2, name: "Andhra Ghee Farms", contact: "Ravi Naidu", phone: "9000188277", items: ["Pure Buffalo Ghee", "Fresh Cow Ghee"] },
  { id: 3, name: "Konaseema Mango Groves", contact: "Satya Prasad", phone: "9440566311", items: ["Raw Mangoes (Avakaya Grade)", "Ripe Juicing Mangoes"] },
  { id: 4, name: "PackWell Containers", contact: "Anil Kumar", phone: "8008811223", items: ["Glass Pickle Jars (250g)", "Aroma Lock Pouches", "Sweet Boxes"] }
];

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

  const [activeTab, setActiveTab] = useState("overview");
  const [orders, setOrders] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [menu, setMenu] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [batches, setBatches] = useState([]);
  const [suppliers, _setSuppliers] = useState(INITIAL_SUPPLIERS);
  
  // Product Reviews moderation states
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

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
  const [couponIsActive, setCouponIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [trackingCodes, setTrackingCodes] = useState({});
  const [trackingLabels, setTrackingLabels] = useState({});
  const [trackingLinks, setTrackingLinks] = useState({});

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [menuName, setMenuName] = useState("");
  const [menuCode, setMenuCode] = useState("");
  const [menuPrice, setMenuPrice] = useState("");
  const [menuOriginalPrice, setMenuOriginalPrice] = useState("");
  const [menuCategory, setMenuCategory] = useState("Pickles");
  const [menuType, setMenuType] = useState("home_foods");
  const [menuDesc, setMenuDesc] = useState("");
  const [menuImageUrl, setMenuImageUrl] = useState("");
  const [menuGlobalStock, setMenuGlobalStock] = useState("");
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [editMenuId, setEditMenuId] = useState(null);

  const [showAddOutlet, setShowAddOutlet] = useState(false);
  const [editingOutletId, setEditingOutletId] = useState(null);
  const [outletName, setOutletName] = useState("");
  const [outletAddress, setOutletAddress] = useState("");
  const [outletLatitude, setOutletLatitude] = useState("");
  const [outletLongitude, setOutletLongitude] = useState("");
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [geocodingMsg, setGeocodingMsg] = useState("");

  const [assignForms, setAssignForms] = useState({}); // { [outletId]: { menuItemId: "", stock: "20", limit: "10" } }

  const [showAddStaff, setShowAddStaff] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [reviewToDelete, setReviewToDelete] = useState(null);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffPin, setStaffPin] = useState("");
  const [staffFirstName, setStaffFirstName] = useState("");
  const [staffLastName, setStaffLastName] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffOutletId, setStaffOutletId] = useState("");
  const [staffRole, setStaffRole] = useState("staff");

  const loadData = async () => {
    setLoading(true); setError("");
    try {
      const [ordersData, outletsData, menuData, usersData] = await Promise.allSettled([
        api.adminGetOrders(), api.adminGetOutlets(), api.adminGetMenuItems(), api.adminGetUsers()
      ]);
      if (ordersData.status === "fulfilled") {
        setOrders(ordersData.value);
        const generatedCodes = {};
        ordersData.value.forEach(o => {
          if (o.status === "pending" || o.status === "processing") {
            generatedCodes[o.id] = `TRK-${o.id}-${Math.floor(1000 + Math.random() * 9000)}`;
          } else {
            generatedCodes[o.id] = o.tracking_code || "";
          }
        });
        setTrackingCodes(prev => ({ ...generatedCodes, ...prev }));
      }
      if (outletsData.status === "fulfilled") setOutlets(outletsData.value);
      if (menuData.status === "fulfilled") setMenu(menuData.value);
      if (usersData.status === "fulfilled") setUsers(usersData.value);
      try {
        const couponsData = await api.adminGetCoupons();
        setCoupons(couponsData);
      } catch (err) {}
      try { const a = await api.adminGetAnalytics(); setAnalytics(a); } catch (err) {}
      try { const l = await api.adminGetAuditLogs(1, 40); setAuditLogs(l.logs || []); } catch (err) {}
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
      } catch (err) {}
    } catch (err) { setError(err.message || "Failed to load admin data"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (outlets.length > 0 && !staffOutletId) setStaffOutletId(outlets[0].id.toString()); }, [outlets, staffOutletId]);

  // Load timesheets when active tab changes to timesheets
  const [timesheets, setTimesheets] = useState([]);
  useEffect(() => {
    if (activeTab === "timesheets") {
      api.adminGetShifts().then(setTimesheets).catch(() => {});
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

  const handleReplyReview = async (review) => {
    const reply = window.prompt("Enter admin reply:", review.admin_reply || "");
    if (reply !== null) {
      try {
        await api.adminUpdateReview(review.id, { admin_reply: reply });
        alert("Reply updated!");
        const data = await api.adminGetReviews();
        setReviews(data);
      } catch (err) { alert("Failed: " + err.message); }
    }
  };

  const handleToggleReviewVisibility = async (review) => {
    try {
      await api.adminUpdateReview(review.id, { is_hidden: !review.is_hidden });
      alert(`Review ${!review.is_hidden ? "hidden" : "made visible"}.`);
      const data = await api.adminGetReviews();
      setReviews(data);
    } catch (err) { alert("Failed: " + err.message); }
  };

  const _openAddMenuModal = () => { loadData(); setShowAddMenu(true); };
  const openAddOutletModal = () => { loadData(); setShowAddOutlet(true); };
  const _openAddStaffModal = () => { loadData(); setShowAddStaff(true); };

  const lookupCoordinates = async () => {
    if (!outletAddress.trim()) { alert("Please enter an address first"); return; }
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
    const code = trackingCodes[orderId];
    if (!code?.trim()) { alert("Enter a tracking code first"); return; }
    try {
      await api.adminShipOrder(orderId, code.trim(), trackingLabels[orderId] || null, trackingLinks[orderId] || null);
      alert("Marked as shipped!");
      loadData();
    } catch (err) { alert("Failed: " + err.message); }
  };

  const handleAddMenuItem = async (e) => {
    e.preventDefault();
    try {
      await api.adminAddMenuItem({ name: menuName, code: menuCode, price: parseFloat(menuPrice), original_price: menuOriginalPrice ? parseFloat(menuOriginalPrice) : null, category: menuCategory, business_type: menuType, description: menuDesc, image_url: menuImageUrl || null, global_stock: menuGlobalStock !== "" ? parseInt(menuGlobalStock) : null });
      alert("Menu item created!"); setShowAddMenu(false);
      setMenuName(""); setMenuCode(""); setMenuPrice(""); setMenuOriginalPrice(""); setMenuCategory("Pickles"); setMenuDesc(""); setMenuImageUrl(""); setMenuGlobalStock("");
      loadData();
    } catch (err) { alert("Failed: " + err.message); }
  };

  const openEditMenuItem = (item) => {
    setEditMenuId(item.id);
    setMenuName(item.name || "");
    setMenuCode(item.code || "");
    setMenuPrice(item.price || "");
    setMenuOriginalPrice(item.original_price || "");
    setMenuCategory(item.category || "Pickles");
    setMenuType(item.business_type || "home_foods");
    setMenuDesc(item.description || "");
    setMenuImageUrl(item.image_url || "");
    setMenuGlobalStock(item.global_stock || "");
    setShowEditMenu(true);
  };

  const handleUpdateMenuItem = async (e) => {
    e.preventDefault();
    try {
      await api.adminUpdateMenuItem(editMenuId, { name: menuName, code: menuCode, price: parseFloat(menuPrice), original_price: menuOriginalPrice ? parseFloat(menuOriginalPrice) : null, category: menuCategory, business_type: menuType, description: menuDesc, image_url: menuImageUrl || null, global_stock: menuGlobalStock !== "" ? parseInt(menuGlobalStock) : null });
      alert("Menu item updated!"); 
      setShowEditMenu(false);
      setMenuName(""); setMenuCode(""); setMenuPrice(""); setMenuOriginalPrice(""); setMenuCategory("Pickles"); setMenuDesc(""); setMenuImageUrl(""); setMenuGlobalStock("");
      loadData();
    } catch (err) { alert("Failed to update: " + err.message); }
  };

  const handleDeleteMenuItem = async (id) => {
    if (!confirm("Are you sure you want to delete this menu item?")) return;
    try {
      await api.adminDeleteMenuItem(id);
      alert("Menu item deleted!");
      loadData();
    } catch (err) { alert("Failed to delete: " + err.message); }
  };

  const handleAddOutlet = async (e) => {
    e.preventDefault();
    try {
      const latVal = outletLatitude ? parseFloat(outletLatitude) : null;
      const lonVal = outletLongitude ? parseFloat(outletLongitude) : null;
      const data = { name: outletName, address: outletAddress, latitude: latVal, longitude: lonVal };
      
      if (editingOutletId) {
        await api.adminUpdateOutlet(editingOutletId, data);
        alert("Outlet updated successfully!");
      } else {
        const live = (await api.getMode()) === "Live Backend";
        if (live) {
          const res = await fetch(`${API_BASE_URL}/admin/outlets`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` }, body: JSON.stringify(data) });
          const d = await res.json(); if (!res.ok) throw new Error(d.message || "Failed");
        } else {
          const list = JSON.parse(localStorage.getItem("mock_outlets") || "[]");
          list.push({ id: Date.now(), name: outletName, address: outletAddress, latitude: latVal, longitude: lonVal, items: [] });
          localStorage.setItem("mock_outlets", JSON.stringify(list));
        }
        alert("Outlet added!");
      }
      setShowAddOutlet(false); setEditingOutletId(null);
      setOutletName(""); setOutletAddress(""); setOutletLatitude(""); setOutletLongitude("");
      loadData();
    } catch (err) { alert("Failed: " + err.message); }
  };

  const openEditOutlet = (outlet) => {
    setEditingOutletId(outlet.id);
    setOutletName(outlet.name);
    setOutletAddress(outlet.address || "");
    setOutletLatitude(outlet.latitude || "");
    setOutletLongitude(outlet.longitude || "");
    setShowAddOutlet(true);
  };

  const handleDeleteOutlet = async (outletId) => {
    if (!confirm("Are you sure you want to delete this outlet?")) return;
    try {
      await api.adminDeleteOutlet(outletId);
      alert("Outlet deleted!");
      loadData();
    } catch (err) {
      alert("Failed to delete: " + err.message);
    }
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
    if (!form.menuItemId) { alert("Select a food item first"); return; }
    try { 
      await api.adminAssignItemToOutlet(outletId, form.menuItemId, form.stock || "20", form.limit || "10"); 
      alert("Item assigned!"); 
      loadData(); 
    }
    catch (err) { alert("Failed: " + err.message); }
  };

  const handleRemoveItemFromOutlet = async (outletId, menuItemId) => {
    if (!confirm("Remove this item from the outlet?")) return;
    try { await api.adminRemoveItemFromOutlet(outletId, menuItemId); loadData(); }
    catch (err) { alert("Failed: " + err.message); }
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
        role: staffRole
      };
      if (staffPassword) payload.password = staffPassword;
      if (staffPin) payload.pin = staffPin;

      if (editingUserId) {
        // Updating user
        await api.adminUpdateUser(editingUserId, payload);
        alert("Account updated successfully!");
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
        } else {
          const list = JSON.parse(localStorage.getItem("mock_users") || "[]");
          if (list.find(u => u.email === staffEmail)) throw new Error("Email already registered");
          if (staffRole === "admin" && list.filter(u => u.role === "admin").length >= 3) {
            throw new Error("Maximum of 3 admin accounts allowed.");
          }
          list.push({ ...payload, id: Date.now() });
          localStorage.setItem("mock_users", JSON.stringify(list));
        }
        alert(`${staffRole === "admin" ? "Admin" : "Staff"} account created!`);
      }
      setShowAddStaff(false); setEditingUserId(null);
      setStaffEmail(""); setStaffPassword(""); setStaffPin(""); setStaffFirstName(""); setStaffLastName(""); setStaffPhone(""); setStaffRole("staff");
      loadData();
    } catch (err) { alert("Failed: " + err.message); }
  };

  const openEditStaff = (user) => {
    setEditingUserId(user.id);
    setStaffEmail(user.email);
    setStaffRole(user.role || "staff");
    setStaffFirstName(user.first_name || "");
    setStaffLastName(user.last_name || "");
    setStaffPhone(user.phone || "");
    setStaffOutletId(user.outlet_id || "");
    setStaffPassword("");
    setStaffPin("");
    setShowAddStaff(true);
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await api.adminDeleteUser(userId);
      alert("User deleted!");
      loadData();
    } catch (err) { alert("Failed to delete user: " + err.message); }
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim() || !couponDiscount) return;
    try {
      await api.adminAddCoupon({
        code: couponCode.trim().toUpperCase(),
        discount_pct: parseInt(couponDiscount),
        is_active: couponIsActive
      });
      alert("Coupon created successfully!");
      setShowAddCoupon(false);
      setCouponCode("");
      setCouponDiscount("");
      setCouponIsActive(true);
      const c = await api.adminGetCoupons();
      setCoupons(c);
    } catch (err) {
      alert("Failed to create coupon: " + err.message);
    }
  };

  const handleToggleCoupon = async (coupon) => {
    try {
      await api.adminUpdateCoupon(coupon.id, { is_active: !coupon.is_active });
      alert(`Coupon "${coupon.code}" ${coupon.is_active ? "deactivated" : "activated"} successfully!`);
      const c = await api.adminGetCoupons();
      setCoupons(c);
    } catch (err) {
      alert("Failed to update coupon: " + err.message);
    }
  };

  const handleDeleteCoupon = async (couponId) => {
    if (!confirm("Are you sure you want to delete this coupon?")) return;
    try {
      await api.adminDeleteCoupon(couponId);
      alert("Coupon deleted successfully!");
      const c = await api.adminGetCoupons();
      setCoupons(c);
    } catch (err) {
      alert("Failed to delete coupon: " + err.message);
    }
  };

  const handleToggleUserActive = async (user) => {
    try {
      const nextActive = user.is_active === false;
      await api.adminUpdateUser(user.id, { is_active: nextActive });
      alert(`User account ${nextActive ? "activated" : "deactivated"} successfully!`);
      loadData();
    } catch (err) {
      alert("Failed to update user status: " + err.message);
    }
  };


  const handleDraftPO = (e) => {
    e.preventDefault();
    const sup = suppliers.find(s => s.id === parseInt(selectedSupplierId));
    if (!sup) return;
    setDraftPOs(prev => [{ id: Date.now(), supplier_name: sup.name, item: poItem, quantity: poQty, unit: poUnit, date: new Date().toLocaleDateString(), status: "draft" }, ...prev]);
    alert("Purchase Order drafted!");
  };

  const totalRevenue = analytics?.summary?.total_revenue || 0;
  const b2cRevenue = analytics?.summary?.b2c_revenue || 0;
  const posRevenue = analytics?.summary?.pos_revenue || 0;
  const pendingOrders = orders.filter(o => o.status === "pending" || o.status === "processing").length;
  const lowStockOutlets = outlets.filter(o => (o.items || []).some(i => i.needs_restock)).length;

  const TABS = [
    { id: "overview",   label: "Overview",        icon: BarChart3 },
    { id: "catalog",    label: "Master Catalog",  icon: ShoppingBag },
    { id: "foods",      label: "Outlet Stations", icon: Package },
    { id: "analytics",  label: "Sales Analytics", icon: TrendingUp },
    { id: "users",      label: "User Accounts",    icon: Users },
    { id: "timesheets", label: "Timesheets",       icon: Clock },
    { id: "batches",    label: "Expiry & Spoilage",icon: Calendar },
    { id: "suppliers",  label: "B2B Suppliers",   icon: Truck },
    { id: "reviews",    label: "Product Reviews", icon: MessageSquare },
    { id: "logs",       label: "Audit Logs",       icon: FileText },
    { id: "qr",         label: "QR Dispatch",      icon: QrCode },
    { id: "coupons",    label: "Discount Coupons", icon: Tag },
  ];

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


  return (
    <div className="animate-fade-in" style={{ padding: "2rem" }}>
      {/* ── Page Header ── */}
      <div className="page-header">
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
          <button className="btn btn-secondary" onClick={onLogout}>
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}><AlertTriangle size={15} /> {error}</div>}

      {/* ── Tab Bar ── */}
      <div className="tab-nav" style={{ marginBottom: "2rem" }}>
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn ${activeTab === t.id ? "active" : ""}`} onClick={() => setActiveTab(t.id)}>
            <t.icon size={14} /> {t.label}
            {t.id === "foods" && pendingOrders > 0 && <span className="nav-badge">{pendingOrders}</span>}
            {t.id === "foods" && lowStockOutlets > 0 && <span className="nav-badge" style={{ background: "var(--error)" }}>{lowStockOutlets}</span>}
          </button>
        ))}
      </div>

      {/* ══════════ OVERVIEW ══════════ */}
      {activeTab === "overview" && (
        <div className="animate-fade-in">
          {/* KPI cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
            <div className="stat-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="stat-card-label">Total Revenue</span>
                <div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", background: "rgba(249,115,22,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)" }}><TrendingUp size={18} /></div>
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
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1.5rem" }}>
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
                      <div key={o.id} style={{ padding: "0.875rem", background: "var(--bg-elevated)", borderRadius: "var(--r-md)", border: `1px solid ${isAlert ? "rgba(239,68,68,0.3)" : "var(--border-subtle)"}` }}>
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
      {activeTab === "foods" && (
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
                            <button onClick={() => handleRemoveItemFromOutlet(outlet.id, item.menu_item_id)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, fontSize: "1rem", lineHeight: 1, display: "flex" }}>
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
                  <div style={{ background: "rgba(249,115,22,0.05)", borderRadius: "var(--r-md)", padding: "0.75rem", border: "1px solid var(--border-brand)" }}>
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

          {/* Orders table */}
          <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>
            B2C Customer Shipments <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 400 }}>— pending dispatch</span>
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
                {orders.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>No orders yet.</td></tr>
                )}
                {orders.map(o => (
                  <tr key={o.id}>
                    <td><span style={{ fontWeight: 700, color: "var(--brand)" }}>#{o.id}</span></td>
                    <td style={{ color: "var(--text-secondary)" }}>{new Date(o.created_at).toLocaleDateString()}</td>
                    <td>{o.customer_email}</td>
                    <td><strong>₹{o.total_price.toFixed(0)}</strong></td>
                    <td><span className={`badge-status status-${o.status}`}>{o.status}</span></td>
                    <td>
                      {(o.status === "pending" || o.status === "processing") ? (
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
      {activeTab === "analytics" && (
        <div className="animate-fade-in">
          {!analytics ? (
            <div className="empty-state"><div className="empty-state-icon"><BarChart3 size={28} /></div><p>Loading analytics…</p></div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem", marginBottom: "2rem" }}>
                {[
                  { label: "Total Revenue", value: `₹${totalRevenue.toFixed(0)}`, color: "var(--brand)", icon: TrendingUp, bg: "rgba(249,115,22,0.12)" },
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>
                Staff Timesheets & Shifts
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: "0.2rem 0 0" }}>
                Monitor staff clock-in/out times, hours worked, and cash drawer discrepancies.
              </p>
            </div>
            <button className="btn btn-secondary" onClick={() => api.adminGetShifts().then(setTimesheets)}><RefreshCw size={14} /> Refresh</button>
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
                      <tr key={ts.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
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
                    );
                  })
                )}
              </tbody>
            </table>
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
                        <tr key={b.id} style={{ background: warning ? "rgba(239,68,68,0.04)" : "transparent" }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1.5rem" }}>
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
                <option value="kitchen">Kitchen</option>
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
                          <span style={{
                            textTransform: "uppercase", fontSize: "0.72rem", fontWeight: 800,
                            padding: "0.2rem 0.5rem", borderRadius: "4px",
                            background: user.role === "outlet_owner" ? "rgba(139,92,246,0.15)" : user.role === "staff" ? "rgba(249,115,22,0.15)" : user.role === "kitchen" ? "rgba(234,179,8,0.15)" : "rgba(59,130,246,0.15)",
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
                          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
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
                            <div style={{ marginTop: "0.5rem", padding: "0.4rem", background: "rgba(249,115,22,0.1)", borderLeft: "2px solid var(--brand)", fontSize: "0.75rem", color: "var(--text-primary)" }}>
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
                            style={{ padding: "0.3rem 0.5rem", fontSize: "0.75rem", background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", color: "#ef4444" }}
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
                    <th>Status</th>
                    <th>Created At</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)", fontSize: "0.82rem" }}>
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
                          {coupon.discount_pct}% Off
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
                              style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", color: "#ef4444" }}
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


      {/* ══════════ MODALS ══════════ */}

      {/* Add Product */}
      <Modal open={showAddMenu} onClose={() => setShowAddMenu(false)} title="Add Catalog Product">
        <form onSubmit={handleAddMenuItem} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Product Name</label>
              <input type="text" required className="form-input" placeholder="e.g. Kandi Podi 250g" value={menuName} onChange={e => setMenuName(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Product Code (Optional)</label>
              <input type="text" className="form-input" placeholder="e.g. som1" value={menuCode} onChange={e => setMenuCode(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Price (₹)</label>
              <input type="number" step="0.01" required className="form-input" placeholder="179.00" value={menuPrice} onChange={e => setMenuPrice(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Original Price (₹)</label>
              <input type="number" step="0.01" className="form-input" placeholder="220.00" value={menuOriginalPrice} onChange={e => setMenuOriginalPrice(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Category</label>
              <select className="form-select" value={menuCategory} onChange={e => setMenuCategory(e.target.value)}>
                {["Pickles", "Spice Powders", "Snacks & Savories", "Sweets & Treats", "Mixes & Instant", "Special Products", "Other"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
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
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Plus size={15} /> Create Product</button>
            <button type="button" onClick={() => setShowAddMenu(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </form>
      </Modal>

      <Modal open={showEditMenu} onClose={() => setShowEditMenu(false)} title="Edit Catalog Product">
        <form onSubmit={handleUpdateMenuItem} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Product Name</label>
              <input type="text" required className="form-input" placeholder="e.g. Kandi Podi 250g" value={menuName} onChange={e => setMenuName(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Product Code (Optional)</label>
              <input type="text" className="form-input" placeholder="e.g. som1" value={menuCode} onChange={e => setMenuCode(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Price (₹)</label>
              <input type="number" step="0.01" required className="form-input" placeholder="179.00" value={menuPrice} onChange={e => setMenuPrice(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Original Price (₹)</label>
              <input type="number" step="0.01" className="form-input" placeholder="220.00" value={menuOriginalPrice} onChange={e => setMenuOriginalPrice(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Category</label>
              <select className="form-select" value={menuCategory} onChange={e => setMenuCategory(e.target.value)}>
                {["Pickles", "Spice Powders", "Snacks & Savories", "Sweets & Treats", "Mixes & Instant", "Special Products", "Other"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
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
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Update Product</button>
            <button type="button" onClick={() => setShowEditMenu(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Add Outlet */}
      <Modal open={showAddOutlet} onClose={() => { setShowAddOutlet(false); setEditingOutletId(null); setOutletName(""); setOutletAddress(""); setOutletLatitude(""); setOutletLongitude(""); }} title={editingOutletId ? "Edit Outlet" : "Register Outlet"} width={520}>
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
            </div>
            {geocodingMsg && (
              <div style={{ marginTop: "0.3rem", fontSize: "0.75rem", color: geocodingMsg.includes("Failed") ? "var(--error)" : "var(--success)" }}>
                {geocodingMsg}
              </div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Latitude</label>
              <input type="number" step="any" className="form-input" placeholder="28.6315" value={outletLatitude} onChange={e => setOutletLatitude(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Longitude</label>
              <input type="number" step="any" className="form-input" placeholder="77.2167" value={outletLongitude} onChange={e => setOutletLongitude(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Store size={15} /> Register Outlet</button>
            <button type="button" onClick={() => setShowAddOutlet(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Add/Edit Staff */}
      <Modal open={showAddStaff} onClose={() => { setShowAddStaff(false); setEditingUserId(null); setStaffEmail(""); setStaffPassword(""); setStaffPin(""); setStaffFirstName(""); setStaffLastName(""); setStaffPhone(""); setStaffRole("staff"); }} title={editingUserId ? "Edit Team Account" : "Create Team Account"}>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Password {editingUserId && "(Leave blank to keep)"}</label>
              <input type="password" required={!editingUserId} className="form-input" placeholder="••••••••" value={staffPassword} onChange={e => setStaffPassword(e.target.value)} />
            </div>
            {staffRole === "staff" && (
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
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
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Users size={15} /> {editingUserId ? "Save Changes" : "Create Account"}</button>
            <button type="button" onClick={() => { setShowAddStaff(false); setEditingUserId(null); setStaffEmail(""); setStaffPassword(""); setStaffPin(""); setStaffFirstName(""); setStaffLastName(""); setStaffPhone(""); setStaffRole("staff"); }} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
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
              required
              className="form-input"
              placeholder="e.g. 20"
              value={couponDiscount}
              onChange={e => setCouponDiscount(e.target.value)}
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
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Tag size={15} /> Create Coupon</button>
            <button type="button" onClick={() => setShowAddCoupon(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </form>
      </Modal>
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
  );
}
