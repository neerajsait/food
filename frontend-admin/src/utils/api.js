// API client for communicating with the Flask backend.
// Implements a Mock Fallback Mode using localStorage if the backend is unreachable.

const live = true;
export const API_BASE_URL = import.meta.env.VITE_API_URL || (
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? `${window.location.protocol}//${window.location.hostname}:5000/api`
    : `${window.location.protocol}//${window.location.host}/api`
);

// Override fetch to always append cache-busting timestamp to GET requests
// and handle 401 Unauthorized by attempting a token refresh.
const originalFetch = window.fetch;
let isRefreshing = false;
let refreshPromise = null;

window.fetch = async (url, options) => {
  if (typeof url === 'string' && url.includes(API_BASE_URL) && (!options || options.method === 'GET' || !options.method)) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}_t=${Date.now()}`;
  }
  
  let res = await originalFetch(url, options);
  
  if ((res.status === 401 || res.status === 422) && typeof url === 'string' && url.includes(API_BASE_URL) && !url.includes('/api/auth/login') && !url.includes('/api/auth/refresh')) {
    const refreshToken = sessionStorage.getItem("refresh_token");
    if (refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true;
        const refreshUrl = API_BASE_URL.replace(/\/?$/, '/auth/refresh');
        refreshPromise = originalFetch(refreshUrl, {
          method: "POST",
          headers: { "Authorization": `Bearer ${refreshToken}` }
        }).then(async refreshRes => {
          isRefreshing = false;
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            sessionStorage.setItem("token", data.access_token);
            if (data.refresh_token) {
              sessionStorage.setItem("refresh_token", data.refresh_token);
            }
            return data.access_token;
          } else {
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("refresh_token");
            window.location.href = "/login";
            throw new Error("Session expired");
          }
        }).catch(err => {
          isRefreshing = false;
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("refresh_token");
          window.location.href = "/login";
          throw err;
        });
      }
      
      const newToken = await refreshPromise;
      if (newToken) {
        // Retry original request
        const newOptions = { ...options };
        newOptions.headers = { ...newOptions.headers, "Authorization": `Bearer ${newToken}` };
        res = await originalFetch(url, newOptions);
      }
    } else {
      sessionStorage.removeItem("token");
      window.location.href = "/login";
    }
  }
  
  return res;
};
// Helper to retrieve auth tokens
function getAuthHeader() {
  const token = sessionStorage.getItem("token");
  return token ? { "Authorization": `Bearer ${token}` } : {};
}

// Safe JSON parser — never crashes on HTML responses (e.g. 502 gateway, Vite fallback)
async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    // const text = await res.text();
    // Backend returned HTML — means server is down or misconfigured
    // Reset live cache so next call retries
    cachedLive = null;
    lastCheckTime = 0;
    throw new Error(
      res.status === 404
        ? "API endpoint not found (404). Please restart the backend."
        : `Server returned non-JSON response (status ${res.status}). Make sure the backend is running on port 5000.`
    );
  }
  return res.json();
}

// Check if backend is alive (cached for 10 seconds to resolve UI lag)
let cachedLive = null;
let lastCheckTime = 0;

async function checkBackendAlive(bypassThrow = false) {
  // Never mock remote APIs
  if (API_BASE_URL.includes("https") || !API_BASE_URL.includes("localhost") && !API_BASE_URL.includes("127.0.0.1")) {
    return true; 
  }
  return true; // Forced Real Mode
}

// ----------------------------------------------------------------
// ----------------------------------------------------------------






// Mock API implementations for fallback mode
;

// ----------------------------------------------------------------
// Exportable API client
// ----------------------------------------------------------------
export const api = {
  // Check backend state dynamically to toggle Demo Banner in UI
  async getMode() {
    const live = await checkBackendAlive(true);
    if (live) return "Live Backend";
    return import.meta.env.VITE_DEMO_MODE === "true" ? "Demo Mode (Mock Database)" : "Server Offline";
  },

  async register(email, password, role, first_name = "", last_name = "", phone = "", outlet_id = null, referral_code = "") {

    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role, first_name, last_name, phone, outlet_id: outlet_id ? parseInt(outlet_id) : null, referral_code })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Registration failed");
    return data;
  },

  async login(payload) {
    if (!live) {
      // Mock API expects (email, password)
      const emailOrCode = payload.email || payload.staff_code;
      const passOrPin = payload.password || payload.pin;
      sessionStorage.setItem("token", data.access_token);
      sessionStorage.setItem("user", JSON.stringify(data.user));
      return data;
    }

    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Login failed");
    sessionStorage.setItem("token", data.access_token);
    if (data.refresh_token) {
      sessionStorage.setItem("refresh_token", data.refresh_token);
    }
    sessionStorage.setItem("user", JSON.stringify(data.user));
    return data;
  },

  async logout() {
    try {
      const userStr = sessionStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        if (['staff', 'kitchen', 'outlet_owner'].includes(user.role)) {
          // Fire and forget auto-clockout
          fetch(`${API_BASE_URL}/pos/shift/clock-out`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${sessionStorage.getItem("token")}`
            },
            body: JSON.stringify({}) // Backend defaults actual_cash to expected_cash
          }).catch(() => {});
        }
      }
    } catch(e) {}
    
    try {
      const refreshToken = sessionStorage.getItem("refresh_token");
      const body = refreshToken ? JSON.stringify({ refresh_token: refreshToken }) : undefined;
      const res = await originalFetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body
      });
      if (!res.ok) {
        console.warn("Backend logout returned non-OK status. Session might remain active on server.");
      }
    } catch (e) {
      console.error("Logout failed:", e);
      alert("Warning: Could not reach the server to securely log out. Local session cleared, but remote session may remain active.");
    }

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("refresh_token");
    sessionStorage.removeItem("user");
    window.location.href = "/login";
  },

  getCurrentUser() {
    const userStr = sessionStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  },

  async verifyEmail(token) {
    const live = await checkBackendAlive(true);
    if (!live) throw new Error("Verification requires live backend.");
    const res = await fetch(`${API_BASE_URL}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to verify email");
    return data;
  },


  async getMe() {
    if (!live) {
      return this.getCurrentUser();
    }
    const token = sessionStorage.getItem("token");
    if (!token) throw new Error("No token");

    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    const data = await safeJson(res);
    if (data.user) {
      sessionStorage.setItem("user", JSON.stringify(data.user));
      return data.user;
    } else if (data.id) {
      sessionStorage.setItem("user", JSON.stringify(data));
      return data;
    }
    return null;
  },

  // -----------------------
  // B2C Customer Endpoints
  // -----------------------
  async getFoodsMenu() {

    const res = await fetch(`${API_BASE_URL}/foods/menu`);
    if (!res.ok) throw new Error("Failed to load menu");
    return safeJson(res);
  },

  async placeOrder(items, deliveryAddress, paymentMethod = "COD", couponCode = null, redeemLoyaltyPoints = 0, deliveryCharge = 0) {
    const user = this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");


    const res = await fetch(`${API_BASE_URL}/foods/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ items, delivery_address: deliveryAddress, payment_method: paymentMethod, coupon_code: couponCode, redeem_loyalty_points: redeemLoyaltyPoints, delivery_charge: deliveryCharge })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to place order");
    return data;
  },

  async getOrderHistory() {
    const user = this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");


    // FIX: Correct endpoint is /foods/orders (not /foods/orders/history)
    const res = await fetch(`${API_BASE_URL}/foods/orders`, {
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error("Failed to load order history");
    return safeJson(res);
  },

  async confirmReceipt(orderId, trackingCode) {
    const user = this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");


    const res = await fetch(`${API_BASE_URL}/foods/orders/${orderId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ tracking_code: trackingCode })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Confirmation failed");
    return data;
  },

  async submitFeedback(orderId, rating, comment) {
    const user = this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");


    const res = await fetch(`${API_BASE_URL}/foods/orders/${orderId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ rating: parseInt(rating), comment })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Feedback submission failed");
    return data;
  },

  // -----------------------
  // POS Staff Endpoints
  // -----------------------
  async getPOSMenu() {
    if (!live) {
      const user = this.getCurrentUser();
    }

    // FIX: Correct endpoint is /pos/menu
    const res = await fetch(`${API_BASE_URL}/pos/menu`, { headers: getAuthHeader(), cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load POS menu");
    return safeJson(res);
  },

  async posSell(items, paymentMethod, couponCode = null) {
    const user = this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");


    // FIX: Correct endpoint is /pos/sell
    const res = await fetch(`${API_BASE_URL}/pos/sell`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ items, payment_method: paymentMethod, coupon_code: couponCode })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "POS transaction failed");
    return data;
  },

  // -----------------------
  // Admin Endpoints
  // -----------------------
  async adminGetOrders() {

    const res = await fetch(`${API_BASE_URL}/admin/orders`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to fetch order queue");
    return safeJson(res);
  },

  async adminShipOrder(orderId, trackingCode, trackingLabel = null, trackingLink = null) {

    // FIX: Correct endpoint is /admin/orders/<id>/ship (PUT)
    const res = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/ship`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ tracking_code: trackingCode, tracking_label: trackingLabel, tracking_link: trackingLink })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to update ship status");
    return data;
  },

  async adminGetOutlets() {

    const res = await fetch(`${API_BASE_URL}/admin/outlets`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load outlets list");
    return safeJson(res);
  },

  async posGetMyOutlet() {
    if (!live) {
      const user = this.getCurrentUser();
      return outlets.find(o => o.id === user?.outlet_id) || outlets[0];
    }

    const res = await fetch(`${API_BASE_URL}/pos/outlet`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load assigned outlet info");
    return safeJson(res);
  },

  async adminUpdateOutlet(outletId, data) {

    const res = await fetch(`${API_BASE_URL}/admin/outlets/${outletId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Failed to update outlet");
    return result;
  },

  async adminDeleteOutlet(outletId) {
    if (!live) return { success: true };
    const res = await fetch(`${API_BASE_URL}/admin/outlets/${outletId}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Failed to delete outlet");
    return result;
  },

  async getFoodByCode(code) {
    if (!live) {
      const menu = JSON.parse(localStorage.getItem("mock_menu") || "[]");
      const item = menu.find(m => m.code === code);
      if (!item) throw new Error("Item not found");
      return item;
    }
    const res = await fetch(`${API_BASE_URL}/foods/menu/code/${encodeURIComponent(code)}`);
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || "Item not found");
    return result;
  },

  async adminAddMenuItem(data) {

    const res = await fetch(`${API_BASE_URL}/admin/menu`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Failed to add menu item");
    return result;
  },

  async adminUpdateMenuItem(itemId, data) {
    if (!live) {
      const menu = JSON.parse(localStorage.getItem("mock_menu") || "[]");
      const idx = menu.findIndex(m => m.id === parseInt(itemId));
      if (idx !== -1) {
        if (data.is_best_seller) {
          menu.forEach(m => m.is_best_seller = false);
        }
        menu[idx] = { ...menu[idx], ...data };
        localStorage.setItem("mock_menu", JSON.stringify(menu));
      }
      return { success: true, item: menu[idx] };
    }
    const res = await fetch(`${API_BASE_URL}/admin/menu/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Failed to update menu item");
    return result;
  },

  async adminDeleteMenuItem(itemId) {
    if (!live) return { success: true };
    const res = await fetch(`${API_BASE_URL}/admin/menu/${itemId}`, {
      method: "POST", // POST to bypass 405 Method Not Allowed proxy errors
      headers: getAuthHeader()
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Failed to delete menu item");
    return result;
  },

  async adminGetMenuItems() {
    if (!live) {
      const menu = JSON.parse(localStorage.getItem("mock_menu") || "[]");
      return menu.filter(item => item.is_active);
    }

    const res = await fetch(`${API_BASE_URL}/admin/menu`, { headers: getAuthHeader(), cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load admin menu catalog");
    return safeJson(res);
  },

  async adminAssignItemToOutlet(outletId, menuItemId, currentStock, restockLimit) {

    // FIX: Correct endpoint is /admin/outlets/<id>/items (POST)
    const res = await fetch(`${API_BASE_URL}/admin/outlets/${outletId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({
        menu_item_id: parseInt(menuItemId),
        current_stock: parseInt(currentStock),
        restock_limit: parseInt(restockLimit)
      })
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Failed to assign item");
    return result;
  },

  async adminRemoveItemFromOutlet(outletId, menuItemId) {

    // FIX: Correct endpoint is DELETE /admin/outlets/<id>/items/<mid>
    const res = await fetch(`${API_BASE_URL}/admin/outlets/${outletId}/items/${menuItemId}`, {
      method: "DELETE",
      headers: { ...getAuthHeader() }
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Failed to remove item");
    return result;
  },

  async adminGenerateQR(payload) {
    if (!live) {
      // Mock: just return payload info, no real QR image in demo mode
      return { qr_image: null, payload, demo: true };
    }
    const res = await fetch(`${API_BASE_URL}/admin/generate-qr`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to generate QR");
    return data;
  },

  async posScanArrival(qrData) {

    let payload;
    try {
      payload = JSON.parse(qrData);
    } catch (err) {
      throw new Error("Invalid QR code â€” not a dispatch label.");
    }

    if (!live) {
      // Demo fallback: parse QR and simulate arrival
      return {
        message: `+${payload.qty} units of '${payload.item}' added (Demo)`,
        item: payload.item,
        qty_added: payload.qty,
        new_stock: payload.qty + 10,
        batch_id: Math.floor(Math.random() * 1000)
      };
    }

    const res = await fetch(`${API_BASE_URL}/pos/scan-arrival`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({
        qr_data: qrData,
        batch_number: payload.batch_number || null,
        expiry_date: payload.expiry_date || null
      })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Scan failed");
    return data;
  },

  async adminGetRevenueShare() {
    const outlets = JSON.parse(localStorage.getItem("mock_outlets") || "[]");
    const orders = JSON.parse(localStorage.getItem("mock_orders") || "[]");
    return outlets.map(o => {
      const sales = orders.filter(or => or.outlet_id === o.id).reduce((sum, or) => sum + (or.total_price || 0), 0);
      const pct = o.revenue_share_percentage || 0;
      return {
        outlet_id: o.id,
        outlet_name: o.name,
        total_sales: sales,
        revenue_share_percentage: pct,
        brand_cut: sales * (pct / 100)
      };
    });
  },

  async adminGetAnalytics() {

    const res = await fetch(`${API_BASE_URL}/admin/analytics`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load analytics");
    return safeJson(res);
  },

  async posGetMyShifts() {
    if (!live) {
      const user = this.getCurrentUser();
      if (!user) throw new Error("Unauthorized");
      const shifts = JSON.parse(localStorage.getItem("mock_shifts") || "[]");
      return shifts.filter(s => s.staff_id === user.id).sort((a,b) => new Date(b.clock_in_time) - new Date(a.clock_in_time));
    }
    const res = await fetch(`${API_BASE_URL}/pos/my-shifts`, {
      headers: getAuthHeader()
    });
    return safeJson(res);
  },

  async adminGetAuditLogs(page = 1, perPage = 50) {

    const res = await fetch(`${API_BASE_URL}/admin/audit-log?page=${page}&per_page=${perPage}`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load audit logs");
    return safeJson(res);
  },

  async posLogDisposal(menuItemId, qty, reason) {
    const user = this.getCurrentUser();
    if (!live) {
      if (!user) throw new Error("Unauthorized");
    }

    const res = await fetch(`${API_BASE_URL}/pos/disposal`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ menu_item_id: parseInt(menuItemId), quantity: parseInt(qty), reason })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to log disposal");
    return data;
  },

  async ownerGetDashboard() {
    const user = this.getCurrentUser();
    if (!live) {
      if (!user) throw new Error("Unauthorized");
    }
    const res = await fetch(`${API_BASE_URL}/owner/dashboard`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load owner dashboard");
    return safeJson(res);
  },

  async ownerCreateOutlet(payload) {
    const user = this.getCurrentUser();
    if (!live) {
      if (!user) throw new Error("Unauthorized");
    }
    const res = await fetch(`${API_BASE_URL}/owner/outlets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to create outlet");
    return data;
  },

  async ownerEditOutlet(outletId, payload) {
    const user = this.getCurrentUser();
    if (!live) {
      if (!user) throw new Error("Unauthorized");
    }
    const res = await fetch(`${API_BASE_URL}/owner/outlets/${outletId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to edit outlet");
    return data;
  },

  async ownerGetStock(outletId) {
    const user = this.getCurrentUser();
    if (!live) {
      if (!user) throw new Error("Unauthorized");
    }
    const res = await fetch(`${API_BASE_URL}/owner/outlets/${outletId}/stock`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load outlet stock");
    return safeJson(res);
  },

  async forgotPassword(email) {
    const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Request failed");
    return result;
  },

  async resetPassword(email, token, newPassword) {
    const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token, new_password: newPassword })
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Reset failed");
    return result;
  },

  async changePassword(newPassword) {
    const user = this.getCurrentUser();
    if (!live) {
      if (!user) throw new Error("Unauthorized");
      user.is_first_login = false;
      sessionStorage.setItem("user", JSON.stringify(user));
      return result;
    }
    const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ new_password: newPassword })
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Change failed");

    if (user) {
      user.is_first_login = false;
      sessionStorage.setItem("user", JSON.stringify(user));
    }
    return result;
  },

  async updateProfile(data) {
    const currentUser = this.getCurrentUser();
    if (!live) {
      if (!currentUser) throw new Error("Unauthorized");
      // Actually persist the profile changes in mock mode
      const users = JSON.parse(localStorage.getItem("mock_users") || "[]");
      const idx = users.findIndex(u => u.id === currentUser.id);
      if (idx !== -1) {
        if (data.first_name) users[idx].first_name = data.first_name;
        if (data.last_name !== undefined) users[idx].last_name = data.last_name;
        if (data.phone !== undefined) users[idx].phone = data.phone;
        if (data.address !== undefined) users[idx].address = data.address;
        if (data.email && data.email !== currentUser.email) users[idx].email = data.email;
        if (data.password) users[idx].password = data.password;
        localStorage.setItem("mock_users", JSON.stringify(users));
        const updatedUser = { ...currentUser, ...users[idx] };
        sessionStorage.setItem("user", JSON.stringify(updatedUser));
        return { success: true, user: updatedUser };
      }
      return { success: true, user: currentUser };
    }
    const res = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Profile update failed");
    if (result.user) {
      sessionStorage.setItem("user", JSON.stringify(result.user));
    }
    return result;
  },

  async getLoyaltyHistory() {
    const user = this.getCurrentUser();
    if (!live) {
      if (!user) throw new Error("Unauthorized");
      const users = JSON.parse(localStorage.getItem("mock_users") || "[]");
      const fullUser = users.find(u => u.id === user.id) || user;
      return {
        loyalty_points: fullUser.loyalty_points || 0,
        referral_code: fullUser.referral_code || null,
        referral_count: fullUser.referral_count || 0,
        history: (fullUser.loyalty_history || []).sort((a, b) => new Date(b.date) - new Date(a.date))
      };
    }
    const res = await fetch(`${API_BASE_URL}/customer/loyalty`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load loyalty data");
    return safeJson(res);
  },

  async adminGetUsers() {
    const res = await fetch(`${API_BASE_URL}/admin/staff`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load users");
    return safeJson(res);
  },

  async adminUpdateUser(userId, data) {
    const res = await fetch(`${API_BASE_URL}/admin/staff/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Failed to update user");
    return result;
  },

  async adminDeleteUser(userId) {
    if (!live) return { success: true }; // Mock implementation
    const res = await fetch(`${API_BASE_URL}/admin/staff/${userId}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Failed to delete user");
    return result;
  },

  async validateCoupon(code) {
    const res = await fetch(`${API_BASE_URL}/coupons/${code}`);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Invalid coupon");
    return data;
  },

  async getActiveCoupons() {
    const res = await fetch(`${API_BASE_URL}/coupons/active`);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to fetch active coupons");
    return data;
  },

  async adminGetCoupons() {
    const res = await fetch(`${API_BASE_URL}/admin/coupons`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load coupons");
    return safeJson(res);
  },

  async adminAddCoupon(data) {
    const res = await fetch(`${API_BASE_URL}/admin/coupons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || "Failed to create coupon");
    return result;
  },

  async adminUpdateCoupon(couponId, data) {
    const res = await fetch(`${API_BASE_URL}/admin/coupons/${couponId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || "Failed to update coupon");
    return result;
  },

  async adminDeleteCoupon(couponId) {
    const res = await fetch(`${API_BASE_URL}/admin/coupons/${couponId}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || "Failed to delete coupon");
    return result;
  },

  async getOutletCoupons() {
    if (!live) {
      // Mock: return all active coupons that are outlet or both scope
      const coupons = JSON.parse(localStorage.getItem("mock_coupons") || "[]");
      return coupons.filter(c => c.is_active && (!c.scope || c.scope === "both" || c.scope === "outlet"));
    }
    const res = await fetch(`${API_BASE_URL}/outlet/coupons`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to fetch outlet coupons");
    return safeJson(res);
  },

  async getMenuItemReviews(itemId) {

    const res = await fetch(`${API_BASE_URL}/foods/menu-items/${itemId}/reviews`);
    if (!res.ok) throw new Error("Failed to load reviews");
    return safeJson(res);
  },

  async submitMenuItemReview(itemId, rating, comment) {
    const user = this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");


    const res = await fetch(`${API_BASE_URL}/foods/menu-items/${itemId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ rating: parseInt(rating), comment })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Review submission failed");
    return data;
  },

  async adminGetReviews() {

    const res = await fetch(`${API_BASE_URL}/admin/reviews`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load reviews");
    return safeJson(res);
  },

  async adminUpdateReview(reviewId, data) {

    const res = await fetch(`${API_BASE_URL}/admin/reviews/${reviewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Failed to update review");
    return result;
  },

  async adminDeleteReview(reviewId) {

    const res = await fetch(`${API_BASE_URL}/admin/reviews/${reviewId}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to delete review");
    return data;
  },

  async cancelOrder(orderId, reason = "Cancelled by customer") {
    if (!live) {
      const orders = JSON.parse(localStorage.getItem("mock_orders")) || [];
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx !== -1) {
        orders[idx].status = "cancelled";
        orders[idx].cancel_reason = reason;
        localStorage.setItem("mock_orders", JSON.stringify(orders));
      }
      return { message: "Order cancelled (Mock)" };
    }
    const res = await fetch(`${API_BASE_URL}/foods/orders/${orderId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ reason })
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Failed to cancel order");
    return result;
  },
  // -------------------------------------------------------
  // Staff Shift Management (Clock-In / Clock-Out)
  // -------------------------------------------------------
  async posClockIn(email, pin) {
    if (!live) {
      const users = JSON.parse(localStorage.getItem("mock_users") || "[]");
      const user = users.find(u => u.email === email);
      if (!user) throw new Error("Email does not match your account");
      if (!user.pin) throw new Error("No PIN set. Contact your administrator.");
      if (user.pin !== pin) throw new Error("Incorrect PIN");
      const shifts = JSON.parse(localStorage.getItem("mock_shifts") || "[]");
      const active = shifts.find(s => s.staff_id === user.id && s.status === "active");
      if (active) throw new Error("You already have an active shift. Please clock out first.");
      const newShift = {
        id: Date.now(), staff_id: user.id, outlet_id: user.outlet_id,
        staff_email: user.email,
        staff_name: ((user.first_name || "") + " " + (user.last_name || "")).trim(),
        outlet_name: "Outlet",
        clock_in_time: new Date().toISOString(), clock_out_time: null,
        expected_cash: null, actual_cash: null, cash_discrepancy: null,
        status: "active", notes: null
      };
      shifts.push(newShift);
      localStorage.setItem("mock_shifts", JSON.stringify(shifts));
      return { message: "Clocked in successfully", shift: newShift };
    }
    const res = await fetch(`${API_BASE_URL}/pos/shift/clock-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ email, pin })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Clock-in failed");
    return data;
  },

  async posGetActiveShift() {
    const user = this.getCurrentUser();
    if (!live) {
      if (!user) return { shift: null };
      const shifts = JSON.parse(localStorage.getItem("mock_shifts") || "[]");
      const active = shifts.find(s => s.staff_id === user.id && s.status === "active");
      if (active) {
        // Fix for the 05:07 AM outdated clock-in time: reset it to now
        active.clock_in_time = new Date().toISOString();
        localStorage.setItem("mock_shifts", JSON.stringify(shifts));
      }
      return { shift: active || null };
    }
    const res = await fetch(`${API_BASE_URL}/pos/shift/active`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to check active shift");
    return safeJson(res);
  },

  async posClockOut(actualCash, notes) {
    const user = this.getCurrentUser();
    notes = notes || "";
    if (!live) {
      if (!user) throw new Error("Unauthorized");
      const shifts = JSON.parse(localStorage.getItem("mock_shifts") || "[]");
      const sales = JSON.parse(localStorage.getItem("mock_sales") || "[]");
      const active = shifts.find(s => s.staff_id === user.id && s.status === "active");
      if (!active) throw new Error("No active shift found");
      const shiftStart = new Date(active.clock_in_time);
      const cashSales = sales.filter(s =>
        s.staff_id === user.id &&
        (s.payment_method || "").toLowerCase() === "cash" &&
        new Date(s.created_at) >= shiftStart
      );
      const expected = cashSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
      active.clock_out_time = new Date().toISOString();
      active.actual_cash = parseFloat(actualCash);
      active.expected_cash = expected;
      active.cash_discrepancy = parseFloat(actualCash) - expected;
      active.status = "closed";
      active.notes = notes || null;
      localStorage.setItem("mock_shifts", JSON.stringify(shifts));
      return { message: "Shift closed successfully", shift: active };
    }
    const res = await fetch(`${API_BASE_URL}/pos/shift/clock-out`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ actual_cash: parseFloat(actualCash), notes })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Clock-out failed");
    return data;
  },

  async posLookupCustomer(email) {
    if (!live) {
      const users = JSON.parse(localStorage.getItem("mock_users") || "[]");
      const customer = users.find(u => u.email === email && u.role === "customer");
      if (!customer) throw new Error("Customer not found");
      return {
        customer: {
          id: customer.id, email: customer.email,
          name: ((customer.first_name || "") + " " + (customer.last_name || "")).trim() || customer.email,
          loyalty_points: customer.loyalty_points || 0
        },
        top_items: []
      };
    }
    const res = await fetch(
      `${API_BASE_URL}/pos/customer/lookup?email=${encodeURIComponent(email)}`,
      { headers: getAuthHeader() }
    );
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Customer lookup failed");
    return data;
  },

  async posSellWithCRM(items, paymentMethod, couponCode, customerEmail, redeemLoyaltyPoints) {
    couponCode = couponCode || null;
    customerEmail = customerEmail || null;
    redeemLoyaltyPoints = redeemLoyaltyPoints || 0;
    const user = this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    if (!live) {
      if (customerEmail) {
        const users = JSON.parse(localStorage.getItem("mock_users") || "[]");
        const customer = users.find(u => u.email === customerEmail && u.role === "customer");
        if (customer) {
          const total = (result.sale && result.sale.total_amount) ? result.sale.total_amount : 0;
          let finalTotal = total;
          let pointsRedeemed = 0;
          
          // dynamic rates default matching backend
          const earnRate = 0.1;
          const redeemRate = 0.01;
          
          if (redeemLoyaltyPoints > 0) {
            const maxRedeemAllowed = Math.floor(total / redeemRate);
            const actualRedeem = Math.min(redeemLoyaltyPoints, customer.loyalty_points || 0, maxRedeemAllowed);
            const pointsDiscount = actualRedeem * redeemRate;
            
            finalTotal = Math.max(0, total - pointsDiscount);
            customer.loyalty_points = (customer.loyalty_points || 0) - actualRedeem;
            pointsRedeemed = actualRedeem;
          }
          const earned = Math.floor(finalTotal * earnRate);
          customer.loyalty_points = (customer.loyalty_points || 0) + earned;
          localStorage.setItem("mock_users", JSON.stringify(users));
          result.loyalty_points_earned = earned;
          result.loyalty_points_redeemed = pointsRedeemed;
          result.customer_loyalty_balance = customer.loyalty_points;
        }
      }
      return result;
    }

    const res = await fetch(`${API_BASE_URL}/pos/sell`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({
        items, payment_method: paymentMethod, coupon_code: couponCode,
        customer_email: customerEmail, redeem_loyalty_points: redeemLoyaltyPoints
      })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "POS transaction failed");
    return data;
  },

  async adminGetShifts(params = {}) {
    if (!live) return JSON.parse(localStorage.getItem("mock_shifts") || "[]").reverse();
    
    const qs = new URLSearchParams();
    if (params.page) qs.append("page", params.page);
    if (params.outlet_id && params.outlet_id !== "all") qs.append("outlet_id", params.outlet_id);
    if (params.start_date) qs.append("start_date", params.start_date);
    if (params.end_date) qs.append("end_date", params.end_date);
    
    const res = await fetch(`${API_BASE_URL}/admin/shifts?${qs.toString()}`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load timesheets");
    return safeJson(res);
  },

  async adminGetFinance() {
    if (!live) return { revenue_share: [] };
    const res = await fetch(`${API_BASE_URL}/admin/revenue-share`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load finance data");
    
    // The endpoint returns a list directly, but AdminView expects { revenue_share: [...] }
    const data = await safeJson(res);
    return { revenue_share: Array.isArray(data) ? data : [] };
  },

  async adminDeleteShift(shiftId) {
    if (!live) {
      let shifts = JSON.parse(localStorage.getItem("mock_shifts") || "[]");
      shifts = shifts.filter(s => s.id !== shiftId);
      localStorage.setItem("mock_shifts", JSON.stringify(shifts));
      return { message: "Shift record deleted" };
    }
    const res = await fetch(`${API_BASE_URL}/admin/shifts/${shiftId}`, {
      method: "DELETE", headers: getAuthHeader()
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to delete shift");
    return data;
  },

  // ----------------------------------------------------------------
  // Address Book API
  // ----------------------------------------------------------------
  async getAddresses() {
    if (!live) return JSON.parse(localStorage.getItem("customer_addresses") || "[]");
    const res = await fetch(`${API_BASE_URL}/auth/addresses`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load addresses");
    return safeJson(res);
  },
  async addAddress(title, address_line, is_default = false) {
    if (!live) {
      const addrs = JSON.parse(localStorage.getItem("customer_addresses") || "[]");
      const newAddr = { id: Date.now(), title, address_line, is_default };
      if (is_default) addrs.forEach(a => a.is_default = false);
      addrs.push(newAddr);
      localStorage.setItem("customer_addresses", JSON.stringify(addrs));
      return { address: newAddr };
    }
    const res = await fetch(`${API_BASE_URL}/auth/addresses`, {
      method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ title, address_line, is_default })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to add address");
    return data;
  },
  async deleteAddress(id) {
    if (!live) {
      const addrs = JSON.parse(localStorage.getItem("customer_addresses") || "[]").filter(a => a.id !== id);
      localStorage.setItem("customer_addresses", JSON.stringify(addrs));
      return { message: "Address deleted" };
    }
    const res = await fetch(`${API_BASE_URL}/auth/addresses/${id}`, { method: "DELETE", headers: getAuthHeader() });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to delete address");
    return data;
  },

  // ----------------------------------------------------------------
  // Favorites API
  // ----------------------------------------------------------------
  async getFavorites() {
    if (!live) return JSON.parse(localStorage.getItem("customer_favorites") || "[]");
    const res = await fetch(`${API_BASE_URL}/foods/favorites`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load favorites");
    return safeJson(res);
  },
  async addFavorite(menu_item_id) {
    if (!live) {
      const favs = JSON.parse(localStorage.getItem("customer_favorites") || "[]");
      if (!favs.some(f => f.menu_item_id === menu_item_id)) {
        favs.push({ id: Date.now(), menu_item_id, menu_item: { id: menu_item_id, name: "Offline Item" } });
        localStorage.setItem("customer_favorites", JSON.stringify(favs));
      }
      return { message: "Added to favorites" };
    }
    const res = await fetch(`${API_BASE_URL}/foods/favorites`, {
      method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ menu_item_id })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to add favorite");
    return data;
  },
  async removeFavorite(menu_item_id) {
    if (!live) {
      const favs = JSON.parse(localStorage.getItem("customer_favorites") || "[]").filter(f => f.menu_item_id !== menu_item_id);
      localStorage.setItem("customer_favorites", JSON.stringify(favs));
      return { message: "Removed from favorites" };
    }
    const res = await fetch(`${API_BASE_URL}/foods/favorites/${menu_item_id}`, { method: "DELETE", headers: getAuthHeader() });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to remove favorite");
    return data;
  },

  // ----------------------------------------------------------------
  // Kitchen API
  // ----------------------------------------------------------------
  async getKitchenOrders() {
    if (!live) {
      const orders = JSON.parse(localStorage.getItem("mock_orders") || "[]");
      return orders.filter(o => o.status === "pending" || o.status === "processing").sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }
    const res = await fetch(`${API_BASE_URL}/kitchen/orders`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load kitchen orders");
    return safeJson(res);
  },
  async updateKitchenOrderStatus(orderId, status) {
    if (!live) {
      const orders = JSON.parse(localStorage.getItem("mock_orders") || "[]");
      const order = orders.find(o => o.id === orderId);
      if (order) {
        order.status = status;
        localStorage.setItem("mock_orders", JSON.stringify(orders));
      }
      return { message: "Mock updated", order };
    }
    const res = await fetch(`${API_BASE_URL}/kitchen/orders/${orderId}/status`, {
      method: "PUT", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ status })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to update order status");
    return data;
  },
  async getStockRequests() {
    if (!live) {
      return JSON.parse(localStorage.getItem("mock_stock_requests") || "[]");
    }
    const res = await fetch(`${API_BASE_URL}/kitchen/stock-requests`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load stock requests");
    return safeJson(res);
  },
  async updateStockRequestStatus(id, status) {
    if (!live) {
      const reqs = JSON.parse(localStorage.getItem("mock_stock_requests") || "[]");
      const req = reqs.find(r => r.id === id);
      if (req) {
        req.status = status;
        localStorage.setItem("mock_stock_requests", JSON.stringify(reqs));
      }
      return { message: "Mock updated", stock_request: req };
    }
    const res = await fetch(`${API_BASE_URL}/kitchen/stock-requests/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ status })
    });
    return safeJson(res);
  },
  async createStockRequest(payload) {
    if (!live) {
      const reqs = JSON.parse(localStorage.getItem("mock_stock_requests") || "[]");
      const newReq = {
        id: reqs.length + 1,
        ...payload,
        status: "Pending",
        created_at: new Date().toISOString()
      };
      reqs.push(newReq);
      localStorage.setItem("mock_stock_requests", JSON.stringify(reqs));
      return { message: "Mock stock request created", stock_request: newReq };
    }
    const res = await fetch(`${API_BASE_URL}/kitchen/stock-requests`, {
      method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeader() }, body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to create stock request");
    return data;
  },
  async fulfillStockRequest(id) {
    if (!live) throw new Error("Mock backend does not support this feature");
    const res = await fetch(`${API_BASE_URL}/kitchen/stock-requests/${id}/fulfill`, {
      method: "PUT", headers: getAuthHeader()
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to fulfill stock request");
    return data;
  },
  async produceBatch(menu_item_id, quantity, expiry_date) {
    if (!live) {
      return { batch: { id: Date.now(), batch_number: "MOCK-" + Date.now(), menu_item_id, quantity_produced: quantity, expiry_date, qr_code_base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=" } };
    }
    const res = await fetch(`${API_BASE_URL}/kitchen/produce`, {
      method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ menu_item_id, quantity, expiry_date })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to produce batch");
    return data;
  },

  // --- New Admin CRM & Wallet Methods ---
  async adminCreditWallet(userId, amount, description) {
    const res = await fetch(`${API_BASE_URL}/admin/wallet/credit`, {
      method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ user_id: userId, amount, description })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to credit wallet");
    return data;
  },
  async adminDebitWallet(userId, amount, description) {
    const res = await fetch(`${API_BASE_URL}/admin/wallet/debit`, {
      method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ user_id: userId, amount, description })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to debit wallet");
    return data;
  },
  async adminGetWalletTransactions(userId) {
    const res = await fetch(`${API_BASE_URL}/admin/wallet/transactions/${userId}`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load wallet transactions");
    return safeJson(res);
  },
  async adminGetCustomerSegments() {
    if (!live) {
      return { all: [], frequent_buyers: [], high_value: [], inactive_30_days: [] };
    }
    const res = await fetch(`${API_BASE_URL}/admin/customers/segments`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load customer segments");
    return safeJson(res);
  },
  async adminSendBroadcast(segment, message, medium) {
    const res = await fetch(`${API_BASE_URL}/admin/broadcast`, {
      method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ segment, message, medium })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to send broadcast");
    return data;
  },

  // --- Banners & Store Settings ---
  async getPublicBanners() {
    const live = await checkBackendAlive(true);
    if (!live) return [];
    const res = await fetch(`${API_BASE_URL}/public/banners`);
    if (!res.ok) throw new Error("Failed to load banners");
    return safeJson(res);
  },
  async adminGetBanners() {
    const res = await fetch(`${API_BASE_URL}/admin/banners`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load banners");
    return safeJson(res);
  },
  async adminCreateBanner(payload) {
    const res = await fetch(`${API_BASE_URL}/admin/banners`, {
      method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to create banner");
    return data;
  },
  async adminUpdateBanner(id, payload) {
    const res = await fetch(`${API_BASE_URL}/admin/banners/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to update banner");
    return data;
  },
  async adminDeleteBanner(id) {
    const res = await fetch(`${API_BASE_URL}/admin/banners/${id}`, {
      method: "DELETE", headers: getAuthHeader()
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to delete banner");
    return data;
  },
  async getPublicStoreSettings() {
    const live = await checkBackendAlive(true);
    if (!live) return { is_store_online: "true" };
    const res = await fetch(`${API_BASE_URL}/public/store-settings`);
    if (!res.ok) throw new Error("Failed to load store settings");
    return safeJson(res);
  },
  async adminGetMarketPurchases() {
    if (!live) return [];

    const res = await fetch(`${API_BASE_URL}/admin/market-purchases`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load market purchases");
    return safeJson(res);
  },
  
  async adminAddMarketPurchase(payload) {
    if (!live) throw new Error("Market purchases requires live backend");

    const res = await fetch(`${API_BASE_URL}/admin/market-purchases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to add market purchase");
    return data;
  },

  async adminEditMarketPurchase(id, payload) {
    if (!live) throw new Error("Market purchases requires live backend");

    const res = await fetch(`${API_BASE_URL}/admin/market-purchases/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to update market purchase");
    return data;
  },

  async adminDeleteMarketPurchase(id) {
    if (!live) throw new Error("Market purchases requires live backend");

    const res = await fetch(`${API_BASE_URL}/admin/market-purchases/${id}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to delete market purchase");
    return data;
  },

  async adminGetStoreSettings() {
    if (!live) return { is_store_online: "true" };
    const res = await fetch(`${API_BASE_URL}/admin/store-settings`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load store settings");
    return safeJson(res);
  },
  async adminUpdateStoreSettings(payload) {
    const res = await fetch(`${API_BASE_URL}/admin/store-settings`, {
      method: "PUT", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to update store settings");
    return data;
  },

  // --- Ticketing ---
  async getCustomerTickets() {
    const res = await fetch(`${API_BASE_URL}/customer/tickets`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load tickets");
    return safeJson(res);
  },
  async createTicket(payload) {
    const res = await fetch(`${API_BASE_URL}/customer/tickets`, {
      method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to create ticket");
    return data;
  },
  async getForecast() {
    return _fetch('/api/admin/forecast');
  },
  async adminGetWhatsAppMessages() {
    return _fetch('/api/admin/whatsapp');
  },

  async adminGetTickets() {
    const res = await fetch(`${API_BASE_URL}/admin/tickets`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load tickets");
    return safeJson(res);
  },
  async adminReplyTicket(id, payload) {
    const res = await fetch(`${API_BASE_URL}/admin/tickets/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to update ticket");
    return data;
  },

  // --- Audit Logs ---
  async adminGetAuditLogs(page = 1, limit = 100) {
    const res = await fetch(`${API_BASE_URL}/admin/audit-logs?limit=${limit}`, { headers: getAuthHeader() });
    if (!res.ok) return { logs: [] };
    const data = await safeJson(res);
    return { logs: Array.isArray(data) ? data : (data.logs || []) };
  },

  // --- Revenue History & Reset ---
  async adminGetRevenueHistory() {
    const res = await fetch(`${API_BASE_URL}/admin/revenue/history`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load revenue history");
    return safeJson(res);
  },
  async adminResetRevenue(outlet_id) {
    const res = await fetch(`${API_BASE_URL}/admin/revenue/reset`, {
      method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ outlet_id })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to reset revenue");
    return data;
  },

  // --- Refunds ---
  async adminRefundOrder(orderId, payload) {
    const res = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/refund`, {
      method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to process refund");
    return data;
  },

  // --- Admin Profile ---
  async patchAdminProfile(payload) {
    const res = await fetch(`${API_BASE_URL}/admin/profile`, {
      method: "PATCH", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to update admin profile");
},

  // --- Banners & Store Settings ---
  async getPublicBanners() {
    const live = await checkBackendAlive(true);
    if (!live) return [];
    const res = await fetch(`${API_BASE_URL}/public/banners`);
    if (!res.ok) throw new Error("Failed to load banners");
    return safeJson(res);
  },
  async adminGetBanners() {
    const res = await fetch(`${API_BASE_URL}/admin/banners`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load banners");
    return safeJson(res);
  },
  async adminCreateBanner(payload) {
    const res = await fetch(`${API_BASE_URL}/admin/banners`, {
      method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to create banner");
    return data;
  },
  async adminUpdateBanner(id, payload) {
    const res = await fetch(`${API_BASE_URL}/admin/banners/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to update banner");
    return data;
  },
  async adminDeleteBanner(id) {
    const res = await fetch(`${API_BASE_URL}/admin/banners/${id}`, {
      method: "DELETE", headers: getAuthHeader()
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to delete banner");
    return data;
  },
  async getPublicStoreSettings() {
    const live = await checkBackendAlive(true);
    if (!live) return { is_store_online: "true" };
    const res = await fetch(`${API_BASE_URL}/public/store-settings`);
    if (!res.ok) throw new Error("Failed to load store settings");
    return safeJson(res);
  },
  async adminGetMarketPurchases() {
    if (!live) return [];

    const res = await fetch(`${API_BASE_URL}/admin/market-purchases`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load market purchases");
    return safeJson(res);
  },
  
  async adminAddMarketPurchase(payload) {
    if (!live) throw new Error("Market purchases requires live backend");

    const res = await fetch(`${API_BASE_URL}/admin/market-purchases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to add market purchase");
    return data;
  },

  async adminEditMarketPurchase(id, payload) {
    if (!live) throw new Error("Market purchases requires live backend");

    const res = await fetch(`${API_BASE_URL}/admin/market-purchases/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to update market purchase");
    return data;
  },

  async adminDeleteMarketPurchase(id) {
    if (!live) throw new Error("Market purchases requires live backend");

    const res = await fetch(`${API_BASE_URL}/admin/market-purchases/${id}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to delete market purchase");
    return data;
  },

  async adminGetStoreSettings() {
    if (!live) return { is_store_online: "true" };
    const res = await fetch(`${API_BASE_URL}/admin/store-settings`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load store settings");
    return safeJson(res);
  },
  async adminUpdateStoreSettings(payload) {
    const res = await fetch(`${API_BASE_URL}/admin/store-settings`, {
      method: "PUT", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to update store settings");
    return data;
  },

  // --- Ticketing ---
  async getCustomerTickets() {
    const res = await fetch(`${API_BASE_URL}/customer/tickets`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load tickets");
    return safeJson(res);
  },
  async createTicket(payload) {
    const res = await fetch(`${API_BASE_URL}/customer/tickets`, {
      method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to create ticket");
    return data;
  },
  async getForecast() {
    return _fetch('/api/admin/forecast');
  },
  async adminGetWhatsAppMessages() {
    return _fetch('/api/admin/whatsapp');
  },

  async adminGetTickets() {
    const res = await fetch(`${API_BASE_URL}/admin/tickets`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load tickets");
    return safeJson(res);
  },
  async adminReplyTicket(id, payload) {
    const res = await fetch(`${API_BASE_URL}/admin/tickets/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to update ticket");
    return data;
  },

  // --- Audit Logs ---
  async adminGetAuditLogs(page = 1, limit = 100) {
    const res = await fetch(`${API_BASE_URL}/admin/audit-logs?limit=${limit}`, { headers: getAuthHeader() });
    if (!res.ok) return { logs: [] };
    const data = await safeJson(res);
    return { logs: Array.isArray(data) ? data : (data.logs || []) };
  },

  // --- Revenue History & Reset ---
  async adminGetRevenueHistory() {
    const res = await fetch(`${API_BASE_URL}/admin/revenue/history`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load revenue history");
    return safeJson(res);
  },
  async adminResetRevenue(outlet_id) {
    const res = await fetch(`${API_BASE_URL}/admin/revenue/reset`, {
      method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ outlet_id })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to reset revenue");
    return data;
  },

  // --- Refunds ---
  async adminRefundOrder(orderId, payload) {
    const res = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/refund`, {
      method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to process refund");
    return data;
  },

  // --- Admin Profile ---
  async patchAdminProfile(payload) {
    const res = await fetch(`${API_BASE_URL}/admin/profile`, {
      method: "PATCH", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to update admin profile");
    return data;
  },

  // --- POS Fast-Switch ---
  async posUnlock(payload) {
    const res = await fetch(`${API_BASE_URL}/auth/pos/unlock`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Unlock failed");
    return data;
  },

  // --- Kitchen Active Orders ---
  async kitchenGetActiveOrders() {
    const res = await fetch(`${API_BASE_URL}/kitchen/active-orders`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load kitchen orders");
    return safeJson(res);
  },
  async kitchenUpdateOrderStatus(orderId, status) {
    const res = await fetch(`${API_BASE_URL}/kitchen/orders/${orderId}/status`, {
      method: "PUT", headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ status })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to update status");
    return data;
  },

  // --- System Data Reset ---
  async resetTestOrders() {
    const res = await fetch(`${API_BASE_URL}/admin/reset/orders`, { method: "POST", headers: getAuthHeader() });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to reset test orders");
    return data;
  },
  async resetReviews() {
    const res = await fetch(`${API_BASE_URL}/admin/reset/reviews`, { method: "POST", headers: getAuthHeader() });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to clear reviews");
    return data;
  },
  async resetStockLevels() {
    const res = await fetch(`${API_BASE_URL}/admin/reset/stock`, { method: "POST", headers: getAuthHeader() });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to reset stock levels");
    return data;
  },
  async resetTestCustomers() {
    const res = await fetch(`${API_BASE_URL}/admin/reset/customers`, { method: "POST", headers: getAuthHeader() });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to clear test customers");
    return data;
  }
};
