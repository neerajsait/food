import React, { useState, useEffect, useMemo } from "react";
import { api, API_BASE_URL } from "../utils/api";
import {
  Plus, Minus, IndianRupee, QrCode, ShoppingCart, RefreshCw,
  AlertCircle, CheckCircle, Store, Trash2, Calendar, FileText,
  Volume2, VolumeX, HelpCircle, X, LogOut
} from "lucide-react";
import QRScanner from "./QRScanner";

export default function StaffPOS({ onLogout, dbMode }) {
  const [outlet, setOutlet] = useState(null);
  const [menu, setMenu] = useState([]);
  const [activeSale, setActiveSale] = useState({}); // { itemId: quantity }
  const [paymentMethod, setPaymentMethod] = useState("cash"); // "cash" or "scanner"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [alertMsg, setAlertMsg] = useState("");

  // Shift & POS history states
  const [salesHistory, setSalesHistory] = useState([]);
  const [showShiftReport, setShowShiftReport] = useState(false);
  const [lastCompletedSale, setLastCompletedSale] = useState(null);

  // Disposal states
  const [showDisposalForm, setShowDisposalForm] = useState(false);
  const [dispItemId, setDispItemId] = useState("");
  const [dispQty, setDispQty] = useState("1");
  const [dispReason, setDispReason] = useState("damaged");

  // UPI payment state
  const [showUPIScanModal, setShowUPIScanModal] = useState(false);

  // Audio configuration
  const [soundEnabled, setSoundEnabled] = useState(true);

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

  // Audio generator function using browser's AudioContext
  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // high pitch warning beep
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15); // short beep
    } catch (e) {
      console.log("AudioContext blocked or unavailable:", e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError("");
    setSuccessMsg("");
    setAlertMsg("");
    try {
      const staffOutlet = await api.posGetMyOutlet();
      setOutlet(staffOutlet);

      const menuData = await api.getPOSMenu();
      setMenu(menuData);

      // Check if any items are critical and trigger sound
      const lowItems = menuData.filter(item => item.current_stock <= item.restock_limit);
      if (lowItems.length > 0) {
        setAlertMsg(`Restock warning: ${lowItems.length} products below safety limits!`);
        playAlertSound();
      }

      // Load sales history
      const live = (await api.getMode()) === "Live Backend";
      if (live) {
        const res = await fetch(`${API_BASE_URL}/pos/sales/history`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        if (res.ok) {
          const history = await res.json();
          setSalesHistory(history);
        }
      } else {
        // Fallback demo sales history
        setSalesHistory([
          { id: 1, created_at: new Date().toISOString(), total_amount: 140.00, payment_method: "cash", items: [{ menu_item_name: "Challa Chakralu 250g", quantity: 1, price: 120 }, { menu_item_name: "Snack Supply Samosa 250g", quantity: 1, price: 20 }] }
        ]);
      }

    } catch (err) {
      setError(err.message || "Failed to load POS database");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectItem = (itemId) => {
    const item = menu.find(m => m.id === itemId);
    if (!item) return;
    const currentSelected = activeSale[itemId] || 0;
    if (item.current_stock <= currentSelected) {
      alert(`Cannot add more. Station only has ${item.current_stock} of ${item.name} in stock.`);
      return;
    }
    setActiveSale(prev => ({
      ...prev,
      [itemId]: currentSelected + 1
    }));
  };

  const handleIncrement = (itemId) => {
    const item = menu.find(m => m.id === itemId);
    if (!item) return;
    if (item.current_stock <= (activeSale[itemId] || 0)) {
      alert(`Only ${item.current_stock} available in stock.`);
      return;
    }
    setActiveSale(prev => ({
      ...prev,
      [itemId]: prev[itemId] + 1
    }));
  };

  const handleDecrement = (itemId) => {
    setActiveSale(prev => {
      const next = { ...prev };
      if (next[itemId] <= 1) {
        delete next[itemId];
      } else {
        next[itemId] -= 1;
      }
      return next;
    });
  };

  const getSaleTotalQty = () => Object.values(activeSale).reduce((sum, qty) => sum + qty, 0);

  const getSaleTotalAmount = () => {
    return Object.entries(activeSale).reduce((sum, [id, qty]) => {
      const item = menu.find(m => m.id === parseInt(id));
      return sum + (item ? item.price * qty : 0);
    }, 0);
  };

  const handleCompleteSale = async (forceComplete = false) => {
    const totalQty = getSaleTotalQty();
    if (totalQty === 0) return;

    for (const [itemId, qty] of Object.entries(activeSale)) {
      const item = menu.find(m => m.id === parseInt(itemId));
      if (item && item.current_stock < qty) {
        setError(`Insufficient stock for ${item.name}. Available: ${item.current_stock}`);
        return;
      }
    }

    if (paymentMethod === "scanner" && !forceComplete) {
      setShowUPIScanModal(true);
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    const items = Object.entries(activeSale).map(([id, qty]) => ({
      menu_item_id: parseInt(id),
      quantity: qty
    }));

    try {
      const res = await api.posSell(items, paymentMethod);
      alert(`POS Transaction successful! Total: ₹${getSaleTotalAmount().toFixed(2)}`);
      setActiveSale({});
      setShowUPIScanModal(false);
      
      // Update shift sales locally for instant update
      const newSaleEntry = {
        id: Date.now(),
        created_at: new Date().toISOString(),
        total_amount: getSaleTotalAmount(),
        payment_method: paymentMethod,
        items: items.map(it => {
          const mItem = menu.find(m => m.id === it.menu_item_id);
          return {
            menu_item_name: mItem ? mItem.name : "Item",
            quantity: it.quantity,
            price: mItem ? mItem.price : 0
          };
        })
      };
      setSalesHistory(prev => [newSaleEntry, ...prev]);

      setOutlet(prev => ({
        ...prev,
        current_stock: res.remaining_stock,
        needs_restock: res.restock_alert
      }));

      // Store the last completed sale details
      setLastCompletedSale({
        id: Date.now(),
        created_at: new Date().toISOString(),
        total_amount: getSaleTotalAmount(),
        payment_method: paymentMethod,
        items: items.map(it => {
          const mItem = menu.find(m => m.id === it.menu_item_id);
          return {
            menu_item_name: mItem ? mItem.name : "Item",
            quantity: it.quantity,
            price: mItem ? mItem.price : 0
          };
        })
      });

      if (res.restock_alert) {
        setAlertMsg(`Stock alert: Station requires replenishment!`);
        playAlertSound();
      }

      setTimeout(loadData, 2000);

    } catch (err) {
      setError(err.message || "Failed to submit transaction");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPOSReceipt = (sale) => {
    try {
      const lineSeparator = "========================================\n";
      let text = "";
      text += "             FLAVORFLOW ERP             \n";
      text += `          Outlet: ${outlet ? outlet.name : "Retail Station"}         \n`;
      text += `          Address: ${outlet ? outlet.address : "Location"}        \n`;
      text += lineSeparator;
      text += "             POS SALES RECEIPT          \n";
      text += lineSeparator;
      text += `Receipt ID: #POS-${sale.id}\n`;
      text += `Date: ${new Date(sale.created_at).toLocaleString()}\n`;
      text += `Cashier: Alex (Staff)\n`;
      text += `Payment: ${sale.payment_method.toUpperCase()}\n`;
      text += lineSeparator;
      text += "Items Sold:\n";
      sale.items.forEach(it => {
        const itemTotal = (it.price * it.quantity).toFixed(2);
        text += `- ${it.menu_item_name}\n  Qty: ${it.quantity} @ ₹${parseFloat(it.price).toFixed(2)} = ₹${itemTotal}\n`;
      });
      text += lineSeparator;
      text += `Grand Total: ₹${parseFloat(sale.total_amount).toFixed(2)}\n`;
      text += lineSeparator;
      text += "      Thank you for shopping!           \n";

      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `POS_Receipt_${sale.id}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download POS receipt: " + err.message);
    }
  };


  const handleLogDisposal = async (e) => {
    e.preventDefault();
    if (!dispItemId) {
      alert("Please select a food item to dispose of");
      return;
    }
    setLoading(true);
    try {
      await api.posLogDisposal(dispItemId, parseInt(dispQty), dispReason);
      alert("Inventory disposal logged successfully!");
      setShowDisposalForm(false);
      setDispQty("1");
      loadData();
    } catch (err) {
      alert("Disposal failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStockColor = () => {
    if (!outlet) return "var(--text-muted)";
    if (outlet.needs_restock) return "var(--alert-color)";
    return "var(--success-color)";
  };

  // Compute stats for EOD Report
  const shiftTotals = useMemo(() => {
    const cash = salesHistory.reduce((sum, s) => sum + (s.payment_method === "cash" ? s.total_amount : 0), 0);
    const upi = salesHistory.reduce((sum, s) => sum + (s.payment_method !== "cash" ? s.total_amount : 0), 0);
    const count = salesHistory.length;
    return { cash, upi, total: cash + upi, count };
  }, [salesHistory]);

  const isUnassigned = useMemo(() => {
    return error && (error.toLowerCase().includes("assigned outlet") || error.includes("403"));
  }, [error]);

  return (
    <div className="animate-fade-in" style={{ width: "100%" }}>
      
      {/* Top Controls Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", background: "var(--bg-card)", padding: "0.875rem 1.25rem", borderRadius: "var(--r-lg)", border: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: 36, height: 36, background: "var(--brand-dim)", borderRadius: "var(--r-md)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)" }}>
            <Store size={18} />
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 700 }}>Cashier Terminal</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{outlet ? outlet.name : "Loading…"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="btn btn-secondary"
            style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem" }}
            title={soundEnabled ? "Mute alert sounds" : "Enable alert sounds"}
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span>{soundEnabled ? "Sound On" : "Muted"}</span>
          </button>
          <button
            onClick={() => { if (menu.length > 0 && !dispItemId) setDispItemId(menu[0].id.toString()); setShowDisposalForm(true); }}
            className="btn btn-secondary"
            style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem", color: "var(--error)" }}
          >
            <Trash2 size={14} /> Log Damage
          </button>
          <button
            onClick={() => setShowShiftReport(true)}
            className="btn btn-secondary"
            style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem" }}
          >
            <FileText size={14} /> Shift Report
          </button>
          <button
            onClick={onLogout}
            className="btn btn-secondary"
            style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem" }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      {error && !isUnassigned && (
        <div className="alert alert-error" style={{ marginBottom: "1.25rem" }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {isUnassigned ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", maxWidth: "500px", margin: "3rem auto" }} className="glass-panel animate-fade-in">
          <div style={{ width: 64, height: 64, background: "rgba(239, 68, 68, 0.1)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--error)", margin: "0 auto 1.5rem" }}>
            <AlertCircle size={32} />
          </div>
          <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
            Unassigned Outlet
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", lineHeight: 1.5, marginBottom: "1.5rem" }}>
            Your staff account is currently not assigned to any supply outlet. An administrator must assign your account to an active outlet in the Admin View before you can launch the cashier terminal.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button onClick={loadData} className="btn btn-primary" style={{ padding: "0.6rem 1.25rem" }}>
              <RefreshCw size={14} /> Retry Sync
            </button>
            <button onClick={onLogout} className="btn btn-secondary" style={{ padding: "0.6rem 1.25rem" }}>
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
      ) : loading && !outlet ? (
        <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--text-muted)" }}>
          <RefreshCw size={26} className="animate-spin" style={{ marginBottom: "0.5rem" }} />
          <div style={{ fontSize: "0.85rem" }}>Syncing with outlet database...</div>
        </div>
      ) : outlet ? (
        <>
          <div className="pos-grid">
            
            {/* ── REGISTER CATALOG ITEMS ── */}
            <div className="glass-panel" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                <div>
                  <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>{outlet.name}</h2>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{outlet.address}</span>
                </div>
                <button onClick={loadData} className="btn-icon" title="Refresh"><RefreshCw size={14} /></button>
              </div>

              {/* Grid of items */}
              <div className="pos-items-grid">
                {menu.map(item => {
                  const isLow = item.current_stock <= item.restock_limit;
                  const inSale = activeSale[item.id] || 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectItem(item.id)}
                      className={`pos-item-card ${inSale > 0 ? "selected" : ""} ${isLow ? "low-stock" : ""}`}
                      style={{ cursor: "pointer", fontFamily: "var(--font-body)" }}
                    >
                      {isLow && (
                        <div style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: "50%", background: "var(--error)" }} />
                      )}
                      {inSale > 0 && (
                        <div style={{ position: "absolute", top: 6, left: 6, width: 20, height: 20, borderRadius: "50%", background: "var(--brand)", color: "#fff", fontSize: "0.68rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{inSale}</div>
                      )}
                      <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>🍱</div>
                      <h4 style={{ fontSize: "0.8rem", fontWeight: 700, margin: "0 0 0.4rem", color: "var(--text-primary)", lineHeight: 1.3 }}>{item.name}</h4>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 800, color: "var(--brand)" }}>₹{item.price.toFixed(0)}</span>
                        <span style={{ fontSize: "0.68rem", fontWeight: 800, color: isLow ? "var(--error)" : "var(--success)", background: isLow ? "var(--error-bg)" : "var(--success-bg)", padding: "2px 6px", borderRadius: "var(--r-full)" }}>
                          {item.current_stock}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── POS TICKET ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

              {/* Outlet Status */}
              <div className="glass-panel" style={{ padding: "1.1rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", textAlign: "center" }}>
                <div style={{ borderRight: "1px solid var(--border-subtle)", paddingRight: "0.75rem" }}>
                  <span style={{ fontSize: "0.62rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em", display: "block", marginBottom: "0.25rem" }}>Total Inventory</span>
                  <div style={{ fontFamily: "var(--font-heading)", fontSize: "2rem", fontWeight: 900, color: outlet.needs_restock ? "var(--error)" : "var(--success)", lineHeight: 1 }}>{outlet.current_stock}</div>
                </div>
                <div>
                  <span style={{ fontSize: "0.62rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em", display: "block", marginBottom: "0.25rem" }}>Low Stock Items</span>
                  <div style={{ fontFamily: "var(--font-heading)", fontSize: "2rem", fontWeight: 900, color: alertMsg ? "var(--error)" : "var(--success)", lineHeight: 1 }}>
                    {menu.filter(i => i.current_stock <= i.restock_limit).length}
                  </div>
                </div>
              </div>

              {/* Ticket */}
              <div className="pos-ticket">
                <div className="pos-ticket-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <ShoppingCart size={16} style={{ color: "var(--brand)" }} />
                    <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>Current Ticket</h3>
                  </div>
                  {Object.keys(activeSale).length > 0 && (
                    <button className="btn-icon" onClick={() => setActiveSale({})} title="Clear ticket">
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="pos-ticket-items">
                  {successMsg && (
                    <div className="alert alert-success animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-start", width: "100%" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <CheckCircle size={14} /> <span>{successMsg}</span>
                      </div>
                      {lastCompletedSale && (
                        <button
                          onClick={() => handleDownloadPOSReceipt(lastCompletedSale)}
                          className="btn"
                          style={{
                            padding: "0.3rem 0.6rem", fontSize: "0.72rem",
                            background: "#fff", color: "var(--success)",
                            border: "1px solid var(--success)", borderRadius: "var(--r-sm)",
                            cursor: "pointer", fontWeight: 700, alignSelf: "flex-end",
                            display: "flex", alignItems: "center", gap: "0.25rem"
                          }}
                        >
                          <FileText size={12} /> Download Receipt
                        </button>
                      )}
                    </div>
                  )}
                  {alertMsg && (
                    <div className="alert alert-warning animate-fade-in">{alertMsg}</div>
                  )}

                  {Object.keys(activeSale).length === 0 ? (
                    <div className="empty-state" style={{ padding: "2rem" }}>
                      <div className="empty-state-icon"><ShoppingCart size={22} /></div>
                      <p style={{ fontSize: "0.8rem" }}>Tap items on the left to add them here</p>
                    </div>
                  ) : (
                    Object.entries(activeSale).map(([id, qty]) => {
                      const item = menu.find(m => m.id === parseInt(id));
                      if (!item) return null;
                      return (
                        <div key={id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.65rem 0.75rem", background: "var(--bg-elevated)", borderRadius: "var(--r-md)", border: "1px solid var(--border-subtle)" }}>
                          <span style={{ fontSize: "0.82rem", fontWeight: 700, flex: 1, marginRight: "0.5rem" }}>{item.name}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div className="qty-stepper">
                              <button onClick={() => handleDecrement(item.id)}><Minus size={11} /></button>
                              <span>{qty}</span>
                              <button onClick={() => handleIncrement(item.id)}><Plus size={11} /></button>
                            </div>
                            <span style={{ fontFamily: "var(--font-heading)", fontSize: "0.88rem", fontWeight: 800, color: "var(--brand)", width: 44, textAlign: "right" }}>₹{(item.price * qty).toFixed(0)}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="pos-ticket-footer">
                  {/* Payment Method */}
                  <div style={{ marginBottom: "1rem" }}>
                    <span className="form-label" style={{ marginBottom: "0.35rem", display: "block" }}>Payment Method</span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                      <button type="button" onClick={() => setPaymentMethod("cash")} className={`btn ${paymentMethod === "cash" ? "btn-primary" : "btn-secondary"}`} style={{ padding: "0.5rem", fontSize: "0.82rem" }}>
                        <IndianRupee size={13} /> Cash
                      </button>
                      <button type="button" onClick={() => setPaymentMethod("scanner")} className={`btn ${paymentMethod === "scanner" ? "btn-primary" : "btn-secondary"}`} style={{ padding: "0.5rem", fontSize: "0.82rem" }}>
                        <QrCode size={13} /> UPI
                      </button>
                    </div>
                  </div>

                  {/* Totals */}
                  <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.875rem", marginBottom: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      <span>Items</span><span>{getSaleTotalQty()} units</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-heading)", fontSize: "1.3rem", fontWeight: 800 }}>
                      <span>Total</span>
                      <span style={{ color: "var(--brand)" }}>₹{getSaleTotalAmount().toFixed(0)}</span>
                    </div>
                  </div>

                  <button onClick={handleCompleteSale} disabled={getSaleTotalQty() === 0 || loading} className="btn btn-primary" style={{ width: "100%", padding: "0.875rem", fontSize: "0.95rem" }}>
                    {loading ? "Processing…" : "Complete Sale"}
                  </button>
                </div>
              </div>

            </div>{/* end right panel */}

          </div>{/* end pos-grid */}

          {/* QR Scanner (full width below) */}
          <div style={{ marginTop: "1.5rem" }}>
            <QRScanner onStockUpdated={loadData} />
          </div>
        </>
      ) : (
        !loading && (
          <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
            <AlertCircle size={32} style={{ color: "var(--alert-color)", marginBottom: "1rem" }} />
            <h4>Terminal Offline</h4>
          </div>
        )
      )}

      {/* SHIFT REPORT MODAL */}
      {showShiftReport && (
        <div className="modal-overlay" onClick={() => setShowShiftReport(false)}>
          <div className="modal-box" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Store size={18} style={{ color: "var(--brand)" }} /> End of Shift
              </h2>
              <button className="modal-close" onClick={() => setShowShiftReport(false)}><X size={16} /></button>
            </div>
            <div style={{ textAlign: "center", marginBottom: "1.25rem", color: "var(--text-secondary)", fontSize: "0.8rem" }}>Outlet: <strong style={{ color: "var(--text-primary)" }}>{outlet?.name}</strong></div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginBottom: "1.5rem" }}>
              {[
                { label: "Total Ticket Sales", value: `${shiftTotals.count} receipts` },
                { label: "Cash Receipts", value: `₹${shiftTotals.cash.toFixed(0)}` },
                { label: "UPI/Scanner", value: `₹${shiftTotals.upi.toFixed(0)}` },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", padding: "0.6rem 0.875rem", background: "var(--bg-elevated)", borderRadius: "var(--r-md)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{r.label}</span>
                  <strong>{r.value}</strong>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.1rem", fontWeight: 800, padding: "0.75rem 0.875rem", background: "var(--brand-dim)", borderRadius: "var(--r-md)", border: "1px solid var(--border-brand)" }}>
                <span style={{ color: "var(--brand)" }}>Total Drawer</span>
                <span style={{ color: "var(--brand)" }}>₹{shiftTotals.total.toFixed(0)}</span>
              </div>
            </div>
            <button onClick={() => { setShowShiftReport(false); alert("Shift summary printed!"); }} className="btn btn-primary" style={{ width: "100%", padding: "0.875rem" }}>
              Print Summary
            </button>
          </div>
        </div>
      )}

      {/* DISPOSAL MODAL */}
      {showDisposalForm && (
        <div className="modal-overlay" onClick={() => setShowDisposalForm(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--error)" }}>
                <Trash2 size={18} /> Log Spoilage
              </h2>
              <button className="modal-close" onClick={() => setShowDisposalForm(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleLogDisposal} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Damaged Item</label>
                <select className="form-select" value={dispItemId} onChange={e => setDispItemId(e.target.value)} required>
                  {menu.map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {i.current_stock})</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Write-off Quantity</label>
                <input type="number" className="form-input" value={dispQty} onChange={e => setDispQty(e.target.value)} min="1" required />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Reason</label>
                <select className="form-select" value={dispReason} onChange={e => setDispReason(e.target.value)}>
                  <option value="damaged">Damaged in Transit / Storage</option>
                  <option value="expired">Approaching Shelf Expiry</option>
                  <option value="spoiled">Spillage / Bag Leakage</option>
                  <option value="returned">Customer Return/Refund</option>
                </select>
              </div>
              <button type="submit" disabled={loading} className="btn btn-danger" style={{ width: "100%", padding: "0.875rem" }}>
                <Trash2 size={15} /> Confirm Disposal
              </button>
            </form>
          </div>
        </div>
      )}

      {showUPIScanModal && (
        <div className="modal-overlay" style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(13, 17, 23, 0.95)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000, backdropFilter: "blur(12px)"
        }}>
          <div className="modal-content animate-fade-in" style={{
            background: "rgba(18, 22, 28, 0.95)", border: "1px solid rgba(249, 115, 22, 0.2)",
            boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)", borderRadius: "var(--r-lg)",
            padding: "2rem", width: "100%", maxWidth: "420px", textAlign: "center"
          }}>
            <h3 style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)", fontSize: "1.25rem", marginBottom: "0.5rem", fontWeight: 700, display: "flex", gap: "0.5rem", alignItems: "center", justifyContent: "center" }}>
              <QrCode size={20} style={{ color: "var(--brand)" }} /> Scan to Pay
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginBottom: "1.25rem", lineHeight: 1.4 }}>
              Ask the customer to scan the QR code using any UPI application (GPay, PhonePe, Paytm, BHIM) to pay the bill.
            </p>

            <div style={{
              background: "#fff", padding: "1rem", borderRadius: "12px",
              display: "inline-block", marginBottom: "1.25rem", boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
            }}>
              <img
                src={`https://chart.googleapis.com/chart?cht=qr&chs=220x220&chl=${encodeURIComponent(
                  `upi://pay?pa=flavorflow@icici&pn=FlavorFlow%20ERP&am=${getSaleTotalAmount().toFixed(2)}&cu=INR`
                )}`}
                alt="UPI QR Code"
                style={{ display: "block", width: "220px", height: "220px" }}
              />
            </div>

            <div style={{
              fontSize: "1.4rem", fontWeight: 800, color: "var(--brand)",
              marginBottom: "1.5rem", fontFamily: "var(--font-heading)"
            }}>
              ₹{getSaleTotalAmount().toFixed(2)}
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setShowUPIScanModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1, padding: "0.75rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCompleteSale(true)}
                className="btn btn-primary"
                style={{ flex: 1, padding: "0.75rem" }}
                disabled={loading}
              >
                {loading ? "Completing..." : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
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
  );
}
