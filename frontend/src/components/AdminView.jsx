import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { api, API_BASE_URL } from "../utils/api";
import {
  Package, AlertTriangle, Plus, Store, Users, MapPin, Activity,
  Globe, QrCode, TrendingUp, ShieldAlert, Award, FileText, ShoppingBag,
  Truck, ArrowRight, Clock, Trash2, Calendar, RefreshCw, BarChart3,
  ChevronRight, Zap, X, LogOut
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
  const [suppliers, setSuppliers] = useState(INITIAL_SUPPLIERS);

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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [trackingCodes, setTrackingCodes] = useState({});

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [menuName, setMenuName] = useState("");
  const [menuPrice, setMenuPrice] = useState("");
  const [menuOriginalPrice, setMenuOriginalPrice] = useState("");
  const [menuCategory, setMenuCategory] = useState("Spice Powders");
  const [menuType, setMenuType] = useState("home_foods");
  const [menuDesc, setMenuDesc] = useState("");
  const [menuImageUrl, setMenuImageUrl] = useState("");

  const [showAddOutlet, setShowAddOutlet] = useState(false);
  const [outletName, setOutletName] = useState("");
  const [outletAddress, setOutletAddress] = useState("");
  const [outletLatitude, setOutletLatitude] = useState("");
  const [outletLongitude, setOutletLongitude] = useState("");
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [geocodingMsg, setGeocodingMsg] = useState("");

  const [selectedMenuItemId, setSelectedMenuItemId] = useState("");
  const [assignStock, setAssignStock] = useState("20");
  const [assignLimit, setAssignLimit] = useState("10");

  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffFirstName, setStaffFirstName] = useState("");
  const [staffLastName, setStaffLastName] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffOutletId, setStaffOutletId] = useState("");

  const loadData = async () => {
    setLoading(true); setError("");
    try {
      const [ordersData, outletsData, menuData, usersData] = await Promise.allSettled([
        api.adminGetOrders(), api.adminGetOutlets(), api.adminGetMenuItems(), api.adminGetUsers()
      ]);
      if (ordersData.status === "fulfilled") setOrders(ordersData.value);
      if (outletsData.status === "fulfilled") setOutlets(outletsData.value);
      if (menuData.status === "fulfilled") setMenu(menuData.value);
      if (usersData.status === "fulfilled") setUsers(usersData.value);
      try { const a = await api.adminGetAnalytics(); setAnalytics(a); } catch {}
      try { const l = await api.adminGetAuditLogs(1, 40); setAuditLogs(l.logs || []); } catch {}
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
      } catch {}
    } catch (err) { setError(err.message || "Failed to load admin data"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (outlets.length > 0 && !staffOutletId) setStaffOutletId(outlets[0].id.toString()); }, [outlets]);

  const openAddMenuModal = () => { loadData(); setShowAddMenu(true); };
  const openAddOutletModal = () => { loadData(); setShowAddOutlet(true); };
  const openAddStaffModal = () => { loadData(); setShowAddStaff(true); };

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
    } catch { setGeocodingMsg("Lookup failed."); }
    finally { setGeocodingLoading(false); }
  };

  const handleShipOrder = async (orderId) => {
    const code = trackingCodes[orderId];
    if (!code?.trim()) { alert("Enter a tracking code first"); return; }
    try { await api.adminShipOrder(orderId, code.trim()); alert("Marked as shipped!"); loadData(); }
    catch (err) { alert("Failed: " + err.message); }
  };

  const handleAddMenuItem = async (e) => {
    e.preventDefault();
    try {
      await api.adminAddMenuItem({ name: menuName, price: parseFloat(menuPrice), original_price: menuOriginalPrice ? parseFloat(menuOriginalPrice) : null, category: menuCategory, business_type: menuType, description: menuDesc, image_url: menuImageUrl || null });
      alert("Menu item created!"); setShowAddMenu(false);
      setMenuName(""); setMenuPrice(""); setMenuOriginalPrice(""); setMenuCategory("Spice Powders"); setMenuDesc(""); setMenuImageUrl("");
      loadData();
    } catch (err) { alert("Failed: " + err.message); }
  };

  const handleAddOutlet = async (e) => {
    e.preventDefault();
    try {
      const latVal = outletLatitude ? parseFloat(outletLatitude) : null;
      const lonVal = outletLongitude ? parseFloat(outletLongitude) : null;
      const live = (await api.getMode()) === "Live Backend";
      if (live) {
        const res = await fetch(`${API_BASE_URL}/admin/outlets`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` }, body: JSON.stringify({ name: outletName, address: outletAddress, latitude: latVal, longitude: lonVal }) });
        const d = await res.json(); if (!res.ok) throw new Error(d.message || "Failed");
      } else {
        const list = JSON.parse(localStorage.getItem("mock_outlets") || "[]");
        list.push({ id: Date.now(), name: outletName, address: outletAddress, latitude: latVal, longitude: lonVal, items: [] });
        localStorage.setItem("mock_outlets", JSON.stringify(list));
      }
      alert("Outlet created!"); setShowAddOutlet(false);
      setOutletName(""); setOutletAddress(""); setOutletLatitude(""); setOutletLongitude(""); setGeocodingMsg("");
      loadData();
    } catch (err) { alert("Failed: " + err.message); }
  };

  const handleAssignItemToOutlet = async (outletId) => {
    if (!selectedMenuItemId) { alert("Select a food item first"); return; }
    try { await api.adminAssignItemToOutlet(outletId, selectedMenuItemId, assignStock, assignLimit); alert("Item assigned!"); loadData(); }
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
      if (live) {
        const res = await fetch(`${API_BASE_URL}/admin/staff`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` }, body: JSON.stringify({ email: staffEmail, password: staffPassword, first_name: staffFirstName, last_name: staffLastName, phone: staffPhone, outlet_id: staffOutletId ? parseInt(staffOutletId) : null }) });
        const d = await res.json(); if (!res.ok) throw new Error(d.message || "Failed");
      } else {
        const list = JSON.parse(localStorage.getItem("mock_users") || "[]");
        if (list.find(u => u.email === staffEmail)) throw new Error("Email already registered");
        list.push({ id: Date.now(), email: staffEmail, role: "staff", first_name: staffFirstName, last_name: staffLastName, phone: staffPhone, outlet_id: staffOutletId ? parseInt(staffOutletId) : null });
        localStorage.setItem("mock_users", JSON.stringify(list));
      }
      alert("Staff account created!"); setShowAddStaff(false);
      setStaffEmail(""); setStaffPassword(""); setStaffFirstName(""); setStaffLastName(""); setStaffPhone("");
      loadData();
    } catch (err) { alert("Failed: " + err.message); }
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
    { id: "foods",      label: "Catalog & Outlets",icon: Package },
    { id: "analytics",  label: "Sales Analytics", icon: TrendingUp },
    { id: "users",      label: "User Accounts",    icon: Users },
    { id: "batches",    label: "Expiry & Spoilage",icon: Calendar },
    { id: "suppliers",  label: "B2B Suppliers",   icon: Truck },
    { id: "logs",       label: "Audit Logs",       icon: FileText },
    { id: "qr",         label: "QR Dispatch",      icon: QrCode },
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

      {/* ══════════ CATALOG & OUTLETS ══════════ */}
      {activeTab === "foods" && (
        <div className="animate-fade-in">
          {/* Action Row */}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.75rem", flexWrap: "wrap" }}>
            <button onClick={openAddMenuModal} className="btn btn-primary"><Plus size={15} /> Add Product</button>
            <button onClick={openAddOutletModal} className="btn btn-secondary"><Store size={15} /> Register Outlet</button>
            <button onClick={openAddStaffModal} className="btn btn-secondary"><Users size={15} /> Add Staff</button>
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
                      <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>{outlet.name}</h3>
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
                      <select className="form-select" style={{ padding: "0.35rem 0.5rem", fontSize: "0.75rem" }} onChange={e => setSelectedMenuItemId(e.target.value)} value={selectedMenuItemId}>
                        <option value="">-- Select --</option>
                        {menu.filter(i => i.business_type === "snack_supply" || i.business_type === "both").map(i => (
                          <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                      </select>
                      <input type="number" placeholder="Qty" className="form-input" style={{ padding: "0.35rem 0.5rem", fontSize: "0.75rem" }} value={assignStock} onChange={e => setAssignStock(e.target.value)} />
                      <input type="number" placeholder="Limit" className="form-input" style={{ padding: "0.35rem 0.5rem", fontSize: "0.75rem" }} value={assignLimit} onChange={e => setAssignLimit(e.target.value)} />
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
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <input type="text" placeholder="Tracking code" className="form-input" style={{ padding: "0.4rem 0.6rem", fontSize: "0.8rem", width: 130, height: "auto" }} value={trackingCodes[o.id] || ""} onChange={e => setTrackingCodes({ ...trackingCodes, [o.id]: e.target.value })} />
                          <button onClick={() => handleShipOrder(o.id)} className="btn btn-success" style={{ padding: "0.4rem 0.75rem", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                            <Truck size={13} /> Ship
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                          {o.tracking_code ? `Code: ${o.tracking_code}` : "Done"}
                        </span>
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
                            background: user.role === "outlet_owner" ? "rgba(139,92,246,0.15)" : user.role === "staff" ? "rgba(249,115,22,0.15)" : "rgba(59,130,246,0.15)",
                            color: user.role === "outlet_owner" ? "var(--brand)" : user.role === "staff" ? "var(--brand)" : "var(--info)"
                          }}>
                            {user.role?.replace("_", " ")}
                          </span>
                        </td>
                        <td>
                          {user.role === "staff" ? (
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
                          <button
                            onClick={() => handleToggleUserActive(user)}
                            className={`btn ${user.is_active !== false ? "btn-secondary" : "btn-primary"}`}
                            style={{ padding: "0.3rem 0.75rem", fontSize: "0.78rem" }}
                          >
                            {user.is_active !== false ? "Deactivate" : "Activate"}
                          </button>
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


      {/* ══════════ MODALS ══════════ */}

      {/* Add Product */}
      <Modal open={showAddMenu} onClose={() => setShowAddMenu(false)} title="Add Catalog Product">
        <form onSubmit={handleAddMenuItem} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Product Name</label>
            <input type="text" required className="form-input" placeholder="e.g. Kandi Podi 250g" value={menuName} onChange={e => setMenuName(e.target.value)} />
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
                {["Spice Powders", "Pickles", "Snacks & Savories", "Sweets & Treats", "Mixes & Instant", "Special Products", "Other"].map(c => <option key={c} value={c}>{c}</option>)}
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

      {/* Add Outlet */}
      <Modal open={showAddOutlet} onClose={() => setShowAddOutlet(false)} title="Register Outlet" width={520}>
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
              <div style={{ fontSize: "0.75rem", marginTop: "0.35rem", color: geocodingMsg.includes("✓") ? "var(--success)" : "var(--error)" }}>
                {geocodingMsg}
              </div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
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

      {/* Add Staff */}
      <Modal open={showAddStaff} onClose={() => setShowAddStaff(false)} title="Create Staff Account">
        <form onSubmit={handleAddStaff} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Email</label>
            <input type="email" required className="form-input" placeholder="staff@brand.com" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Password</label>
            <input type="password" required className="form-input" placeholder="••••••••" value={staffPassword} onChange={e => setStaffPassword(e.target.value)} />
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
            <input type="text" className="form-input" placeholder="98480xxxxx" value={staffPhone} onChange={e => setStaffPhone(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Assign to Outlet</label>
            <select className="form-select" value={staffOutletId} onChange={e => setStaffOutletId(e.target.value)}>
              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Users size={15} /> Create Account</button>
            <button type="button" onClick={() => setShowAddStaff(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
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
