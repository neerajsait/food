// API client for communicating with the Flask backend.
// Implements a Mock Fallback Mode using localStorage if the backend is unreachable.

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
  
  if (res.status === 401 && typeof url === 'string' && url.includes(API_BASE_URL) && !url.includes('/api/auth/login') && !url.includes('/api/auth/refresh')) {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = originalFetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${refreshToken}` }
        }).then(async refreshRes => {
          isRefreshing = false;
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            localStorage.setItem("token", data.access_token);
            if (data.refresh_token) {
              localStorage.setItem("refresh_token", data.refresh_token);
            }
            return data.access_token;
          } else {
            localStorage.removeItem("token");
            localStorage.removeItem("refresh_token");
            window.location.href = "/login";
            throw new Error("Session expired");
          }
        }).catch(err => {
          isRefreshing = false;
          localStorage.removeItem("token");
          localStorage.removeItem("refresh_token");
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
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
  }
  
  return res;
};

// Helper to retrieve auth tokens
function getAuthHeader() {
  const token = localStorage.getItem("token");
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
  return true; // Forced Real Mode
}

// ----------------------------------------------------------------
// Mock Database Initialization & State Helpers (Indian Localized)
// ----------------------------------------------------------------
const INITIAL_OUTLETS = [
  {
    id: 1,
    name: "Outlet 1: Connaught Place Corner",
    address: "Connaught Place, New Delhi",
    current_stock: 50,
    needs_restock: false,
    latitude: 28.6304,
    longitude: 77.2177,
    owner_id: 4,
    items: [
      { id: 1, outlet_id: 1, menu_item_id: 103, menu_item_name: "Crispy Samosa (Snack Supply)", menu_item_price: 20.00, current_stock: 50, restock_limit: 10, needs_restock: false },
      { id: 2, outlet_id: 1, menu_item_id: 105, menu_item_name: "Cold Lemon Iced Tea", menu_item_price: 40.00, current_stock: 30, restock_limit: 10, needs_restock: false }
    ]
  },
  {
    id: 2,
    name: "Outlet 2: Vashi Express Supply",
    address: "Vashi, Navi Mumbai",
    current_stock: 22,
    needs_restock: false,
    latitude: 19.0748,
    longitude: 73.0011,
    owner_id: 4,
    items: [
      { id: 3, outlet_id: 2, menu_item_id: 104, menu_item_name: "Paneer Spring Rolls", menu_item_price: 60.00, current_stock: 22, restock_limit: 10, needs_restock: false }
    ]
  },
  {
    id: 3,
    name: "Outlet 3: Indiranagar Stall",
    address: "Indiranagar, Bengaluru",
    current_stock: 8,
    needs_restock: true,
    latitude: 12.9719,
    longitude: 77.6412,
    owner_id: null,
    items: [
      { id: 4, outlet_id: 3, menu_item_id: 103, menu_item_name: "Crispy Samosa (Snack Supply)", menu_item_price: 20.00, current_stock: 8, restock_limit: 10, needs_restock: true }
    ]
  }
];

const INITIAL_MENU_ITEMS = [
  // --- Spice Powders (Podis) ---
  { id: 1, name: "Kobbari Karam 250g", description: "Homemade Kobbari Karam â€” rich coconut spice powder made from fresh coconut and red chillies.", price: 200.00, original_price: 220.00, category: "Spice Powders", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=200&q=80" },
  { id: 2, name: "Pappula Podi 250g", description: "Homemade Pappula Podi â€” traditional lentil spice powder for rice and idli.", price: 159.00, original_price: 179.00, category: "Spice Powders", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=200&q=80" },
  { id: 3, name: "Karvepaku Karram 250g", description: "Karivepaku Karam â€” authentic curry leaf spice powder with a pungent aroma.", price: 159.00, original_price: 179.00, category: "Spice Powders", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1599909613253-f3b3a5f7b33f?w=200&q=80" },
  { id: 4, name: "Nuvvula Podi 250g", description: "Nuvvula Podi (Roasted Sesame Powder) â€” nutrient-rich sesame spice blend.", price: 169.00, original_price: 185.00, category: "Spice Powders", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=200&q=80" },
  { id: 5, name: "Munagaku Podi 250g", description: "Suggula's Kitchen Munagaku Podi â€” drumstick leaves powder packed with nutrients.", price: 160.00, original_price: 180.00, category: "Spice Powders", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1583394293214-0b3f8ed6e0ab?w=200&q=80" },
  { id: 6, name: "Kandi Podi 250g", description: "à°¸à°¾à°‚à°ªà±à°°à°¦à°¾à°¯ à°°à±à°šà°¿à°•à°¿ à°…à°¸à°²à±ˆà°¨ à°•à°‚à°¦à°¿à°ªà°ªà±à°ªà± à°ªà±Šà°¡à°¿ â€” traditional toor dal spice powder.", price: 179.00, original_price: 199.00, category: "Spice Powders", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=200&q=80" },
  { id: 7, name: "Curry Leaves Herbal Powder 250g", description: "Curry Leaves Herbal Powder â€” natural health supplement and flavour enhancer.", price: 289.00, original_price: 320.00, category: "Spice Powders", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1591189824344-d7e6c2440e4a?w=200&q=80" },
  { id: 8, name: "Andhra Nallakaram Podi 250g", description: "Experience the authentic Andhra Nallakaram podi â€” fiery and aromatic.", price: 140.00, original_price: 160.00, category: "Spice Powders", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=200&q=80" },
  { id: 9, name: "Andhra Koora Karam 250g", description: "à°…à°®à±à°® à°šà±‡à°¤à°¿ à°•à±‚à°° à°•à°¾à°°à°‚ â€” the special Andhra vegetable spice blend.", price: 120.00, original_price: 140.00, category: "Spice Powders", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=200&q=80" },
  { id: 10, name: "Pallila Karam 250g", description: "à°¨à°¾à°¨à±à°¨à±‡à°®à±ˆà°¨ à°µà±‡à°°à±à°¸à±‡à°¨à°—à°²à±, à°¸à°‚... â€” peanut-based Andhra spice powder.", price: 180.00, original_price: 200.00, category: "Spice Powders", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1599909613253-f3b3a5f7b33f?w=200&q=80" },

  // --- Pickles (Pachallu) ---
  { id: 11, name: "Pandu Mirchi Gongura 250g", description: "Traditional Andhra Pandu Mirchi Gongura pickle â€” tangy red chilli sorrel blend.", price: 199.00, original_price: 220.00, category: "Pickles", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1567982047351-76b6f93e38ee?w=200&q=80" },
  { id: 12, name: "Pandumirchi Tamota Pickle 250g", description: "Traditional Andhra Pandumirchi Tomato pickle â€” a classic tangy combination.", price: 199.00, original_price: 220.00, category: "Pickles", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1567982047351-76b6f93e38ee?w=200&q=80" },
  { id: 13, name: "Allam Pandumirchi Pickle 250g", description: "Traditional Andhra Allam Chilli pickle â€” spicy ginger and chilli blend.", price: 199.00, original_price: 220.00, category: "Pickles", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1589916836867-5208c1f74e23?w=200&q=80" },
  { id: 14, name: "Pandu Mirchi Pickle 250g", description: "à°ªà°‚à°¡à°¿à°¨ à°Žà°°à±à°° à°®à°¿à°°à±à°šà°¿à°¤à±‹, à°¨à°¾à°¨à±à°šà±... â€” slow-fermented red chilli pickle.", price: 229.00, original_price: 245.00, category: "Pickles", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1567982047351-76b6f93e38ee?w=200&q=80" },
  { id: 15, name: "Kothimera Pickle 250g", description: "à°¤à°¾à°œà°¾ à°•à±Šà°¤à±à°¤à°¿à°®à±‡à°° à°¸à±à°µà°¾à°¸... â€” fresh coriander leaves pickle.", price: 189.00, original_price: 199.00, category: "Pickles", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1589916836867-5208c1f74e23?w=200&q=80" },
  { id: 16, name: "Classic Avakaya 250g", description: "à°…à°¸à°²à±ˆà°¨ à°†à°‚à°§à±à°° à°†à°µà°•à°¾à°¯... â€” the king of Andhra pickles, raw mango.", price: 299.00, original_price: 320.00, category: "Pickles", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1567982047351-76b6f93e38ee?w=200&q=80" },

  // --- Snacks & Savories ---
  { id: 17, name: "Challa Chakralu 250g", description: "Traditional Challa Chakralu â€” crispy butter rice rings, a timeless Andhra snack.", price: 120.00, original_price: 140.00, category: "Snacks & Savories", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80" },
  { id: 18, name: "Rice Vadiyalu 250g", description: "à°¸à°¾à°‚à°ªà±à°°à°¦à°¾à°¯ à°†à°‚à°§à±à°° à°°à±à°šà°¿à°¤à±‹... â€” traditional sun-dried rice crackers.", price: 120.00, original_price: 140.00, category: "Snacks & Savories", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80" },
  { id: 19, name: "Chekkarala Vadiyalu 250g", description: "à°…à°®à±à°® à°šà±‡à°¤à°¿ à°°à±à°šà°¿à°¤à±‹, à°¸à°¾à°‚à°ªà±à°°à°¦à°¾... â€” handmade chekkarala vadiyalu.", price: 150.00, original_price: 160.00, category: "Snacks & Savories", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80" },
  { id: 20, name: "Sagubiyam Vadiyalu 250g", description: "à°Žà°‚à°¡à°²à±‹ à°¸à°¹à°œà°‚à°—à°¾ à°†à°°à°¬à±†à°Ÿà±à°Ÿà°¿... â€” sago sun-dried crackers.", price: 120.00, original_price: 140.00, category: "Snacks & Savories", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80" },
  { id: 21, name: "Bellam Gavvalu 250g", description: "Fresh & Crunchy Bellam Gavvalu â€” sweet jaggery shells, a traditional treat.", price: 195.00, original_price: 220.00, category: "Snacks & Savories", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80" },
  { id: 22, name: "Karram Gavvalu 250g", description: "Karam Gavvalu â€” spicy shell-shaped crispy snack from Andhra.", price: 159.00, original_price: 180.00, category: "Snacks & Savories", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80" },

  // --- Sweets & Treats ---
  { id: 23, name: "Palli Patti 250g", description: "Peanut Chikki / Palli Patti â€” crunchy peanut brittle with jaggery.", price: 169.00, original_price: 189.00, category: "Sweets & Treats", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=200&q=80" },
  { id: 24, name: "Pala Penilu 250g", description: "Experience the authentic taste of Pala Penilu â€” milk-based traditional sweet.", price: 249.00, original_price: 269.00, category: "Sweets & Treats", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=200&q=80" },
  { id: 25, name: "Royal Honey Cashew 250g", description: "Every bite is rich, crunchy, and coated in pure honey â€” premium cashew delight.", price: 319.00, original_price: 340.00, category: "Sweets & Treats", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=200&q=80" },
  { id: 26, name: "Gondhu Laddu 250g", description: "à°ˆ à°—à±Šà°‚à°§à± (à°•à±ƒà°«à±à°²à±) à°¨à±†à°¯à±à°¯à°¿à°²à±‹... â€” traditional Gondhu Laddu with pure ghee.", price: 319.00, original_price: 340.00, category: "Sweets & Treats", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=200&q=80" },
  { id: 27, name: "Suggula's Kitchen Sweet 250g", description: "Suggula's Kitchen Sweet & Special â€” traditional handmade sweet boxes.", price: 369.00, original_price: 408.00, category: "Sweets & Treats", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=200&q=80" },

  // --- Mixes & Instant ---
  { id: 28, name: "Instant Rasam Mix 250g", description: "Instant Rasam Mix â€” Bring the warmth of homemade rasam to your table instantly.", price: 140.00, original_price: 160.00, category: "Mixes & Instant", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200&q=80" },
  { id: 29, name: "Karram Charu Mix 250g", description: "Karam Charu Mix (Instant Rasam Powder) â€” spicy pepper rasam mix.", price: 165.00, original_price: 195.00, category: "Mixes & Instant", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200&q=80" },
  { id: 30, name: "Chinthapandu Pulihora Mix 250g", description: "Chinthapandu Pulihora Mix â€” tamarind rice spice blend for perfect pulihora.", price: 165.00, original_price: 185.00, category: "Mixes & Instant", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200&q=80" },
  { id: 31, name: "Instant Gravy Mix 250g", description: "à°°à±†à°¸à±à°¤à°¾à°°à±†à°‚à°Ÿà± à°¸à±à°Ÿà±ˆà°²à± à°•à°°à±à°°à±€... â€” restaurant-style instant curry gravy mix.", price: 149.00, original_price: 199.00, category: "Mixes & Instant", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200&q=80" },

  // --- Special Products ---
  { id: 32, name: "Suggula's Kitchen Traditional 250g", description: "Suggula's Kitchen Traditional â€” handcrafted special recipe from grandma's kitchen.", price: 349.00, original_price: 360.00, category: "Special Products", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1606914501449-5a96b6ce24ca?w=200&q=80" },
  { id: 33, name: "Ashadam Special Neeyi Annam Podi 250g", description: "Neeyi Annam Podi Ashadam Special â€” pure ghee rice powder for festive occasions.", price: 449.00, original_price: 499.00, category: "Special Products", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1606914501449-5a96b6ce24ca?w=200&q=80" },
  { id: 34, name: "Saddu Baby Bottu 5g", description: "Saddu Baby Bottu â€” traditional herbal bottu for infants, a heritage product.", price: 99.00, original_price: 109.00, category: "Special Products", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1606914501449-5a96b6ce24ca?w=200&q=80" },
  { id: 35, name: "Herbal Sunnipindi 250g", description: "Sunni Pindi Herbal Bath Powder â€” natural herbal body cleansing powder.", price: 299.00, original_price: 320.00, category: "Special Products", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1606914501449-5a96b6ce24ca?w=200&q=80" },
  { id: 36, name: "Snack Supply Samosa 250g", description: "Crisp pastry filled with spiced potatoes and peas â€” B2B2C snack supply.", price: 20.00, original_price: 25.00, category: "Snacks & Savories", business_type: "snack_supply", is_active: true, image_url: "https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80" },
];

function initMockDB() {
  // Always reset mock_menu to ensure new catalog items are picked up
  localStorage.setItem("mock_outlets", JSON.stringify(INITIAL_OUTLETS));
  localStorage.setItem("mock_menu", JSON.stringify(INITIAL_MENU_ITEMS));
  if (!localStorage.getItem("mock_users")) {
    localStorage.setItem("mock_users", JSON.stringify([
      { id: 1, email: "admin", role: "admin", first_name: "John", last_name: "Admin" },
      { id: 2, email: "customer@gmail.com", role: "customer", first_name: "Sarah", last_name: "Customer",
        loyalty_points: 250, referral_code: "SARAH2024", referral_count: 1,
        loyalty_history: [
          { id: 1, type: "earned", points: 150, desc: "Order #1001", date: new Date(Date.now() - 7*24*3600000).toISOString() },
          { id: 2, type: "earned", points: 100, desc: "Referral bonus (friend joined)", date: new Date(Date.now() - 2*24*3600000).toISOString() }
        ]
      },
      { id: 3, email: "staff@brand.com", role: "staff", outlet_id: 1, first_name: "Alex", last_name: "Staff", staff_code: "1001", password: "staff123" },
      { id: 4, email: "owner@brand.com", role: "outlet_owner", first_name: "Rajesh", last_name: "Owner" },
      { id: 5, email: "kitchen@brand.com", role: "kitchen", outlet_id: 1, first_name: "Priya", last_name: "Kitchen", staff_code: "2001", password: "kitchen123" }
    ]));
  } else {
    // Migrate existing users: ensure staff/kitchen have staff_code
    const users = JSON.parse(localStorage.getItem("mock_users"));
    let changed = false;
    const existingCodes = new Set(users.map(u => u.staff_code).filter(Boolean));
    users.forEach(u => {
      if ((u.role === "staff" || u.role === "kitchen") && !u.staff_code) {
        let code;
        do { code = String(Math.floor(1000 + Math.random() * 9000)); } while (existingCodes.has(code));
        existingCodes.add(code);
        u.staff_code = code;
        changed = true;
      }
      if (u.role === "customer" && !u.referral_code) {
        u.referral_code = (u.first_name || "USER").toUpperCase().replace(/[^A-Z]/g,"").slice(0,6) + u.id;
        u.loyalty_history = u.loyalty_history || [];
        u.referral_count = u.referral_count || 0;
        changed = true;
      }
    });
    if (changed) localStorage.setItem("mock_users", JSON.stringify(users));
  }
  if (!localStorage.getItem("mock_orders")) {
    localStorage.setItem("mock_orders", JSON.stringify([]));
  }
  if (!localStorage.getItem("mock_feedbacks")) {
    localStorage.setItem("mock_feedbacks", JSON.stringify([]));
  }
  if (!localStorage.getItem("mock_sales")) {
    localStorage.setItem("mock_sales", JSON.stringify([]));
  }
  if (!localStorage.getItem("mock_menu_item_reviews")) {
    localStorage.setItem("mock_menu_item_reviews", JSON.stringify([
      { id: 1, menu_item_id: 1, menu_item_name: "Kobbari Karam 250g", customer_id: 2, customer_name: "Sarah Customer", rating: 5, comment: "Absolutely delicious and traditional taste! Highly recommend.", created_at: new Date().toISOString() },
      { id: 2, menu_item_id: 1, menu_item_name: "Kobbari Karam 250g", customer_id: 2, customer_name: "Sarah Customer", rating: 4, comment: "Very fresh and fragrant, spice level is perfect.", created_at: new Date().toISOString() }
    ]));
  }
  if (!localStorage.getItem("mock_audit_logs")) {
    localStorage.setItem("mock_audit_logs", JSON.stringify([
      { id: 1, created_at: new Date().toISOString(), outlet_name: "Outlet 1: Connaught Place Corner", menu_item_name: "Crispy Samosa (Snack Supply)", change_qty: -5, change_type: "waste", stock_before: 20, stock_after: 15, notes: "Disposal: Damaged in storage" }
    ]));
  }
  if (!localStorage.getItem("mock_coupons")) {
    localStorage.setItem("mock_coupons", JSON.stringify([
      { id: 1, code: "WELCOME10", discount_pct: 10, is_active: true },
      { id: 2, code: "FESTIVE20", discount_pct: 20, is_active: true },
      { id: 3, code: "HALFOFF", discount_pct: 50, is_active: true }
    ]));
  }
}

initMockDB();

// Mock API implementations for fallback mode
const mockApi = {
  async register(email, password, role, first_name, last_name, phone, outlet_id, referral_code) {
    const tempDomains = ["temp-mail.org", "10minutemail.com", "guerrillamail.com", "mailinator.com"];
    const domain = email.includes("@") ? email.split("@")[1].toLowerCase() : "";
    if (tempDomains.includes(domain) || domain.includes("temp")) {
      throw new Error("This was caused due to temp mail use personal mail");
    }

    const users = JSON.parse(localStorage.getItem("mock_users"));
    if (users.find(u => u.email === email)) {
      throw new Error("Email already registered");
    }
    const newId = Date.now();

    // Generate unique referral code for new customer
    let myReferralCode = null;
    if (role === "customer") {
      const baseName = (first_name || "USER").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
      myReferralCode = baseName + newId.toString().slice(-4);
    }

    const user = { id: newId, email, role, first_name, last_name, phone, outlet_id,
      loyalty_points: 0, referral_code: myReferralCode, referral_count: 0, loyalty_history: [] };

    // If a referral code was used, credit referrer and new user
    if (referral_code && role === "customer") {
      const referrer = users.find(u => u.referral_code === referral_code && u.role === "customer");
      if (referrer) {
        referrer.loyalty_points = (referrer.loyalty_points || 0) + 100;
        referrer.referral_count = (referrer.referral_count || 0) + 1;
        referrer.loyalty_history = referrer.loyalty_history || [];
        referrer.loyalty_history.unshift({ id: Date.now(), type: "earned", points: 100,
          desc: `Referral bonus (${first_name || email} joined!)`, date: new Date().toISOString() });
        user.loyalty_points = 50; // welcome bonus for new user
        user.loyalty_history = [{ id: Date.now() + 1, type: "earned", points: 50,
          desc: "Welcome bonus (joined via referral)", date: new Date().toISOString() }];
      }
    }

    users.push(user);
    localStorage.setItem("mock_users", JSON.stringify(users));
    return { message: "Registration successful", user };
  },

  async login(emailOrCode, _password) {
    const users = JSON.parse(localStorage.getItem("mock_users"));
    // Allow staff/kitchen to login with staff_code
    let user = users.find(u => u.email === emailOrCode);
    if (!user) {
      // Try staff_code match for staff/kitchen roles
      user = users.find(u => u.staff_code === emailOrCode && (u.role === "staff" || u.role === "kitchen"));
    }
    if (!user) {
      throw new Error("Invalid credentials");
    }
    const token = btoa(JSON.stringify({ id: user.id, email: user.email, role: user.role, outlet_id: user.outlet_id }));
    return { access_token: token, user };
  },

  async getFoodsMenu() {
    const live = await checkBackendAlive();
    if (!live) {
      const menu = JSON.parse(localStorage.getItem("mock_menu") || "[]");
      const reviews = JSON.parse(localStorage.getItem("mock_menu_item_reviews") || "[]");
      return menu
        .filter(item => (item.business_type === "home_foods" || item.business_type === "both") && item.is_active)
        .map(item => {
          const itemReviews = reviews.filter(r => r.menu_item_id === item.id);
          const avg = itemReviews.length ? parseFloat((itemReviews.reduce((sum, r) => sum + r.rating, 0) / itemReviews.length).toFixed(1)) : 0.0;
          return {
            ...item,
            average_rating: avg,
            reviews_count: itemReviews.length
          };
        });
    }

    const res = await fetch(`${API_BASE_URL}/foods/menu`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load menu");
    return safeJson(res);
  },

  async placeOrder(userId, itemsData, deliveryAddress, paymentMethod = "COD", couponCode = null, pointsToRedeem = 0, deliveryCharge = 0) {
    const menu = JSON.parse(localStorage.getItem("mock_menu"));
    const orders = JSON.parse(localStorage.getItem("mock_orders"));

    let total = 0;
    const items = itemsData.map(it => {
      const menuItem = menu.find(m => m.id === it.menu_item_id);
      if (!menuItem) throw new Error("Item not found");

      if (menuItem.global_stock !== null && menuItem.global_stock !== undefined) {
        if (menuItem.global_stock < it.quantity) {
          throw new Error(`Item '${menuItem.name}' is out of stock (only ${menuItem.global_stock} left)`);
        }
        menuItem.global_stock -= it.quantity;
      }

      total += menuItem.price * it.quantity;
      return {
        id: Math.random(),
        menu_item_id: menuItem.id,
        menu_item_name: menuItem.name,
        quantity: it.quantity,
        price: menuItem.price
      };
    });
    
    total += deliveryCharge;

    // Save updated menu to persist mock stock decrements
    localStorage.setItem("mock_menu", JSON.stringify(menu));

    if (couponCode) {
      const coupons = JSON.parse(localStorage.getItem("mock_coupons") || "[]");
      const coupon = coupons.find(c => c.code === couponCode.toUpperCase().trim() && c.is_active);
      if (coupon) {
        if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
          throw new Error("Coupon has expired");
        }
        if (coupon.usage_limit && (coupon.usage_count || 0) >= coupon.usage_limit) {
          throw new Error("Coupon usage limit reached");
        }
        if (coupon.discount_amount) {
          total = Math.max(0, total - coupon.discount_amount);
        } else if (coupon.discount_pct) {
          let discountValue = total * (coupon.discount_pct / 100);
          if (coupon.max_discount_amount && discountValue > coupon.max_discount_amount) {
            discountValue = coupon.max_discount_amount;
          }
          total = Math.max(0, total - discountValue);
        }
        coupon.usage_count = (coupon.usage_count || 0) + 1;
        localStorage.setItem("mock_coupons", JSON.stringify(coupons));
      }
    }

    const newOrder = {
      id: orders.length + 1000,
      customer_id: parseInt(userId),
      customer_email: "customer@gmail.com",
      status: "pending",
      total_price: total,
      tracking_code: null,
      tracking_link: null,
      is_received: false,
      feedback_submitted: false,
      delivery_address: deliveryAddress || "",
      payment_method: paymentMethod,
      items,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      delivery_charge: deliveryCharge,
      loyalty_points_earned: Math.floor(total * 0.1),
      loyalty_points_redeemed: pointsToRedeem,
      review_code: "MOCK" + Math.floor(Math.random() * 1000)
    };

    orders.push(newOrder);
    localStorage.setItem("mock_orders", JSON.stringify(orders));

    // Update customer loyalty points in mock_users
    const users = JSON.parse(localStorage.getItem("mock_users") || "[]");
    const customerUser = users.find(u => u.id === parseInt(userId));
    if (customerUser) {
      const pointsEarned = Math.floor(total * 0.1); // earn 10% of order as points
      customerUser.loyalty_points = Math.max(0, (customerUser.loyalty_points || 0) - pointsToRedeem) + pointsEarned;
      customerUser.loyalty_history = customerUser.loyalty_history || [];
      if (pointsToRedeem > 0) {
        customerUser.loyalty_history.unshift({ id: Date.now(), type: "redeemed", points: -pointsToRedeem, desc: `Redeemed on order #${newOrder.id}`, date: new Date().toISOString() });
      }
      if (pointsEarned > 0) {
        customerUser.loyalty_history.unshift({ id: Date.now() + 1, type: "earned", points: pointsEarned, desc: `Order #${newOrder.id} reward`, date: new Date().toISOString() });
      }
      localStorage.setItem("mock_users", JSON.stringify(users));
      // Update local user cache
      const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (currentUser.id === parseInt(userId)) {
        currentUser.loyalty_points = customerUser.loyalty_points;
        currentUser.loyalty_history = customerUser.loyalty_history;
        localStorage.setItem("user", JSON.stringify(currentUser));
      }
    }

    return { message: "Order placed successfully", order: newOrder };
  },

  async getOrderHistory(userId) {
    const orders = JSON.parse(localStorage.getItem("mock_orders"));
    return orders.filter(o => o.customer_id === parseInt(userId)).reverse();
  },

  async cancelOrder(orderId) {
    const orders = JSON.parse(localStorage.getItem("mock_orders"));
    const orderIdx = orders.findIndex(o => o.id === orderId);
    if (orderIdx === -1) throw new Error("Order not found");
    if (!["pending", "processing"].includes(orders[orderIdx].status)) {
      throw new Error("Order cannot be cancelled");
    }
    orders[orderIdx].status = "cancelled";
    orders[orderIdx].cancel_reason = "Cancelled by customer";
    localStorage.setItem("mock_orders", JSON.stringify(orders));
    return { message: "Order cancelled successfully" };
  },

  async confirmReceipt(userId, orderId, trackingCode) {
    const orders = JSON.parse(localStorage.getItem("mock_orders"));
    const order = orders.find(o => o.id === parseInt(orderId));
    if (!order) throw new Error("Order not found");
    if (!order.tracking_code) throw new Error("Order has not been shipped yet");
    if (order.tracking_code.trim() !== trackingCode.trim()) {
      throw new Error("Invalid tracking code supplied");
    }
    order.is_received = true;
    order.status = "delivered";
    order.updated_at = new Date().toISOString();
    localStorage.setItem("mock_orders", JSON.stringify(orders));
    return { message: "Delivery confirmed. Feedback unlocked.", order };
  },

  async submitFeedback(userId, orderId, rating, comment) {
    const orders = JSON.parse(localStorage.getItem("mock_orders"));
    const order = orders.find(o => o.id === parseInt(orderId));
    if (!order) throw new Error("Order not found");
    if (!order.is_received) throw new Error("Feedback locked until tracking code is validated");
    if (order.feedback_submitted) throw new Error("Feedback already submitted");

    const feedbacks = JSON.parse(localStorage.getItem("mock_feedbacks"));
    const newFeedback = {
      id: feedbacks.length + 1,
      order_id: parseInt(orderId),
      customer_id: parseInt(userId),
      rating,
      comment,
      created_at: new Date().toISOString()
    };
    feedbacks.push(newFeedback);
    order.feedback_submitted = true;

    localStorage.setItem("mock_feedbacks", JSON.stringify(feedbacks));
    localStorage.setItem("mock_orders", JSON.stringify(orders));
    return { message: "Feedback submitted successfully", feedback: newFeedback };
  },

  async getPOSMenu(outletId) {
    // Return items assigned to this outlet with stock info
    const outlets = JSON.parse(localStorage.getItem("mock_outlets"));
    const outlet = outlets.find(o => o.id === parseInt(outletId));
    if (!outlet) return [];
    return (outlet.items || []).map(item => ({
      id: item.menu_item_id,
      name: item.menu_item_name,
      price: item.menu_item_price,
      current_stock: item.current_stock,
      restock_limit: item.restock_limit,
      needs_restock: item.needs_restock
    }));
  },

  async posSell(userId, outletId, itemsData, paymentMethod, couponCode = null) {
    const outlets = JSON.parse(localStorage.getItem("mock_outlets"));
    const sales = JSON.parse(localStorage.getItem("mock_sales"));

    const outlet = outlets.find(o => o.id === parseInt(outletId));
    if (!outlet) throw new Error("Outlet not found");

    let totalAmount = 0;
    const items = itemsData.map(it => {
      const stockItem = (outlet.items || []).find(s => s.menu_item_id === it.menu_item_id);
      if (!stockItem) throw new Error(`Item ${it.menu_item_id} not assigned to outlet`);
      if (stockItem.current_stock < it.quantity) {
        throw new Error(`Insufficient stock for ${stockItem.menu_item_name}. Available: ${stockItem.current_stock}`);
      }
      stockItem.current_stock -= it.quantity;
      stockItem.needs_restock = stockItem.current_stock <= stockItem.restock_limit;
      totalAmount += stockItem.menu_item_price * it.quantity;
      return {
        id: Math.random(),
        menu_item_id: stockItem.menu_item_id,
        menu_item_name: stockItem.menu_item_name,
        quantity: it.quantity,
        price: stockItem.menu_item_price
      };
    });

    if (couponCode) {
      const coupons = JSON.parse(localStorage.getItem("mock_coupons") || "[]");
      const coupon = coupons.find(c => c.code === couponCode.toUpperCase().trim() && c.is_active);
      if (coupon) {
        if (coupon.discount_amount) {
          totalAmount = Math.max(0, totalAmount - coupon.discount_amount);
        } else if (coupon.discount_pct) {
          let discountValue = totalAmount * (coupon.discount_pct / 100);
          if (coupon.max_discount_amount && discountValue > coupon.max_discount_amount) {
            discountValue = coupon.max_discount_amount;
          }
          totalAmount = Math.max(0, totalAmount - discountValue);
        }
      }
    }

    // Recompute outlet totals
    outlet.current_stock = (outlet.items || []).reduce((sum, s) => sum + s.current_stock, 0);
    outlet.needs_restock = (outlet.items || []).some(s => s.needs_restock);

    const newSale = {
      id: sales.length + 500,
      outlet_id: outlet.id,
      outlet_name: outlet.name,
      staff_id: parseInt(userId),
      total_amount: totalAmount,
      payment_method: paymentMethod,
      items,
      created_at: new Date().toISOString()
    };

    sales.push(newSale);
    localStorage.setItem("mock_outlets", JSON.stringify(outlets));
    localStorage.setItem("mock_sales", JSON.stringify(sales));

    return {
      message: "POS Sale completed successfully",
      sale: newSale,
      remaining_stock: outlet.current_stock,
      restock_alert: outlet.needs_restock
    };
  },

  async adminGetOrders() {
    return JSON.parse(localStorage.getItem("mock_orders")).reverse();
  },

  async adminShipOrder(orderId, trackingCode, trackingLabel = null, trackingLink = null) {
    const orders = JSON.parse(localStorage.getItem("mock_orders"));
    const order = orders.find(o => o.id === parseInt(orderId));
    if (!order) throw new Error("Order not found");
    order.status = "shipped";
    order.tracking_code = trackingCode.trim();
    if (trackingLabel) {
      order.tracking_label = trackingLabel;
    }
    if (trackingLink) {
      order.tracking_link = trackingLink;
    }
    order.updated_at = new Date().toISOString();
    localStorage.setItem("mock_orders", JSON.stringify(orders));
    return { message: "Order shipped successfully", order };
  },

  async adminGetOutlets() {
    return JSON.parse(localStorage.getItem("mock_outlets"));
  },

  async adminUpdateOutlet(outletId, data) {
    const outlets = JSON.parse(localStorage.getItem("mock_outlets"));
    const outlet = outlets.find(o => o.id === parseInt(outletId));
    if (!outlet) throw new Error("Outlet not found");
    if (data.name !== undefined) outlet.name = data.name;
    if (data.address !== undefined) outlet.address = data.address;
    if (data.latitude !== undefined) outlet.latitude = data.latitude;
    if (data.longitude !== undefined) outlet.longitude = data.longitude;
    if (data.revenue_share_percentage !== undefined) outlet.revenue_share_percentage = parseFloat(data.revenue_share_percentage);
    localStorage.setItem("mock_outlets", JSON.stringify(outlets));
    return { message: "Outlet updated successfully", outlet };
  },

  async adminAddMenuItem(data) {
    const menu = JSON.parse(localStorage.getItem("mock_menu"));

    // Check if item with same name exists (case-insensitive)
    const existing = menu.find(m => m.name.toLowerCase() === (data.name || "").toLowerCase());
    if (existing) {
      existing.price = parseFloat(data.price);
      existing.business_type = data.business_type || existing.business_type;
      existing.description = data.description || existing.description;
      existing.category = data.category || existing.category;
      existing.image_url = data.image_url || existing.image_url;
      if (data.code) existing.code = data.code.trim();
      existing.is_active = true;
      localStorage.setItem("mock_menu", JSON.stringify(menu));
      return { message: "Existing item reactivated", item: existing };
    }

    // Use provided code or generate a unique 4-digit code
    const existingCodes = new Set(menu.map(m => m.code).filter(Boolean));
    let code = data.code ? data.code.trim() : "";
    if (!code) {
      do {
        code = String(Math.floor(1000 + Math.random() * 9000));
      } while (existingCodes.has(code));
    }

    const newItem = {
      id: Date.now(),
      code,
      name: data.name,
      description: data.description,
      price: parseFloat(data.price),
      original_price: data.original_price ? parseFloat(data.original_price) : null,
      category: data.category || "Other",
      business_type: data.business_type,
      image_url: data.image_url || null,
      is_active: true,
      average_rating: 0,
      reviews_count: 0
    };
    menu.push(newItem);
    localStorage.setItem("mock_menu", JSON.stringify(menu));
    return { message: "Menu item added successfully", item: newItem };
  },

  async adminAssignItemToOutlet(outletId, menuItemId, currentStock, restockLimit) {
    const outlets = JSON.parse(localStorage.getItem("mock_outlets"));
    const menu = JSON.parse(localStorage.getItem("mock_menu"));
    const outlet = outlets.find(o => o.id === parseInt(outletId));
    if (!outlet) throw new Error("Outlet not found");
    const menuItem = menu.find(m => m.id === parseInt(menuItemId));
    if (!outlet.items) outlet.items = [];
    const existing = outlet.items.find(i => i.menu_item_id === parseInt(menuItemId));
    if (existing) {
      existing.current_stock = parseInt(currentStock);
      existing.restock_limit = parseInt(restockLimit);
      existing.needs_restock = parseInt(currentStock) <= parseInt(restockLimit);
    } else {
      outlet.items.push({
        id: Date.now(),
        outlet_id: parseInt(outletId),
        menu_item_id: parseInt(menuItemId),
        menu_item_name: menuItem ? menuItem.name : "Unknown",
        menu_item_price: menuItem ? menuItem.price : 0,
        current_stock: parseInt(currentStock),
        restock_limit: parseInt(restockLimit),
        needs_restock: parseInt(currentStock) <= parseInt(restockLimit)
      });
    }
    outlet.current_stock = outlet.items.reduce((sum, s) => sum + s.current_stock, 0);
    outlet.needs_restock = outlet.items.some(s => s.needs_restock);
    localStorage.setItem("mock_outlets", JSON.stringify(outlets));
    return { message: "Item assigned successfully" };
  },

  async adminRemoveItemFromOutlet(outletId, menuItemId) {
    const outlets = JSON.parse(localStorage.getItem("mock_outlets"));
    const outlet = outlets.find(o => o.id === parseInt(outletId));
    if (!outlet) throw new Error("Outlet not found");
    outlet.items = (outlet.items || []).filter(i => i.menu_item_id !== parseInt(menuItemId));
    outlet.current_stock = outlet.items.reduce((sum, s) => sum + s.current_stock, 0);
    outlet.needs_restock = outlet.items.some(s => s.needs_restock);
    localStorage.setItem("mock_outlets", JSON.stringify(outlets));
    return { message: "Item removed from outlet" };
  },

  async adminGetRevenueShare() {
    return fetchAPI("/api/admin/revenue-share");
  },

  async adminGetAnalytics() {
    const orders = JSON.parse(localStorage.getItem("mock_orders") || "[]");
    const sales = JSON.parse(localStorage.getItem("mock_sales") || "[]");
    const outlets = JSON.parse(localStorage.getItem("mock_outlets") || "[]");
    const b2cRev = orders.reduce((sum, o) => sum + (o.status !== "cancelled" ? o.total_price : 0), 0);
    const posRev = sales.reduce((sum, s) => sum + s.total_amount, 0);

    const daily = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.getDate() + "/" + (d.getMonth() + 1);
      daily.push({
        date: label,
        b2c: Math.round(b2cRev / 7 + (Math.random() - 0.5) * 50),
        pos: Math.round(posRev / 7 + (Math.random() - 0.5) * 50)
      });
    }

    return {
      summary: {
        b2c_revenue: b2cRev,
        pos_revenue: posRev,
        total_revenue: b2cRev + posRev,
        b2c_orders: orders.length,
        pos_sales: sales.length
      },
      daily,
      top_b2c_items: [
        { name: "Kobbari Karam 250g", qty: 24 },
        { name: "Classic Avakaya 250g", qty: 18 },
        { name: "Bellam Gavvalu 250g", qty: 15 }
      ],
      top_pos_items: [
        { name: "Snack Supply Samosa 250g", qty: 45 },
        { name: "Paneer Spring Rolls", qty: 32 }
      ],
      outlet_revenue: outlets.map(o => ({
        name: o.name,
        revenue: Math.round(posRev / outlets.length + (Math.random() - 0.5) * 100)
      })),
      low_stock_count: outlets.filter(o => o.needs_restock).length,
      expiring_count: 1
    };
  },

  async adminGetAuditLogs(page = 1, perPage = 50) {
    const logs = JSON.parse(localStorage.getItem("mock_audit_logs") || "[]");
    return {
      logs: logs.slice((page - 1) * perPage, page * perPage),
      total: logs.length,
      page
    };
  },

  async posLogDisposal(userId, outletId, menuItemId, qty, reason) {
    const outlets = JSON.parse(localStorage.getItem("mock_outlets") || "[]");
    const outlet = outlets.find(o => o.id === parseInt(outletId));
    if (!outlet) throw new Error("Outlet not found");
    const item = (outlet.items || []).find(i => i.menu_item_id === parseInt(menuItemId));
    if (!item) throw new Error("Item not assigned to outlet");
    if (item.current_stock < qty) throw new Error("Insufficient stock");

    const before = item.current_stock;
    item.current_stock -= qty;
    item.needs_restock = item.current_stock <= item.restock_limit;
    outlet.current_stock = outlet.items.reduce((s, i) => s + i.current_stock, 0);
    outlet.needs_restock = outlet.items.some(i => i.needs_restock);

    const logs = JSON.parse(localStorage.getItem("mock_audit_logs") || "[]");
    logs.unshift({
      id: Date.now(),
      created_at: new Date().toISOString(),
      outlet_name: outlet.name,
      menu_item_name: item.menu_item_name,
      change_qty: -qty,
      change_type: "waste",
      stock_before: before,
      stock_after: item.current_stock,
      notes: `Disposal: ${reason}`
    });

    localStorage.setItem("mock_outlets", JSON.stringify(outlets));
    localStorage.setItem("mock_audit_logs", JSON.stringify(logs));

    return { message: "Disposal logged successfully", new_stock: item.current_stock };
  },

  async ownerGetDashboard(userId) {
    const outlets = JSON.parse(localStorage.getItem("mock_outlets") || "[]");
    return outlets.filter(o => o.owner_id === parseInt(userId));
  },

  async ownerCreateOutlet(userId, payload) {
    const outlets = JSON.parse(localStorage.getItem("mock_outlets") || "[]");
    const newOutlet = {
      id: Date.now(),
      name: payload.name,
      address: payload.address,
      latitude: payload.latitude,
      longitude: payload.longitude,
      current_stock: 0,
      needs_restock: false,
      owner_id: parseInt(userId),
      items: []
    };
    outlets.push(newOutlet);
    localStorage.setItem("mock_outlets", JSON.stringify(outlets));
    return { message: "Outlet registered", outlet: newOutlet };
  },

  async ownerEditOutlet(userId, outletId, payload) {
    const outlets = JSON.parse(localStorage.getItem("mock_outlets") || "[]");
    const outlet = outlets.find(o => o.id === parseInt(outletId));
    if (!outlet || outlet.owner_id !== parseInt(userId)) throw new Error("Outlet not found");
    if (payload.name) outlet.name = payload.name;
    if (payload.address) outlet.address = payload.address;
    if (payload.latitude !== undefined) outlet.latitude = payload.latitude;
    if (payload.longitude !== undefined) outlet.longitude = payload.longitude;
    localStorage.setItem("mock_outlets", JSON.stringify(outlets));
    return { message: "Updated", outlet };
  },

  async ownerGetStock(userId, outletId) {
    const outlets = JSON.parse(localStorage.getItem("mock_outlets") || "[]");
    const outlet = outlets.find(o => o.id === parseInt(outletId) && o.owner_id === parseInt(userId));
    if (!outlet) throw new Error("Outlet not found");
    return outlet;
  },

  async getLoyaltyTransactions(userId) {
    const users = JSON.parse(localStorage.getItem("mock_users") || "[]");
    const u = users.find(x => x.id === parseInt(userId));
    return u?.loyalty_history || [];
  },

  async deleteAccount(userId) {
    const live = await checkBackendAlive();
    if (!live) {
      let users = JSON.parse(localStorage.getItem("mock_users") || "[]");
      users = users.filter(u => u.id !== parseInt(userId));
      localStorage.setItem("mock_users", JSON.stringify(users));
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      return { message: "Account deleted successfully" };
    }
  },

  async deleteCustomerReview(reviewId) {
    const live = await checkBackendAlive();
    if (!live) {
      let reviews = JSON.parse(localStorage.getItem("mock_menu_item_reviews") || "[]");
      reviews = reviews.filter(r => r.id !== parseInt(reviewId));
      localStorage.setItem("mock_menu_item_reviews", JSON.stringify(reviews));
      return { message: "Review deleted successfully" };
    }
  },

  async forgotPassword(email) {
    const users = JSON.parse(localStorage.getItem("mock_users") || "[]");
    const user = users.find(u => u.email === email);
    if (user) {
      const token = "mock-reset-token-12345";
      user.password_reset_token = token;
      user.password_reset_expiry = new Date(Date.now() + 3600 * 1000).toISOString();
      localStorage.setItem("mock_users", JSON.stringify(users));
    }
    return { message: "If the email is registered, you will receive a reset token shortly." };
  },

  async resetPassword(email, token, newPassword) {
    const users = JSON.parse(localStorage.getItem("mock_users") || "[]");
    const user = users.find(u => u.email === email);
    if (!user || user.password_reset_token !== token) {
      throw new Error("Invalid or expired token");
    }
    user.password = newPassword;
    user.password_reset_token = null;
    user.password_reset_expiry = null;
    user.is_first_login = false;
    localStorage.setItem("mock_users", JSON.stringify(users));
    return { message: "Password has been reset successfully" };
  },

  async changePassword(userId, newPassword) {
    const users = JSON.parse(localStorage.getItem("mock_users") || "[]");
    const user = users.find(u => u.id === parseInt(userId));
    if (!user) throw new Error("User not found");
    user.password = newPassword;
    user.is_first_login = false;
    localStorage.setItem("mock_users", JSON.stringify(users));
    return { message: "Password changed successfully" };
  },

  async adminGetUsers() {
    return JSON.parse(localStorage.getItem("mock_users") || "[]");
  },

  async adminUpdateUser(userId, data) {
    const users = JSON.parse(localStorage.getItem("mock_users") || "[]");
    const user = users.find(u => u.id === parseInt(userId));
    if (!user) throw new Error("User not found");
    if (data.is_active !== undefined) user.is_active = data.is_active;
    if (data.role) {
      if (data.role === "admin") {
        const admins = users.filter(u => u.role === "admin");
        if (admins.length >= 3) {
          throw new Error("Maximum of 3 admin accounts allowed.");
        }
      }
      user.role = data.role;
    }
    if (data.outlet_id !== undefined) user.outlet_id = data.outlet_id;
    if (data.password !== undefined) user.password = data.password;
    localStorage.setItem("mock_users", JSON.stringify(users));
    return { message: "User updated successfully", user };
  },

  async validateCoupon(code) {
    const coupons = JSON.parse(localStorage.getItem("mock_coupons") || "[]");
    const coupon = coupons.find(c => c.code === code.toUpperCase().trim() && c.is_active);
    if (!coupon) throw new Error("Invalid or inactive coupon code");
    return coupon;
  },

  async getActiveCoupons() {
    const coupons = JSON.parse(localStorage.getItem("mock_coupons") || "[]");
    return coupons.filter(c => c.is_active);
  },

  async adminGetCoupons() {
    return JSON.parse(localStorage.getItem("mock_coupons") || "[]");
  },

  async adminAddCoupon(data) {
    const coupons = JSON.parse(localStorage.getItem("mock_coupons") || "[]");
    const code = (data.code || "").trim().toUpperCase();
    if (coupons.find(c => c.code === code)) throw new Error("Coupon code already exists");
    const newCoupon = {
      id: Date.now(),
      code,
      discount_pct: data.discount_pct ? parseInt(data.discount_pct) : null,
      discount_amount: data.discount_amount ? parseFloat(data.discount_amount) : null,
      max_discount_amount: data.max_discount_amount ? parseFloat(data.max_discount_amount) : null,
      applicable_menu_item_id: data.applicable_menu_item_id ? parseInt(data.applicable_menu_item_id) : null,
      applicable_customer_id: data.applicable_customer_id ? parseInt(data.applicable_customer_id) : null,
      min_order_value: data.min_order_value ? parseFloat(data.min_order_value) : null,
      is_first_order_only: !!data.is_first_order_only,
      is_active: data.is_active !== undefined ? data.is_active : true,
      created_at: new Date().toISOString()
    };
    coupons.push(newCoupon);
    localStorage.setItem("mock_coupons", JSON.stringify(coupons));
    return { message: "Coupon created successfully", coupon: newCoupon };
  },

  async adminUpdateCoupon(couponId, data) {
    const coupons = JSON.parse(localStorage.getItem("mock_coupons") || "[]");
    const coupon = coupons.find(c => c.id === parseInt(couponId));
    if (!coupon) throw new Error("Coupon not found");
    if (data.is_active !== undefined) coupon.is_active = data.is_active;
    if (data.discount_pct !== undefined) coupon.discount_pct = data.discount_pct ? parseInt(data.discount_pct) : null;
    if (data.discount_amount !== undefined) coupon.discount_amount = data.discount_amount ? parseFloat(data.discount_amount) : null;
    if (data.max_discount_amount !== undefined) coupon.max_discount_amount = data.max_discount_amount ? parseFloat(data.max_discount_amount) : null;
    if (data.applicable_menu_item_id !== undefined) coupon.applicable_menu_item_id = data.applicable_menu_item_id ? parseInt(data.applicable_menu_item_id) : null;
    if (data.applicable_customer_id !== undefined) coupon.applicable_customer_id = data.applicable_customer_id ? parseInt(data.applicable_customer_id) : null;
    if (data.min_order_value !== undefined) coupon.min_order_value = data.min_order_value ? parseFloat(data.min_order_value) : null;
    if (data.is_first_order_only !== undefined) coupon.is_first_order_only = !!data.is_first_order_only;
    localStorage.setItem("mock_coupons", JSON.stringify(coupons));
    return { message: "Coupon updated successfully", coupon };
  },

  async adminDeleteCoupon(couponId) {
    let coupons = JSON.parse(localStorage.getItem("mock_coupons") || "[]");
    coupons = coupons.filter(c => c.id !== parseInt(couponId));
    localStorage.setItem("mock_coupons", JSON.stringify(coupons));
    return { message: "Coupon deleted successfully" };
  },

  async getMenuItemReviews(itemId) {
    const reviews = JSON.parse(localStorage.getItem("mock_menu_item_reviews") || "[]");
    return reviews.filter(r => r.menu_item_id === parseInt(itemId)).reverse();
  },

  async submitMenuItemReview(userId, itemId, rating, comment) {
    const reviews = JSON.parse(localStorage.getItem("mock_menu_item_reviews") || "[]");
    const menu = JSON.parse(localStorage.getItem("mock_menu") || "[]");
    const item = menu.find(m => m.id === parseInt(itemId));
    const users = JSON.parse(localStorage.getItem("mock_users") || "[]");
    const user = users.find(u => u.id === parseInt(userId));

    const newReview = {
      id: Date.now(),
      menu_item_id: parseInt(itemId),
      menu_item_name: item ? item.name : "Unknown Item",
      customer_id: parseInt(userId),
      customer_name: user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email : "Customer",
      rating: parseInt(rating),
      comment,
      created_at: new Date().toISOString()
    };
    reviews.push(newReview);
    localStorage.setItem("mock_menu_item_reviews", JSON.stringify(reviews));
    return { message: "Review submitted successfully", review: newReview };
  },

  async adminGetReviews() {
    return JSON.parse(localStorage.getItem("mock_menu_item_reviews") || "[]").reverse();
  },

  async adminUpdateReview(reviewId, data) {
    const reviews = JSON.parse(localStorage.getItem("mock_menu_item_reviews") || "[]");
    const review = reviews.find(r => r.id === parseInt(reviewId));
    if (!review) throw new Error("Review not found");
    if (data.is_hidden !== undefined) review.is_hidden = data.is_hidden;
    if (data.admin_reply !== undefined) review.admin_reply = data.admin_reply;
    localStorage.setItem("mock_menu_item_reviews", JSON.stringify(reviews));
    return { message: "Review updated", review };
  },

  async adminDeleteReview(reviewId) {
    let reviews = JSON.parse(localStorage.getItem("mock_menu_item_reviews") || "[]");
    reviews = reviews.filter(r => r.id !== parseInt(reviewId));
    localStorage.setItem("mock_menu_item_reviews", JSON.stringify(reviews));
    return { message: "Review deleted successfully" };
  }
};

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
    const live = await checkBackendAlive();
    if (!live) return mockApi.register(email, password, role, first_name, last_name, phone, outlet_id, referral_code);

    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role, first_name, last_name, phone, outlet_id: outlet_id ? parseInt(outlet_id) : null, referral_code })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Registration failed");
    return data;
  },

  async verifyEmail(token) {
    const res = await fetch(`${API_BASE_URL}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Verification failed");
    return data;
  },

  async login(payload) {
    const live = await checkBackendAlive();
    if (!live) {
      const emailOrCode = payload.email || payload.staff_code;
      const passOrPin = payload.password || payload.pin;
      const data = await mockApi.login(emailOrCode, passOrPin);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      return data;
    }

    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Login failed");
    localStorage.setItem("token", data.access_token);
    if (data.refresh_token) {
      localStorage.setItem("refresh_token", data.refresh_token);
    }
    localStorage.setItem("user", JSON.stringify(data.user));
    return data;
  },

  logout() {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      originalFetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ refresh_token: refreshToken })
      }).catch(() => {});
    }
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
  },

  getCurrentUser() {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  },

  async refreshUser() {
    // Fetch the latest user data from the backend and update localStorage
    try {
      const live = await checkBackendAlive(true);
      if (!live) return this.getCurrentUser();
      const res = await fetch(`${API_BASE_URL}/auth/me`, { headers: getAuthHeader() });
      if (!res.ok) return this.getCurrentUser();
      const data = await safeJson(res);
      if (data && data.id) {
        localStorage.setItem("user", JSON.stringify(data));
        return data;
      }
      return this.getCurrentUser();
    } catch {
      return this.getCurrentUser();
    }
  },

  async getMe() {
    const live = await checkBackendAlive();
    if (!live) {
      return this.getCurrentUser();
    }
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No token");

    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    const data = await safeJson(res);
    if (data.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
      return data.user;
    } else if (data.id) {
      localStorage.setItem("user", JSON.stringify(data));
      return data;
    }
    return null;
  },

  // -----------------------
  // B2C Customer Endpoints
  // -----------------------
  async getFoodsMenu() {
    const live = await checkBackendAlive();
    if (!live) return mockApi.getFoodsMenu();

    const res = await fetch(`${API_BASE_URL}/foods/menu`);
    if (!res.ok) throw new Error("Failed to load menu");
    return safeJson(res);
  },

  async placeOrder(items, deliveryAddress, paymentMethod = "COD", couponCode = null, pointsToRedeem = 0, deliveryCharge = 0) {
    const live = await checkBackendAlive();
    const user = this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    if (!live) return mockApi.placeOrder(user.id, items, deliveryAddress, paymentMethod, couponCode, pointsToRedeem, deliveryCharge);

    const res = await fetch(`${API_BASE_URL}/foods/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ items, delivery_address: deliveryAddress, payment_method: paymentMethod, coupon_code: couponCode, redeem_loyalty_points: pointsToRedeem, delivery_charge: deliveryCharge })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to place order");
    return data;
  },

  async getOrderHistory() {
    const live = await checkBackendAlive();
    const user = this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    if (!live) return mockApi.getOrderHistory(user.id);

    // FIX: Correct endpoint is /foods/orders (not /foods/orders/history)
    const res = await fetch(`${API_BASE_URL}/foods/orders`, {
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error("Failed to load order history");
    return safeJson(res);
  },

  async cancelOrder(orderId, reason = "Cancelled by customer") {
    const live = await checkBackendAlive();
    const user = this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    if (!live) return mockApi.cancelOrder(orderId);

    const res = await fetch(`${API_BASE_URL}/foods/orders/${orderId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ reason })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to cancel order");
    return data;
  },

  async confirmReceipt(orderId, trackingCode) {
    const live = await checkBackendAlive();
    const user = this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    if (!live) return mockApi.confirmReceipt(user.id, orderId, trackingCode);

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
    const live = await checkBackendAlive();
    const user = this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    if (!live) return mockApi.submitFeedback(user.id, orderId, rating, comment);

    const res = await fetch(`${API_BASE_URL}/foods/orders/${orderId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ rating: parseInt(rating), comment })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Feedback submission failed");
    return data;
  },

  async deleteCustomerReview(reviewId) {
    const live = await checkBackendAlive();
    if (!live) return mockApi.deleteCustomerReview(reviewId);

    const res = await fetch(`${API_BASE_URL}/customer/reviews/${reviewId}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error("Failed to delete review");
    return safeJson(res);
  },

  async getCustomerReviews() {
    const live = await checkBackendAlive();
    if (!live) return [];
    const res = await fetch(`${API_BASE_URL}/customer/reviews`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to fetch customer reviews");
    return safeJson(res);
  },

  async deleteAccount() {
    const live = await checkBackendAlive();
    const user = this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    
    if (!live) return mockApi.deleteAccount(user.id);
    
    const res = await fetch(`${API_BASE_URL}/customer/account`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to delete account");
    
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    return data;
  },

  async deleteCustomerReview(reviewId) {
    const live = await checkBackendAlive();
    if (!live) return mockApi.deleteCustomerReview(reviewId);

    const res = await fetch(`${API_BASE_URL}/customer/reviews/${reviewId}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to delete review");
    return data;
  },

  // -----------------------
  // POS Staff Endpoints
  // -----------------------
  async getPOSMenu() {
    const live = await checkBackendAlive();
    if (!live) {
      const user = this.getCurrentUser();
      return mockApi.getPOSMenu(user ? user.outlet_id : 1);
    }

    // FIX: Correct endpoint is /pos/menu
    const res = await fetch(`${API_BASE_URL}/pos/menu`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load POS menu");
    return safeJson(res);
  },

  async posSell(items, paymentMethod, couponCode = null) {
    const live = await checkBackendAlive();
    const user = this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    if (!live) return mockApi.posSell(user.id, user.outlet_id, items, paymentMethod, couponCode);

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
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminGetOrders();

    const res = await fetch(`${API_BASE_URL}/admin/orders`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to fetch order queue");
    return safeJson(res);
  },

  async adminShipOrder(orderId, trackingCode, trackingLabel = null, trackingLink = null) {
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminShipOrder(orderId, trackingCode, trackingLabel, trackingLink);

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
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminGetOutlets();

    const res = await fetch(`${API_BASE_URL}/admin/outlets`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load outlets list");
    return safeJson(res);
  },

  async posGetMyOutlet() {
    const live = await checkBackendAlive();
    if (!live) {
      const user = this.getCurrentUser();
      const outlets = await mockApi.adminGetOutlets();
      return outlets.find(o => o.id === user?.outlet_id) || outlets[0];
    }

    const res = await fetch(`${API_BASE_URL}/pos/outlet`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load assigned outlet info");
    return safeJson(res);
  },

  async adminUpdateOutlet(outletId, data) {
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminUpdateOutlet(outletId, data);

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
    const live = await checkBackendAlive();
    if (!live) return { success: true };
    const res = await fetch(`${API_BASE_URL}/admin/outlets/${outletId}`, {
      method: "POST",
      headers: getAuthHeader()
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Failed to delete outlet");
    return result;
  },

  async getFoodByCode(code) {
    const live = await checkBackendAlive();
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
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminAddMenuItem(data);

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
    const live = await checkBackendAlive();
    if (!live) return { success: true };
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
    const live = await checkBackendAlive();
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
    const live = await checkBackendAlive();
    if (!live) {
      const menu = JSON.parse(localStorage.getItem("mock_menu") || "[]");
      return menu.filter(item => item.is_active);
    }

    const res = await fetch(`${API_BASE_URL}/admin/menu`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load admin menu catalog");
    return safeJson(res);
  },

  async adminAssignItemToOutlet(outletId, menuItemId, currentStock, restockLimit) {
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminAssignItemToOutlet(outletId, menuItemId, currentStock, restockLimit);

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
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminRemoveItemFromOutlet(outletId, menuItemId);

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
    const live = await checkBackendAlive();
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
    const live = await checkBackendAlive();

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
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminGetAnalytics();

    const res = await fetch(`${API_BASE_URL}/admin/analytics`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load analytics");
    return safeJson(res);
  },

  async adminGetAuditLogs(page = 1, perPage = 50) {
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminGetAuditLogs(page, perPage);

    const res = await fetch(`${API_BASE_URL}/admin/audit-log?page=${page}&per_page=${perPage}`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load audit logs");
    return safeJson(res);
  },

  async posLogDisposal(menuItemId, qty, reason) {
    const live = await checkBackendAlive();
    const user = this.getCurrentUser();
    if (!live) {
      if (!user) throw new Error("Unauthorized");
      return mockApi.posLogDisposal(user.id, user.outlet_id, menuItemId, qty, reason);
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
    const live = await checkBackendAlive();
    const user = this.getCurrentUser();
    if (!live) {
      if (!user) throw new Error("Unauthorized");
      return mockApi.ownerGetDashboard(user.id);
    }
    const res = await fetch(`${API_BASE_URL}/owner/dashboard`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load owner dashboard");
    return safeJson(res);
  },

  async ownerCreateOutlet(payload) {
    const live = await checkBackendAlive();
    const user = this.getCurrentUser();
    if (!live) {
      if (!user) throw new Error("Unauthorized");
      return mockApi.ownerCreateOutlet(user.id, payload);
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
    const live = await checkBackendAlive();
    const user = this.getCurrentUser();
    if (!live) {
      if (!user) throw new Error("Unauthorized");
      return mockApi.ownerEditOutlet(user.id, outletId, payload);
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
    const live = await checkBackendAlive();
    const user = this.getCurrentUser();
    if (!live) {
      if (!user) throw new Error("Unauthorized");
      return mockApi.ownerGetStock(user.id, outletId);
    }
    const res = await fetch(`${API_BASE_URL}/owner/outlets/${outletId}/stock`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load outlet stock");
    return safeJson(res);
  },

  async forgotPassword(email) {
    const live = await checkBackendAlive();
    if (!live) return mockApi.forgotPassword(email);
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
    const live = await checkBackendAlive();
    if (!live) return mockApi.resetPassword(email, token, newPassword);
    const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token, new_password: newPassword })
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Reset failed");
    return result;
  },

  async requestPasswordChangeOtp(oldPassword) {
    const live = await checkBackendAlive();
    if (!live) {
      return { message: "Mock OTP sent" };
    }
    const res = await fetch(`${API_BASE_URL}/auth/request-password-change-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ old_password: oldPassword })
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Failed to request OTP");
    return result;
  },

  async changePassword(oldPassword, otp, newPassword) {
    const live = await checkBackendAlive();
    const user = this.getCurrentUser();
    if (!live) {
      if (!user) throw new Error("Unauthorized");
      const result = await mockApi.changePassword(user.id, newPassword);
      user.is_first_login = false;
      localStorage.setItem("user", JSON.stringify(user));
      return result;
    }
    const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ old_password: oldPassword, otp, new_password: newPassword })
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Change failed");

    if (user) {
      user.is_first_login = false;
      localStorage.setItem("user", JSON.stringify(user));
    }
    return result;
  },

  async updateProfile(data) {
    const live = await checkBackendAlive();
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
        localStorage.setItem("user", JSON.stringify(updatedUser));
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
      localStorage.setItem("user", JSON.stringify(result.user));
    }
    return result;
  },

  async getAddresses() {
    const live = await checkBackendAlive();
    if (!live) {
      const addresses = JSON.parse(localStorage.getItem("mock_addresses") || "[]");
      const user = this.getCurrentUser();
      if (!user) return [];
      return addresses.filter(a => a.user_id === user.id);
    }
    const res = await fetch(`${API_BASE_URL}/auth/addresses`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load addresses");
    return safeJson(res);
  },

  async addAddress(title, address_line, is_default = false) {
    const live = await checkBackendAlive();
    if (!live) {
      const addresses = JSON.parse(localStorage.getItem("mock_addresses") || "[]");
      const user = this.getCurrentUser();
      if (!user) throw new Error("Unauthorized");
      const newAddress = { id: Date.now(), user_id: user.id, title, address_line, is_default };
      addresses.push(newAddress);
      localStorage.setItem("mock_addresses", JSON.stringify(addresses));
      return { success: true, address: newAddress };
    }
    const res = await fetch(`${API_BASE_URL}/auth/addresses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ title, address_line, is_default })
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Failed to add address");
    return result;
  },

  async deleteAddress(id) {
    const live = await checkBackendAlive();
    if (!live) {
      let addresses = JSON.parse(localStorage.getItem("mock_addresses") || "[]");
      addresses = addresses.filter(a => a.id !== id);
      localStorage.setItem("mock_addresses", JSON.stringify(addresses));
      return { success: true };
    }
    const res = await fetch(`${API_BASE_URL}/auth/addresses/${id}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Failed to delete address");
    return result;
  },

  async getLoyaltyHistory() {
    const live = await checkBackendAlive();
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
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminGetUsers();
    const res = await fetch(`${API_BASE_URL}/admin/staff`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load users");
    return safeJson(res);
  },

  async adminUpdateUser(userId, data) {
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminUpdateUser(userId, data);
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
    const live = await checkBackendAlive();
    if (!live) return { success: true }; // Mock implementation
    const res = await fetch(`${API_BASE_URL}/admin/staff/${userId}`, {
      method: "POST",
      headers: getAuthHeader()
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || result.error || "Failed to delete user");
    return result;
  },

  async validateCoupon(code) {
    const live = await checkBackendAlive();
    if (!live) return mockApi.validateCoupon(code);
    const res = await fetch(`${API_BASE_URL}/coupons/${code}`);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Invalid coupon");
    return data;
  },

  async getActiveCoupons() {
    const live = await checkBackendAlive();
    if (!live) return mockApi.getActiveCoupons();
    const res = await fetch(`${API_BASE_URL}/coupons/active?t=${Date.now()}`);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to fetch active coupons");
    return data;
  },

  async adminGetCoupons() {
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminGetCoupons();
    const res = await fetch(`${API_BASE_URL}/admin/coupons`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load coupons");
    return safeJson(res);
  },

  async adminAddCoupon(data) {
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminAddCoupon(data);
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
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminUpdateCoupon(couponId, data);
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
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminDeleteCoupon(couponId);
    const res = await fetch(`${API_BASE_URL}/admin/coupons/${couponId}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    const result = await safeJson(res);
    if (!res.ok) throw new Error(result.message || "Failed to delete coupon");
    return result;
  },

  async getOutletCoupons() {
    const live = await checkBackendAlive();
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
    const live = await checkBackendAlive();
    if (!live) return mockApi.getMenuItemReviews(itemId);

    const res = await fetch(`${API_BASE_URL}/foods/menu-items/${itemId}/reviews`);
    if (!res.ok) throw new Error("Failed to load reviews");
    return safeJson(res);
  },

  async submitMenuItemReview(itemId, data) {
    const live = await checkBackendAlive();
    const user = this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    if (!live) return mockApi.submitMenuItemReview(user.id, itemId, data.rating, data.comment);

    const res = await fetch(`${API_BASE_URL}/foods/menu-items/${itemId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ rating: parseInt(data.rating), comment: data.comment, order_id: data.orderId })
    });
    const responseData = await safeJson(res);
    if (!res.ok) throw new Error(responseData.message || responseData.error || "Review submission failed");
    return responseData;
  },

  async deleteCustomerReview(reviewId) {
    const live = await checkBackendAlive();
    if (!live) return mockApi.deleteCustomerReview(reviewId);
    
    const res = await fetch(`${API_BASE_URL}/customer/reviews/${reviewId}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to delete review");
    return data;
  },

  async adminGetReviews() {
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminGetReviews();

    const res = await fetch(`${API_BASE_URL}/admin/reviews`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load reviews");
    return safeJson(res);
  },

  async adminUpdateReview(reviewId, data) {
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminUpdateReview(reviewId, data);

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
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminDeleteReview(reviewId);

    const res = await fetch(`${API_BASE_URL}/admin/reviews/${reviewId}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || data.error || "Failed to delete review");
    return data;
  },

  async cancelOrder(orderId, reason = "Cancelled by customer") {
    const live = await checkBackendAlive();
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
    const live = await checkBackendAlive();
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
    const live = await checkBackendAlive();
    const user = this.getCurrentUser();
    if (!live) {
      if (!user) return { shift: null };
      const shifts = JSON.parse(localStorage.getItem("mock_shifts") || "[]");
      const active = shifts.find(s => s.staff_id === user.id && s.status === "active");
      return { shift: active || null };
    }
    const res = await fetch(`${API_BASE_URL}/pos/shift/active`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to check active shift");
    return safeJson(res);
  },

  async posClockOut(actualCash, notes) {
    const live = await checkBackendAlive();
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
    const live = await checkBackendAlive();
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
    const live = await checkBackendAlive();
    const user = this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    if (!live) {
      const result = await mockApi.posSell(user.id, user.outlet_id, items, paymentMethod, couponCode);
      if (customerEmail) {
        const users = JSON.parse(localStorage.getItem("mock_users") || "[]");
        const customer = users.find(u => u.email === customerEmail && u.role === "customer");
        if (customer) {
          const total = (result.sale && result.sale.total_amount) ? result.sale.total_amount : 0;
          let finalTotal = total;
          let pointsRedeemed = 0;
          if (redeemLoyaltyPoints > 0) {
            const maxRedeem = Math.min(redeemLoyaltyPoints, customer.loyalty_points || 0, Math.floor(total));
            finalTotal = total - maxRedeem;
            customer.loyalty_points = (customer.loyalty_points || 0) - maxRedeem;
            pointsRedeemed = maxRedeem;
          }
          const earned = Math.floor(finalTotal / 100);
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

  async adminGetShifts() {
    const live = await checkBackendAlive();
    if (!live) return JSON.parse(localStorage.getItem("mock_shifts") || "[]").reverse();
    const res = await fetch(`${API_BASE_URL}/admin/shifts`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load timesheets");
    return safeJson(res);
  },

  async adminDeleteShift(shiftId) {
    const live = await checkBackendAlive();
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
    const live = await checkBackendAlive();
    if (!live) return JSON.parse(localStorage.getItem("customer_addresses") || "[]");
    const res = await fetch(`${API_BASE_URL}/auth/addresses`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load addresses");
    return safeJson(res);
  },
  async addAddress(title, address_line, is_default = false) {
    const live = await checkBackendAlive();
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
    const live = await checkBackendAlive();
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
    const live = await checkBackendAlive();
    if (!live) return JSON.parse(localStorage.getItem("customer_favorites") || "[]");
    const res = await fetch(`${API_BASE_URL}/foods/favorites`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load favorites");
    return safeJson(res);
  },
  async addFavorite(menu_item_id) {
    const live = await checkBackendAlive();
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
    const live = await checkBackendAlive();
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
    const live = await checkBackendAlive();
    if (!live) {
      const orders = JSON.parse(localStorage.getItem("mock_orders") || "[]");
      return orders.filter(o => o.status === "pending" || o.status === "processing").sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }
    const res = await fetch(`${API_BASE_URL}/kitchen/orders`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load kitchen orders");
    return safeJson(res);
  },
  async updateKitchenOrderStatus(orderId, status) {
    const live = await checkBackendAlive();
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
  async getRestockRequests() {
    const live = await checkBackendAlive();
    if (!live) {
      const stock = JSON.parse(localStorage.getItem("mock_outlet_stock") || "[]");
      return stock.filter(s => s.current_stock <= s.restock_limit);
    }
    const res = await fetch(`${API_BASE_URL}/kitchen/restock-requests`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load restock requests");
    return safeJson(res);
  },
  async produceBatch(menu_item_id, quantity, expiry_date) {
    const live = await checkBackendAlive();
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
    const live = await checkBackendAlive();
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
  async adminGetStoreSettings() {
    const live = await checkBackendAlive();
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
    const live = await checkBackendAlive(true);
    if (!live) return [];
    const res = await fetch(`${API_BASE_URL}/customer/tickets`, { headers: getAuthHeader() });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error("Session expired. Please log in again.");
      throw new Error("Failed to load tickets");
    }
    return safeJson(res);
  },
  async createTicket(payload) {
    const live = await checkBackendAlive(true);
    if (!live) throw new Error("Server is offline. Please try again when the server is running.");
    const isFormData = payload instanceof FormData;
    const headers = getAuthHeader();
    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(`${API_BASE_URL}/customer/tickets`, {
      method: "POST", 
      headers,
      body: isFormData ? payload : JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to create ticket");
    return data;
  },
  async updateTicket(id, payload) {
    const live = await checkBackendAlive(true);
    if (!live) throw new Error("Server is offline. Please try again when the server is running.");
    const isFormData = payload instanceof FormData;
    const headers = getAuthHeader();
    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(`${API_BASE_URL}/customer/tickets/${id}`, {
      method: "PUT", 
      headers,
      body: isFormData ? payload : JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to update ticket");
    return data;
  },
  async deleteTicket(id) {
    const live = await checkBackendAlive(true);
    if (!live) throw new Error("Server is offline.");
    const res = await fetch(`${API_BASE_URL}/customer/tickets/${id}`, { method: "DELETE", headers: getAuthHeader() });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || "Failed to delete ticket");
    return data;
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
  }
};
