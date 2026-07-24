import React, { useState, useEffect, useMemo } from "react";
import { api, API_BASE_URL } from "../utils/api";
import {
  Plus, Minus, IndianRupee, QrCode, ShoppingCart, RefreshCw,
  AlertCircle, CheckCircle, Store, Trash2, FileText,
  Volume2, VolumeX, X, LogOut, User, Clock, ShieldAlert,
  KeyRound, Gift, Search
} from "lucide-react";
import QRScanner from "./QRScanner";

export default function StaffPOS({ onLogout, _dbMode }) {
  const [outlet, setOutlet] = useState(null);
  const [menu, setMenu] = useState([]);
  const [activeSale, setActiveSale] = useState({}); // { itemId: quantity }
  const [paymentMethod, setPaymentMethod] = useState("cash"); // "cash" or "scanner"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [alertMsg, setAlertMsg] = useState("");

  // Coupon states
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");

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

  // ---- NEW: Shift Management ----
  const [activeShift, setActiveShift] = useState(null);
  const [shiftChecked, setShiftChecked] = useState(false); // has the shift check completed?
  const [clockInEmail, setClockInEmail] = useState("");
  const [clockInPin, setClockInPin] = useState("");
  const [clockInLoading, setClockInLoading] = useState(false);
  const [clockInError, setClockInError] = useState("");

  // ---- NEW: Clock-Out ----
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [actualCashInput, setActualCashInput] = useState("");
  const [clockOutLoading, setClockOutLoading] = useState(false);
  const [clockOutResult, setClockOutResult] = useState(null);

  // ---- NEW: CRM / Loyalty ----
  const [crmEmail, setCrmEmail] = useState("");
  const [crmResult, setCrmResult] = useState(null); // { customer, top_items }
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmError, setCrmError] = useState("");
  const [redeemPoints, setRedeemPoints] = useState(false); // toggle

  // ---- NEW: Product Code Scanning ----
  const [productCodeInput, setProductCodeInput] = useState("");
  const [scanError, setScanError] = useState("");
  const [isScanning, setIsScanning] = useState(false);

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

  // ---- Check active shift on mount ----
  useEffect(() => {
    api.posGetActiveShift().then(res => {
      setActiveShift(res.shift || null);
    }).catch(() => {
      setActiveShift(null);
    }).finally(() => {
      setShiftChecked(true);
    });
    // Pre-fill the email from logged-in user
    const user = api.getCurrentUser();
    if (user && user.email) setClockInEmail(user.email);
  }, []);

  // ---- Clock-In Handler ----
  const handleClockIn = async (e) => {
    e.preventDefault();
    setClockInError("");
    if (!clockInEmail.trim()) { setClockInError("Email is required"); return; }
    if (!/^\d{4}$/.test(clockInPin)) { setClockInError("PIN must be exactly 4 digits"); return; }
    setClockInLoading(true);
    try {
      const res = await api.posClockIn(clockInEmail.trim().toLowerCase(), clockInPin);
      setActiveShift(res.shift);
      setClockInPin("");
      alert("Shift started! You are now clocked in.");
    } catch (err) {
      setClockInError(err.message || "Clock-in failed");
    } finally {
      setClockInLoading(false);
    }
  };

  // ---- Clock-Out Handler ----
  const handleClockOut = async (e) => {
    e.preventDefault();
    const cashVal = parseFloat(actualCashInput);
    if (isNaN(cashVal) || cashVal < 0) {
      alert("Please enter a valid non-negative cash amount");
      return;
    }
    setClockOutLoading(true);
    try {
      const res = await api.posClockOut(cashVal);
      setClockOutResult(res.shift);
      setActiveShift(null);
      setActualCashInput("");
    } catch (err) {
      alert("Clock-out failed: " + err.message);
    } finally {
      setClockOutLoading(false);
    }
  };

  // ---- CRM Customer Lookup ----
  const handleCrmLookup = async (e) => {
    e.preventDefault();
    if (!crmEmail.trim()) return;
    setCrmError("");
    setCrmResult(null);
    setCrmLoading(true);
    try {
      const res = await api.posLookupCustomer(crmEmail.trim().toLowerCase());
      setCrmResult(res);
      setRedeemPoints(false);
    } catch (err) {
      setCrmError(err.message || "Customer not found");
    } finally {
      setCrmLoading(false);
    }
  };

  const clearCrm = () => {
    setCrmEmail("");
    setCrmResult(null);
    setCrmError("");
    setRedeemPoints(false);
  };

  // ---- Product Code Entry Handler ----
  const handleProductCodeEntry = async (e) => {
    e.preventDefault();
    if (!productCodeInput.trim()) return;
    setScanError("");
    try {
      const product = await api.getFoodByCode(productCodeInput.trim().toLowerCase());
      // Check if product is in this outlet's menu
      const itemInMenu = menu.find(m => m.id === product.id);
      if (!itemInMenu) {
        throw new Error("Item not available in this outlet");
      }
      handleSelectItem(itemInMenu.id);
      setProductCodeInput("");
    } catch (err) {
      setScanError(err.message || "Product code not found");
    }
  };


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
    } catch (err) {
      console.log("AudioContext blocked or unavailable:", err);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const discountAmount = appliedCoupon ? (getSaleTotalAmount() * appliedCoupon.discount_pct / 100) : 0;
  const finalTotalAmount = getSaleTotalAmount() - discountAmount;

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

    // Determine loyalty redemption
    const pointsToRedeem = (redeemPoints && crmResult?.customer?.loyalty_points > 0)
      ? Math.min(crmResult.customer.loyalty_points, Math.floor(finalTotalAmount))
      : 0;

    try {
      const res = await api.posSellWithCRM(
        items,
        paymentMethod,
        appliedCoupon ? appliedCoupon.code : null,
        crmResult?.customer?.email || null,
        pointsToRedeem
      );
      alert(`POS Transaction successful! Total: ₹${finalTotalAmount.toFixed(2)}${
        res.loyalty_points_earned > 0 ? ` | +${res.loyalty_points_earned} loyalty pts` : ""
      }`);
      setActiveSale({});
      setShowUPIScanModal(false);

      // Update CRM balance after sale
      if (crmResult && res.customer_loyalty_balance !== undefined) {
        setCrmResult(prev => ({
          ...prev,
          customer: { ...prev.customer, loyalty_points: res.customer_loyalty_balance }
        }));
      }
      setRedeemPoints(false);
      
      // Update shift sales locally for instant update
      const newSaleEntry = {
        id: Date.now(),
        created_at: new Date().toISOString(),
        total_amount: finalTotalAmount,
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
      setAppliedCoupon(null);
      setCouponCodeInput("");

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
      const doc = new jsPDF({
        unit: "mm",
        format: [80, 200]
      });

      let yPos = 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("FLAVORFLOW ERP", 40, yPos, { align: "center" });
      
      yPos += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Outlet: ${outlet ? outlet.name : "Retail Station"}`, 40, yPos, { align: "center" });
      
      yPos += 5;
      doc.text(`Address: ${outlet ? outlet.address : "Location"}`, 40, yPos, { align: "center" });
      
      yPos += 5;
      doc.text("-----------------------------------------", 40, yPos, { align: "center" });
      
      yPos += 6;
      doc.setFont("helvetica", "bold");
      doc.text("POS SALES RECEIPT", 40, yPos, { align: "center" });
      
      yPos += 5;
      doc.setFont("helvetica", "normal");
      doc.text("-----------------------------------------", 40, yPos, { align: "center" });
      
      yPos += 6;
      doc.text(`Receipt ID: #POS-${sale.id}`, 5, yPos);
      
      yPos += 5;
      doc.text(`Date: ${new Date(sale.created_at).toLocaleString()}`, 5, yPos);
      
      yPos += 5;
      doc.text(`Cashier: Alex (Staff)`, 5, yPos);
      
      yPos += 5;
      doc.text(`Payment: ${sale.payment_method.toUpperCase()}`, 5, yPos);
      
      yPos += 5;
      doc.text("-----------------------------------------", 40, yPos, { align: "center" });
      
      yPos += 6;
      doc.setFont("helvetica", "bold");
      doc.text("Items Sold", 5, yPos);
      doc.setFont("helvetica", "normal");
      
      yPos += 5;
      let subtotal = 0;
      sale.items.forEach(it => {
        const itemTotal = (it.price * it.quantity);
        subtotal += itemTotal;
        doc.text(`- ${it.menu_item_name}`, 5, yPos);
        yPos += 4;
        doc.text(`  Qty: ${it.quantity} @ Rs.${parseFloat(it.price).toFixed(2)}`, 5, yPos);
        doc.text(`Rs.${itemTotal.toFixed(2)}`, 75, yPos, { align: "right" });
        yPos += 5;
      });
      
      doc.text("-----------------------------------------", 40, yPos, { align: "center" });
      
      const grandTotal = parseFloat(sale.total_amount);
      if (subtotal > grandTotal && (subtotal - grandTotal) > 0.01) {
          yPos += 5;
          doc.text("Subtotal:", 5, yPos);
          doc.text(`Rs.${subtotal.toFixed(2)}`, 75, yPos, { align: "right" });
          yPos += 5;
          doc.text("Discount applied:", 5, yPos);
          doc.text(`-Rs.${(subtotal - grandTotal).toFixed(2)}`, 75, yPos, { align: "right" });
      }

      yPos += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`Grand Total:`, 5, yPos);
      doc.text(`Rs.${grandTotal.toFixed(2)}`, 75, yPos, { align: "right" });
      
      yPos += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Thank you for shopping!", 40, yPos, { align: "center" });

      doc.save(`POS_Receipt_${sale.id}.pdf`);
      alert("Receipt PDF downloaded successfully!");
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

  const _getStockColor = () => {
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

      {/* ================================================================
          CLOCK-IN GATE: Block POS until staff starts their shift
      ================================================================ */}
      {shiftChecked && !activeShift && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(13, 17, 23, 0.97)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9998, backdropFilter: "blur(16px)"
        }}>
          <div style={{
            background: "rgba(18,22,28,0.98)",
            border: "1px solid var(--brand)",
            boxShadow: "0 0 60px rgba(249,115,22,0.12)",
            borderRadius: "1.5rem", padding: "2.75rem 2.5rem",
            width: "100%", maxWidth: 460, textAlign: "center"
          }}>
            <div style={{
              width: 72, height: 72,
              background: "rgba(249,115,22,0.1)", borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 1.5rem", color: "var(--brand)"
            }}>
              <KeyRound size={32} />
            </div>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.6rem", fontWeight: 900, color: "var(--text-primary)", marginBottom: "0.4rem" }}>
              Start Your Shift
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: "1.75rem" }}>
              Enter your email and 4-digit PIN to clock in and access the POS terminal.
            </p>

            {clockInError && (
              <div className="alert alert-error" style={{ marginBottom: "1rem", textAlign: "left" }}>
                <ShieldAlert size={15} style={{ flexShrink: 0 }} /> {clockInError}
              </div>
            )}

            <form onSubmit={handleClockIn} style={{ display: "flex", flexDirection: "column", gap: "1rem", textAlign: "left" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Email Address</label>
                <input
                  id="clock-in-email"
                  type="email"
                  required
                  className="form-input"
                  placeholder="your@email.com"
                  value={clockInEmail}
                  onChange={e => setClockInEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">4-Digit PIN</label>
                <input
                  id="clock-in-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="\d{4}"
                  required
                  className="form-input"
                  placeholder="● ● ● ●"
                  value={clockInPin}
                  onChange={e => setClockInPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  autoComplete="off"
                  style={{ letterSpacing: "0.3em", fontSize: "1.2rem", textAlign: "center" }}
                />
              </div>
              <button
                id="clock-in-submit-btn"
                type="submit"
                disabled={clockInLoading}
                className="btn btn-primary"
                style={{ width: "100%", padding: "0.9rem", marginTop: "0.5rem", fontSize: "1rem", fontWeight: 700 }}
              >
                {clockInLoading ? "Clocking In…" : "Clock In & Start Shift"}
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="btn btn-secondary"
                style={{ width: "100%", padding: "0.75rem", fontSize: "0.875rem" }}
              >
                <LogOut size={15} /> Sign Out
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================
          CLOCK-OUT RESULT MODAL (shown after successful clock-out)
      ================================================================ */}
      {clockOutResult && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(13,17,23,0.9)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 9997, backdropFilter: "blur(8px)"
        }}>
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
            borderRadius: "1.25rem", padding: "2.5rem", maxWidth: 480, width: "100%", textAlign: "center"
          }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🕐</div>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.4rem", fontWeight: 800, marginBottom: "1rem" }}>Shift Closed</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {[
                ["Duration", `${clockOutResult.duration_hours ?? "—"} hrs`],
                ["Expected Cash", `₹${(clockOutResult.expected_cash ?? 0).toFixed(2)}`],
                ["Actual Cash", `₹${(clockOutResult.actual_cash ?? 0).toFixed(2)}`],
                ["Discrepancy", `₹${(clockOutResult.cash_discrepancy ?? 0).toFixed(2)}`,
                  (clockOutResult.cash_discrepancy ?? 0) < 0 ? "#ef4444" :
                  (clockOutResult.cash_discrepancy ?? 0) > 0 ? "#22c55e" : "var(--text-primary)"]
              ].map(([label, val, color]) => (
                <div key={label} style={{ background: "var(--bg-hover)", borderRadius: "0.75rem", padding: "0.875rem" }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em", marginBottom: "0.25rem" }}>{label}</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: color || "var(--text-primary)" }}>{val}</div>
                </div>
              ))}
            </div>
            {(clockOutResult.cash_discrepancy ?? 0) < 0 && (
              <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
                ⚠️ Cash is short by ₹{Math.abs(clockOutResult.cash_discrepancy).toFixed(2)}. Please investigate.
              </div>
            )}
            <button
              id="clock-out-done-btn"
              className="btn btn-primary"
              style={{ width: "100%", padding: "0.875rem", marginBottom: "0.75rem" }}
              onClick={() => { setClockOutResult(null); }}
            >
              Done
            </button>
            <button className="btn btn-secondary" style={{ width: "100%" }} onClick={onLogout}>
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* ================================================================
          CLOCK-OUT MODAL
      ================================================================ */}
      {showClockOutModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(13,17,23,0.85)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 9996, backdropFilter: "blur(6px)"
        }}>
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
            borderRadius: "1.25rem", padding: "2rem", maxWidth: 420, width: "100%"
          }}>
            <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.5rem" }}>Clock Out</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
              Enter the actual cash amount counted in the drawer to close your shift.
            </p>
            <form onSubmit={handleClockOut} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Actual Cash in Drawer (₹)</label>
                <input
                  id="clock-out-cash-input"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  className="form-input"
                  placeholder="0.00"
                  value={actualCashInput}
                  onChange={e => setActualCashInput(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  id="clock-out-submit-btn"
                  type="submit"
                  disabled={clockOutLoading}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: "0.8rem" }}
                >
                  {clockOutLoading ? "Closing Shift…" : "Confirm Clock Out"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "0.8rem 1rem" }}
                  onClick={() => setShowClockOutModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", background: "var(--bg-card)", padding: "0.875rem 1.25rem", borderRadius: "var(--r-lg)", border: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: 36, height: 36, background: "var(--brand-dim)", borderRadius: "var(--r-md)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)" }}>
            <Store size={18} />
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 700 }}>Cashier Terminal</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
              {outlet ? outlet.name : "Loading…"}
              {activeShift && (
                <span style={{ marginLeft: "0.5rem", color: "#22c55e", fontWeight: 600 }}>
                  ● Shift Active since {new Date(activeShift.clock_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {activeShift && (
            <button
              id="clock-out-btn"
              onClick={() => setShowClockOutModal(true)}
              className="btn btn-secondary"
              style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem", color: "#22c55e", borderColor: "#22c55e33" }}
              title="Clock out and close shift"
            >
              <Clock size={14} /> Clock Out
            </button>
          )}

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

            {/* ── POS TICKET & TOOLS ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", height: "100%", overflowY: "auto", paddingRight: "4px" }}>

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

              {/* Product Code Scanner Panel */}
              <div style={{
                background: "var(--bg-hover)", borderRadius: "0.875rem",
                padding: "0.875rem", marginBottom: "0.75rem",
                border: "1px solid var(--border-subtle)"
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <QrCode size={14} style={{ color: "var(--brand)" }} />
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Scan Product</span>
                  </div>
                  <button onClick={() => setIsScanning(!isScanning)} className="btn btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>
                    {isScanning ? "Close Camera" : "Open Camera"}
                  </button>
                </div>
                
                {isScanning && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    <QRScanner onStockUpdated={async (code) => { 
                      setIsScanning(false);
                      if (code) {
                        try {
                          const product = await api.getFoodByCode(code.trim().toLowerCase());
                          const itemInMenu = menu.find(m => m.id === product.id);
                          if (!itemInMenu) throw new Error("Item not available in this outlet");
                          handleSelectItem(itemInMenu.id);
                        } catch (err) {
                          setScanError(err.message || "Product code not found");
                        }
                      }
                    }} />
                  </div>
                )}
                
                <form onSubmit={handleProductCodeEntry} style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter Product Code (e.g. som1)"
                    value={productCodeInput}
                    onChange={e => setProductCodeInput(e.target.value)}
                    style={{ flex: 1, fontSize: "0.8rem", padding: "0.5rem 0.75rem" }}
                  />
                  <button
                    type="submit"
                    className="btn btn-secondary"
                    style={{ padding: "0.5rem 0.75rem", fontSize: "0.8rem", flexShrink: 0 }}
                  >
                    Add
                  </button>
                </form>
                {scanError && <p style={{ color: "var(--error)", fontSize: "0.75rem", marginTop: "0.4rem", margin: 0 }}>{scanError}</p>}
              </div>

              {/* Customer CRM Panel */}
              <div style={{
                background: "var(--bg-hover)", borderRadius: "0.875rem",
                padding: "0.875rem", marginBottom: "0.75rem",
                border: "1px solid var(--border-subtle)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <User size={14} style={{ color: "var(--brand)" }} />
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Customer CRM</span>
                </div>
                {!crmResult ? (
                  <form onSubmit={handleCrmLookup} style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      id="crm-email-input"
                      type="email"
                      className="form-input"
                      placeholder="customer@email.com"
                      value={crmEmail}
                      onChange={e => setCrmEmail(e.target.value)}
                      style={{ flex: 1, fontSize: "0.8rem", padding: "0.5rem 0.75rem" }}
                    />
                    <button
                      id="crm-lookup-btn"
                      type="submit"
                      className="btn btn-secondary"
                      style={{ padding: "0.5rem 0.75rem", fontSize: "0.8rem", flexShrink: 0 }}
                      disabled={crmLoading}
                    >
                      {crmLoading ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={13} />}
                    </button>
                  </form>
                ) : (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)" }}>{crmResult.customer.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{crmResult.customer.email}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.3rem" }}>
                          <Gift size={12} style={{ color: "#f59e0b" }} />
                          <span style={{ fontSize: "0.8rem", color: "#f59e0b", fontWeight: 700 }}>
                            {crmResult.customer.loyalty_points} loyalty pts
                          </span>
                        </div>
                      </div>
                      <button onClick={clearCrm} className="btn-icon"><X size={13} /></button>
                    </div>
                    {crmResult.top_items && crmResult.top_items.length > 0 && (
                      <div style={{ marginTop: "0.5rem" }}>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em", marginBottom: "0.3rem" }}>Upsell: Frequently Buys</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                          {crmResult.top_items.map((item, i) => (
                            <span key={i} style={{ background: "var(--brand-dim)", color: "var(--brand)", fontSize: "0.7rem", padding: "0.2rem 0.5rem", borderRadius: "999px", fontWeight: 600 }}>
                              {item.name} ×{item.total_ordered}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {crmResult.customer.loyalty_points > 0 && (
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.6rem", cursor: "pointer", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        <input
                          id="redeem-points-toggle"
                          type="checkbox"
                          checked={redeemPoints}
                          onChange={e => setRedeemPoints(e.target.checked)}
                          style={{ accentColor: "var(--brand)" }}
                        />
                        Redeem {Math.min(crmResult.customer.loyalty_points, Math.floor(finalTotalAmount))} pts (₹{Math.min(crmResult.customer.loyalty_points, Math.floor(finalTotalAmount))} off)
                      </label>
                    )}
                  </div>
                )}
                {crmError && <p style={{ color: "var(--error)", fontSize: "0.75rem", marginTop: "0.4rem", margin: 0 }}>{crmError}</p>}
              </div>

              {/* Ticket */}
              <div className="pos-ticket" style={{ position: "relative", top: "auto", height: "auto", flex: 1, minHeight: "350px" }}>
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

                  {/* Discount Coupon */}
                  <div style={{ marginBottom: "1rem" }}>
                    <span className="form-label" style={{ marginBottom: "0.35rem", display: "block" }}>Discount Coupon</span>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Enter code (e.g. WELCOME10)"
                        style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem", textTransform: "uppercase", height: "auto" }}
                        value={couponCodeInput}
                        onChange={e => setCouponCodeInput(e.target.value)}
                      />
                      <button type="button" onClick={handleApplyCoupon} className="btn btn-secondary" style={{ padding: "0.4rem 0.85rem", fontSize: "0.8rem", height: "auto" }}>
                        Apply
                      </button>
                    </div>
                    {couponError && (
                      <div style={{ fontSize: "0.72rem", color: "#ef4444", marginTop: "0.25rem", fontWeight: "600" }}>
                        ❌ {couponError}
                      </div>
                    )}
                    {appliedCoupon && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "6px", padding: "0.35rem 0.5rem", marginTop: "0.4rem" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--success)", fontWeight: "700" }}>
                          ✓ "{appliedCoupon.code}" ({appliedCoupon.discount_pct}% Off)
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

                  {/* Totals */}
                  <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.875rem", marginBottom: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      <span>Items</span><span>{getSaleTotalQty()} units</span>
                    </div>
                    {appliedCoupon && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--success)", marginBottom: "0.35rem", fontWeight: "600" }}>
                        <span>Discount ({appliedCoupon.code})</span><span>-₹{discountAmount.toFixed(0)}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-heading)", fontSize: "1.3rem", fontWeight: 800 }}>
                      <span>Total</span>
                      <span style={{ color: "var(--brand)" }}>₹{finalTotalAmount.toFixed(0)}</span>
                    </div>
                  </div>

                  <button onClick={handleCompleteSale} disabled={getSaleTotalQty() === 0 || loading} className="btn btn-primary" style={{ width: "100%", padding: "0.875rem", fontSize: "0.95rem" }}>
                    {loading ? "Processing…" : `Complete Sale · ₹${finalTotalAmount.toFixed(0)}`}
                  </button>
                </div>
              </div>

            </div>{/* end right panel */}

          </div>{/* end pos-grid */}

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
