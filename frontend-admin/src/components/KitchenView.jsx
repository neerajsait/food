import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import {
  ChefHat, Package, Clock, CheckCircle, Flame, ArrowRight,
  LogOut, RefreshCw, AlertTriangle, Plus, Grid, QrCode
} from "lucide-react";

const premiumStyles = `
  .kv-wrapper {
    display: flex;
    min-height: 100vh;
    background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);
    font-family: 'Inter', system-ui, sans-serif;
    color: #1e293b;
    animation: fadeIn 0.5s ease-out;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  
  .kv-sidebar {
    width: 280px;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(16px);
    border-right: 1px solid rgba(255, 255, 255, 0.4);
    display: flex;
    flex-direction: column;
    padding: 2rem 1.5rem;
    box-shadow: 4px 0 24px rgba(0,0,0,0.02);
  }
  
  .kv-brand {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 3rem;
  }
  
  .kv-brand-icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: 0 8px 16px rgba(234, 88, 12, 0.2);
  }
  
  .kv-nav-btn {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
    padding: 1rem 1.25rem;
    border-radius: 12px;
    border: none;
    background: transparent;
    color: #64748b;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    margin-bottom: 0.5rem;
  }
  
  .kv-nav-btn:hover {
    background: rgba(255, 255, 255, 0.9);
    color: #0f172a;
    transform: translateX(4px);
  }
  
  .kv-nav-btn.active {
    background: #ffffff;
    color: #ea580c;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  }
  
  .kv-main {
    flex: 1;
    padding: 2rem 3rem;
    overflow-y: auto;
  }
  
  .kv-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2.5rem;
  }
  
  .kv-title {
    font-size: 2rem;
    font-weight: 800;
    background: linear-gradient(to right, #0f172a, #334155);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin: 0;
  }
  
  .kv-btn {
    padding: 0.75rem 1.5rem;
    border-radius: 10px;
    border: none;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .kv-btn-primary {
    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(234, 88, 12, 0.2);
  }
  
  .kv-btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(234, 88, 12, 0.3);
  }
  
  .kv-btn-success {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2);
  }
  
  .kv-btn-success:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(34, 197, 94, 0.3);
  }

  .kv-btn-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #475569;
    transition: all 0.2s;
  }

  .kv-btn-icon:hover {
    background: #f8fafc;
    color: #0f172a;
    transform: translateY(-2px);
  }
  
  .kv-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 1.5rem;
  }
  
  .kv-card {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(12px);
    border-radius: 16px;
    padding: 1.5rem;
    border: 1px solid rgba(255, 255, 255, 0.5);
    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.05);
    transition: all 0.3s ease;
    animation: slideUp 0.4s ease-out forwards;
  }
  
  .kv-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1);
  }
  
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .kv-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  
  .kv-badge-pending { background: #fee2e2; color: #ef4444; }
  .kv-badge-processing { background: #fef3c7; color: #d97706; }
  
  .kv-items-list {
    background: #f8fafc;
    border-radius: 12px;
    padding: 1rem;
    margin: 1.5rem 0;
  }
  
  .kv-item-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px dashed #cbd5e1;
  }
  .kv-item-row:last-child { border-bottom: none; }
  
  .kv-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease-out;
  }
  
  .kv-modal {
    background: white;
    border-radius: 24px;
    padding: 2.5rem;
    width: 100%;
    max-width: 480px;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
    animation: slideUp 0.3s ease-out;
  }

  .kv-input {
    width: 100%;
    padding: 0.875rem 1rem;
    border-radius: 10px;
    border: 1px solid #cbd5e1;
    background: #f8fafc;
    font-size: 1rem;
    transition: all 0.2s;
    outline: none;
  }
  .kv-input:focus {
    border-color: #ea580c;
    box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.1);
    background: white;
  }
  
  .kv-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }
  .kv-table th {
    text-align: left;
    padding: 1rem;
    color: #64748b;
    font-weight: 600;
    border-bottom: 2px solid #e2e8f0;
  }
  .kv-table td {
    padding: 1rem;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: middle;
  }
  .kv-table tr:hover td {
    background: rgba(255, 255, 255, 0.5);
  }

  .spin-anim {
    animation: spin 1s linear infinite;
  }
  @keyframes spin { 100% { transform: rotate(360deg); } }
`;

export default function KitchenView({ onLogout, dbMode }) {
  const [activeTab, setActiveTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [restockReqs, setRestockReqs] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const [showProduceModal, setShowProduceModal] = useState(false);
  const [batchForm, setBatchForm] = useState({ menu_item_id: "", quantity: 1, expiry_date: "" });
  const [producedQR, setProducedQR] = useState(null);
  const [viewOrderQR, setViewOrderQR] = useState(null);

  const alertMsg = (msg) => {
    setToast({ message: msg, type: msg.toLowerCase().includes("failed") ? "error" : "success" });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "orders") {
        const o = await api.getKitchenOrders();
        setOrders(o);
      } else {
        const r = await api.getRestockRequests();
        setRestockReqs(r);
        const m = await api.getMenu();
        setMenuItems(m);
      }
    } catch (err) {
      alertMsg(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000); // 15s refresh for responsiveness
    return () => clearInterval(interval);
  }, [activeTab]);

  const updateOrderStatus = async (id, status) => {
    try {
      await api.updateKitchenOrderStatus(id, status);
      alertMsg(`Order marked as ${status}`);
      loadData();
    } catch (err) {
      alertMsg(err.message || "Failed to update status");
    }
  };

  const handleProduceBatch = async (e) => {
    e.preventDefault();
    try {
      const res = await api.produceBatch(batchForm.menu_item_id, batchForm.quantity, batchForm.expiry_date);
      setProducedQR(res.batch);
      alertMsg("Batch Produced!");
      loadData();
    } catch (err) {
      alertMsg(err.message || "Failed to produce batch");
    }
  };

  return (
    <>
      <style>{premiumStyles}</style>
      <div className="kv-wrapper">
        <aside className="kv-sidebar">
          <div className="kv-brand">
            <div className="kv-brand-icon"><ChefHat size={28} /></div>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#0f172a" }}>Kitchen Hub</h2>
              <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0, fontWeight: 600 }}>{dbMode.toUpperCase()} MODE</p>
            </div>
          </div>
          
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "1rem" }}>
              Operations
            </p>
            <button className={`kv-nav-btn ${activeTab === "orders" ? "active" : ""}`} onClick={() => setActiveTab("orders")}>
              <Flame size={20} /> Live Orders
            </button>
            <button className={`kv-nav-btn ${activeTab === "restock" ? "active" : ""}`} onClick={() => setActiveTab("restock")}>
              <Package size={20} /> Restock & Produce
            </button>
          </div>
          
          <button className="kv-nav-btn" onClick={onLogout} style={{ color: "#ef4444" }}>
            <LogOut size={20} /> Sign Out
          </button>
        </aside>

        <main className="kv-main">
          <header className="kv-header">
            <h1 className="kv-title">
              {activeTab === "orders" ? "Live Customer Orders" : "Restock Requests & Production"}
            </h1>
            <div style={{ display: "flex", gap: "1rem" }}>
              <button className="kv-btn-icon" onClick={loadData} disabled={loading} title="Refresh">
                <RefreshCw size={20} className={loading ? "spin-anim" : ""} />
              </button>
              {activeTab === "restock" && (
                <button className="kv-btn kv-btn-primary" onClick={() => {
                  setShowProduceModal(true);
                  setProducedQR(null);
                }}>
                  <Plus size={18} /> Produce Batch
                </button>
              )}
            </div>
          </header>

          {activeTab === "orders" && (
            <div className="kv-grid">
              {orders.length === 0 && !loading && (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "4rem 2rem", background: "rgba(255,255,255,0.5)", borderRadius: "20px" }}>
                  <CheckCircle size={64} color="#22c55e" style={{ marginBottom: "1rem" }} />
                  <h3 style={{ fontSize: "1.5rem", color: "#0f172a", marginBottom: "0.5rem" }}>Kitchen is Clear!</h3>
                  <p style={{ color: "#64748b" }}>There are no pending orders right now. Good job team.</p>
                </div>
              )}
              {orders.map(o => (
                <div key={o.id} className="kv-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a" }}>#{o.id}</span>
                    <span className={`kv-badge ${o.status === 'processing' ? 'kv-badge-processing' : 'kv-badge-pending'}`}>
                      {o.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#64748b", fontSize: "0.85rem", fontWeight: 600 }}>
                    <Clock size={14} /> {new Date(o.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                  
                  <div className="kv-items-list">
                    {o.items.map((i, idx) => (
                      <div key={idx} className="kv-item-row">
                        <span style={{ fontWeight: 600, color: "#334155" }}>{i.menu_item_name}</span>
                        <span style={{ fontWeight: 800, color: "#ea580c" }}>x{i.quantity}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    {o.status === "pending" && (
                      <button className="kv-btn kv-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => updateOrderStatus(o.id, "processing")}>
                        <Flame size={18} /> Start Cooking
                      </button>
                    )}
                    {o.status === "processing" && (
                      <button className="kv-btn kv-btn-success" style={{ width: "100%", justifyContent: "center" }} onClick={() => updateOrderStatus(o.id, "ready")}>
                        <CheckCircle size={18} /> Mark Ready
                      </button>
                    )}
                    {o.qr_code_base64 && (
                      <button className="kv-btn" style={{ width: "auto", justifyContent: "center", background: "#f8fafc", color: "#334155", border: "1px solid #cbd5e1" }} onClick={() => setViewOrderQR(o)}>
                        <QrCode size={18} /> QR
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "restock" && (
            <div className="kv-card" style={{ width: "100%", animation: "fadeIn 0.5s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <div style={{ background: "#fef3c7", padding: "0.5rem", borderRadius: "10px" }}>
                  <AlertTriangle size={24} color="#d97706" />
                </div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#0f172a" }}>Critical Restock Alerts</h3>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="kv-table">
                  <thead>
                    <tr>
                      <th>Location</th>
                      <th>Menu Item</th>
                      <th>Current Stock</th>
                      <th>Restock Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {restockReqs.length === 0 ? (
                      <tr><td colSpan="4" style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>Inventory levels are healthy across all outlets.</td></tr>
                    ) : (
                      restockReqs.map(r => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600, color: "#475569" }}>{r.outlet_name || `Outlet #${r.outlet_id}`}</td>
                          <td style={{ fontWeight: 700, color: "#0f172a" }}>{r.menu_item_name}</td>
                          <td>
                            <span style={{ background: "#fee2e2", color: "#b91c1c", padding: "0.25rem 0.75rem", borderRadius: "8px", fontWeight: 700 }}>
                              {r.current_stock}
                            </span>
                          </td>
                          <td style={{ color: "#64748b", fontWeight: 600 }}>{r.restock_limit}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        {showProduceModal && (
          <div className="kv-modal-overlay" onClick={() => setShowProduceModal(false)}>
            <div className="kv-modal" onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
                <h2 style={{ margin: 0, fontSize: "1.5rem", color: "#0f172a", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <Package size={24} color="#ea580c" />
                  {producedQR ? "Batch Generated" : "Produce Batch"}
                </h2>
                <button className="kv-btn-icon" onClick={() => setShowProduceModal(false)} style={{ width: "36px", height: "36px" }}>
                  <LogOut size={16} />
                </button>
              </div>
              
              {!producedQR ? (
                <form onSubmit={handleProduceBatch} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#475569", marginBottom: "0.5rem" }}>Menu Item</label>
                    <select className="kv-input" required value={batchForm.menu_item_id} onChange={e => setBatchForm({...batchForm, menu_item_id: e.target.value})}>
                      <option value="">Select an item...</option>
                      {menuItems.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#475569", marginBottom: "0.5rem" }}>Quantity</label>
                      <input type="number" className="kv-input" required min="1" value={batchForm.quantity} onChange={e => setBatchForm({...batchForm, quantity: e.target.value})} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#475569", marginBottom: "0.5rem" }}>Expiry Date</label>
                      <input type="date" className="kv-input" required value={batchForm.expiry_date} onChange={e => setBatchForm({...batchForm, expiry_date: e.target.value})} />
                    </div>
                  </div>
                  <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
                    <button type="button" className="kv-btn" style={{ flex: 1, background: "#f1f5f9", color: "#475569" }} onClick={() => setShowProduceModal(false)}>Cancel</button>
                    <button type="submit" className="kv-btn kv-btn-primary" style={{ flex: 2, justifyContent: "center" }} disabled={loading}>
                      Generate QR <ArrowRight size={18} />
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <div style={{ background: "#f8fafc", padding: "1.5rem", borderRadius: "20px", display: "inline-block", marginBottom: "1.5rem", border: "2px dashed #cbd5e1" }}>
                    <img src={producedQR.qr_code_base64} alt="Batch QR Code" style={{ width: "200px", height: "200px" }} />
                  </div>
                  <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#ea580c", marginBottom: "0.5rem" }}>{producedQR.batch_number}</h3>
                  <div style={{ display: "inline-block", background: "#f1f5f9", padding: "1rem 2rem", borderRadius: "12px", marginBottom: "2rem" }}>
                    <p style={{ margin: 0, fontWeight: 700, color: "#334155", fontSize: "1.1rem" }}>{producedQR.quantity_produced}x {producedQR.menu_item_name}</p>
                    <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.9rem", fontWeight: 600 }}>Expires: {producedQR.expiry_date}</p>
                  </div>
                  <button className="kv-btn kv-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setShowProduceModal(false)}>
                    Close & Continue
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {viewOrderQR && (
          <div className="kv-modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div className="kv-card" style={{ width: "90%", maxWidth: "400px", position: "relative", padding: "2.5rem", animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}>
              <div style={{ textAlign: "center" }}>
                <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.5rem" }}>Order #{viewOrderQR.id}</h3>
                <p style={{ margin: "0 0 1.5rem", color: "#64748b", fontWeight: 600 }}>Scan QR to track or fulfill</p>
                <div style={{ background: "#f8fafc", padding: "1.5rem", borderRadius: "20px", display: "inline-block", marginBottom: "1.5rem", border: "2px dashed #cbd5e1" }}>
                  <img src={viewOrderQR.qr_code_base64} alt="Order QR Code" style={{ width: "200px", height: "200px" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <button type="button" className="kv-btn" style={{ background: "#e2e8f0", color: "#475569" }} onClick={() => setViewOrderQR(null)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div style={{
            position: "fixed", bottom: "2rem", right: "2rem",
            background: toast.type === "error" ? "#ef4444" : "#10b981",
            color: "white", padding: "1rem 2rem", borderRadius: "12px",
            fontWeight: 600, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)",
            animation: "slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            zIndex: 9999
          }}>
            {toast.message}
          </div>
        )}
      </div>
    </>
  );
}
