import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { api } from "../utils/api";
import {
  Package, AlertTriangle, Plus, Store, MapPin, 
  Globe, 
  RefreshCw, 
  Edit3, X, LogOut
} from "lucide-react";

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

export default function OutletOwnerView({ onLogout, dbMode }) {
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

  // const [activeTab, setActiveTab] = useState("outlets");
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Create Outlet form state
  const [showAddOutlet, setShowAddOutlet] = useState(false);
  const [outletName, setOutletName] = useState("");
  const [outletAddress, setOutletAddress] = useState("");
  const [outletLatitude, setOutletLatitude] = useState("");
  const [outletLongitude, setOutletLongitude] = useState("");
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [geocodingMsg, setGeocodingMsg] = useState("");

  // Edit Outlet form state
  const [showEditOutlet, setShowEditOutlet] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editLatitude, setEditLatitude] = useState("");
  const [editLongitude, setEditLongitude] = useState("");
  const [editGeocodingLoading, setEditGeocodingLoading] = useState(false);
  const [editGeocodingMsg, setEditGeocodingMsg] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.ownerGetDashboard();
      setOutlets(data);
      if (selectedOutlet) {
        const updated = data.find(o => o.id === selectedOutlet.id);
        if (updated) setSelectedOutlet(updated);
      }
    } catch (err) {
      setError(err.message || "Failed to load owner dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lookupCoordinates = async (address, type) => {
    if (!address.trim()) {
      alert("Please enter an address first");
      return;
    }
    if (type === "add") {
      setGeocodingLoading(true);
      setGeocodingMsg("Looking up address…");
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`);
        const data = await res.json();
        if (data?.length > 0) {
          setOutletLatitude(parseFloat(data[0].lat).toFixed(6));
          setOutletLongitude(parseFloat(data[0].lon).toFixed(6));
          setGeocodingMsg("✓ Coordinates fetched!");
        } else {
          setGeocodingMsg("Address not found.");
        }
      } catch (err) {
        setGeocodingMsg("Lookup failed.");
      } finally {
        setGeocodingLoading(false);
      }
    } else {
      setEditGeocodingLoading(true);
      setEditGeocodingMsg("Looking up address…");
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`);
        const data = await res.json();
        if (data?.length > 0) {
          setEditLatitude(parseFloat(data[0].lat).toFixed(6));
          setEditLongitude(parseFloat(data[0].lon).toFixed(6));
          setEditGeocodingMsg("✓ Coordinates fetched!");
        } else {
          setEditGeocodingMsg("Address not found.");
        }
      } catch (err) {
        setEditGeocodingMsg("Lookup failed.");
      } finally {
        setEditGeocodingLoading(false);
      }
    }
  };

  const handleAddOutlet = async (e) => {
    e.preventDefault();
    try {
      const latVal = outletLatitude ? parseFloat(outletLatitude) : null;
      const lonVal = outletLongitude ? parseFloat(outletLongitude) : null;
      await api.ownerCreateOutlet({
        name: outletName,
        address: outletAddress,
        latitude: latVal,
        longitude: lonVal
      });
      alert("Outlet registered successfully!");
      setShowAddOutlet(false);
      setOutletName("");
      setOutletAddress("");
      setOutletLatitude("");
      setOutletLongitude("");
      setGeocodingMsg("");
      loadData();
    } catch (err) {
      alert("Failed: " + err.message);
    }
  };

  const handleStartEdit = (outlet) => {
    setEditId(outlet.id);
    setEditName(outlet.name);
    setEditAddress(outlet.address);
    setEditLatitude(outlet.latitude || "");
    setEditLongitude(outlet.longitude || "");
    setEditGeocodingMsg("");
    setShowEditOutlet(true);
  };

  const handleEditOutlet = async (e) => {
    e.preventDefault();
    try {
      const latVal = editLatitude ? parseFloat(editLatitude) : null;
      const lonVal = editLongitude ? parseFloat(editLongitude) : null;
      await api.ownerEditOutlet(editId, {
        name: editName,
        address: editAddress,
        latitude: latVal,
        longitude: lonVal
      });
      alert("Outlet updated successfully!");
      setShowEditOutlet(false);
      loadData();
    } catch (err) {
      alert("Failed: " + err.message);
    }
  };

  const lowStockCount = outlets.filter(o => o.needs_restock).length;
  const totalStock = outlets.reduce((sum, o) => sum + o.current_stock, 0);

  return (
    <div className="animate-fade-in" style={{ padding: "2rem" }}>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Outlet Owner Portal</h1>
          <p>Monitor stock, manage your assigned retail outlets, and edit parameters</p>
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
          <button className="btn btn-primary" onClick={() => setShowAddOutlet(true)}>
            <Plus size={15} /> Register Outlet
          </button>
          <button className="btn btn-secondary" onClick={onLogout}>
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {/* ── KPI Widgets ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
        <div className="stat-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="stat-card-label">Managed Outlets</span>
            <div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", background: "rgba(249,115,22,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)" }}><Store size={18} /></div>
          </div>
          <div className="stat-card-value">{outlets.length}</div>
          <div className="stat-card-sub">Assigned under ownership</div>
        </div>
        <div className="stat-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="stat-card-label">Restock Alerts</span>
            <div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--error)" }}><AlertTriangle size={18} /></div>
          </div>
          <div className="stat-card-value" style={{ color: lowStockCount > 0 ? "var(--error)" : "var(--success)" }}>{lowStockCount}</div>
          <div className="stat-card-sub">{lowStockCount > 0 ? "Requires attention" : "All stock levels OK"}</div>
        </div>
        <div className="stat-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="stat-card-label">Total Unit Stock</span>
            <div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--success)" }}><Package size={18} /></div>
          </div>
          <div className="stat-card-value">{totalStock}</div>
          <div className="stat-card-sub">Across all managed locations</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.5fr", gap: "1.5rem", alignItems: "start" }}>
        
        {/* ── Left Side: Outlets List ── */}
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>My Outlets</h2>
          {outlets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Store size={22} /></div>
              <p>No outlets registered yet. Click 'Register Outlet' to add one.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {outlets.map(o => {
                const isSelected = selectedOutlet?.id === o.id;
                return (
                  <div
                    key={o.id}
                    onClick={() => setSelectedOutlet(o)}
                    className="glass-card"
                    style={{
                      cursor: "pointer",
                      padding: "1rem",
                      border: isSelected ? "1px solid var(--brand)" : "1px solid var(--border-subtle)",
                      boxShadow: isSelected ? "0 0 0 1px var(--brand-dim), var(--shadow-glow)" : undefined,
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{o.name}</span>
                      <button
                        className="btn-icon"
                        style={{ padding: "0.25rem" }}
                        onClick={(e) => { e.stopPropagation(); handleStartEdit(o); }}
                        title="Edit parameters"
                      >
                        <Edit3 size={12} />
                      </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
                      <MapPin size={11} /> {o.address}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Stock: <strong>{o.current_stock}</strong> units</span>
                      {o.needs_restock ? (
                        <span className="badge-status status-cancelled" style={{ fontSize: "0.62rem" }}>Restock</span>
                      ) : (
                        <span className="badge-status status-delivered" style={{ fontSize: "0.62rem" }}>Healthy</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right Side: Outlet Details & Stock levels ── */}
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          {selectedOutlet ? (
            <div>
              <div style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "1rem", marginBottom: "1.25rem" }}>
                <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.2rem", fontWeight: 800, color: "var(--brand)" }}>{selectedOutlet.name}</h2>
                <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <MapPin size={13} /> {selectedOutlet.address}
                </p>
                {selectedOutlet.latitude && (
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                    Coordinates: {selectedOutlet.latitude}, {selectedOutlet.longitude}
                  </p>
                )}
              </div>

              <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "0.75rem" }}>Station Stock & Safety Limits</h3>
              <div className="table-container">
                <table className="custom-table" style={{ fontSize: "0.8rem" }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Price</th>
                      <th>Safety Limit</th>
                      <th>Current Stock</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedOutlet.items || []).map(item => (
                      <tr key={item.menu_item_id}>
                        <td><strong>{item.menu_item_name}</strong></td>
                        <td>₹{item.menu_item_price}</td>
                        <td>{item.restock_limit} units</td>
                        <td><strong>{item.current_stock}</strong></td>
                        <td>
                          {item.current_stock <= item.restock_limit ? (
                            <span className="badge-status status-cancelled" style={{ fontSize: "0.6" }}>Low</span>
                          ) : (
                            <span className="badge-status status-delivered" style={{ fontSize: "0.6" }}>Good</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!selectedOutlet.items || selectedOutlet.items.length === 0) && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", fontStyle: "italic", padding: "1.5rem" }}>
                          No products assigned to this outlet by System Admin yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: "4rem 2rem" }}>
              <div className="empty-state-icon"><Package size={24} /></div>
              <h3>No Outlet Selected</h3>
              <p>Select an outlet from the left sidebar to view its live stock, parameters, and safety limit reports.</p>
            </div>
          )}
        </div>

      </div>

      {/* ── MODALS ── */}

      {/* Register Outlet */}
      <Modal open={showAddOutlet} onClose={() => setShowAddOutlet(false)} title="Register New Outlet">
        <form onSubmit={handleAddOutlet} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Outlet Name</label>
            <input type="text" required className="form-input" placeholder="e.g. Hyderabad Hitech City Stall" value={outletName} onChange={e => setOutletName(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Address</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input type="text" required className="form-input" placeholder="e.g. Hitech City, Hyderabad, TS" value={outletAddress} onChange={e => setOutletAddress(e.target.value)} />
              <button type="button" onClick={() => lookupCoordinates(outletAddress, "add")} disabled={geocodingLoading} className="btn btn-secondary" style={{ padding: "0 0.875rem", flexShrink: 0 }} title="Auto-fetch coordinates">
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
              <input type="number" step="any" className="form-input" placeholder="17.4483" value={outletLatitude} onChange={e => setOutletLatitude(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Longitude</label>
              <input type="number" step="any" className="form-input" placeholder="78.3741" value={outletLongitude} onChange={e => setOutletLongitude(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Store size={15} /> Register Outlet</button>
            <button type="button" onClick={() => setShowAddOutlet(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Edit Outlet */}
      <Modal open={showEditOutlet} onClose={() => setShowEditOutlet(false)} title="Edit Outlet Parameters">
        <form onSubmit={handleEditOutlet} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Outlet Name</label>
            <input type="text" required className="form-input" value={editName} onChange={e => setEditName(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Address</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input type="text" required className="form-input" value={editAddress} onChange={e => setEditAddress(e.target.value)} />
              <button type="button" onClick={() => lookupCoordinates(editAddress, "edit")} disabled={editGeocodingLoading} className="btn btn-secondary" style={{ padding: "0 0.875rem", flexShrink: 0 }} title="Auto-fetch coordinates">
                {editGeocodingLoading ? <div style={{ width: 14, height: 14, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> : <Globe size={15} />}
              </button>
            </div>
            {editGeocodingMsg && (
              <div style={{ fontSize: "0.75rem", marginTop: "0.35rem", color: editGeocodingMsg.includes("✓") ? "var(--success)" : "var(--error)" }}>
                {editGeocodingMsg}
              </div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Latitude</label>
              <input type="number" step="any" className="form-input" value={editLatitude} onChange={e => setEditLatitude(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Longitude</label>
              <input type="number" step="any" className="form-input" value={editLongitude} onChange={e => setEditLongitude(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Changes</button>
            <button type="button" onClick={() => setShowEditOutlet(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
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
