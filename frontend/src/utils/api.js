// API client for communicating with the Flask backend.
// Implements a Mock Fallback Mode using localStorage if the backend is unreachable.

export const API_BASE_URL = import.meta.env.VITE_API_URL || (
  (window.location.port === "5173" || window.location.port === "5174" || window.location.port === "3000")
    ? `${window.location.protocol}//${window.location.hostname}:5000/api`
    : `${window.location.protocol}//${window.location.host}/api`
);

// Helper to retrieve auth tokens
function getAuthHeader() {
  const token = localStorage.getItem("token");
  return token ? { "Authorization": `Bearer ${token}` } : {};
}

// Check if backend is alive (cached for 10 seconds to resolve UI lag)
let cachedLive = null;
let lastCheckTime = 0;

async function checkBackendAlive(bypassThrow = false) {
  const now = Date.now();
  if (cachedLive !== null && (now - lastCheckTime < 10000)) {
    if (!cachedLive && !bypassThrow && (import.meta.env.PROD && import.meta.env.VITE_DEMO_MODE !== "true")) {
      throw new Error("Unable to connect to the backend server. Please verify the server is running.");
    }
    return cachedLive;
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    cachedLive = response.ok;
  } catch (e) {
    cachedLive = false;
  }
  lastCheckTime = Date.now();
  if (!cachedLive && !bypassThrow && (import.meta.env.PROD && import.meta.env.VITE_DEMO_MODE !== "true")) {
    throw new Error("Unable to connect to the backend server. Please verify the server is running.");
  }
  return cachedLive;
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
  { id: 1, name: "Kobbari Karam 250g", description: "Homemade Kobbari Karam — rich coconut spice powder made from fresh coconut and red chillies.", price: 200.00, original_price: 220.00, category: "Spice Powders", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=200&q=80" },
  { id: 2, name: "Pappula Podi 250g", description: "Homemade Pappula Podi — traditional lentil spice powder for rice and idli.", price: 159.00, original_price: 179.00, category: "Spice Powders", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=200&q=80" },
  { id: 3, name: "Karvepaku Karram 250g", description: "Karivepaku Karam — authentic curry leaf spice powder with a pungent aroma.", price: 159.00, original_price: 179.00, category: "Spice Powders", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1599909613253-f3b3a5f7b33f?w=200&q=80" },
  { id: 4, name: "Nuvvula Podi 250g", description: "Nuvvula Podi (Roasted Sesame Powder) — nutrient-rich sesame spice blend.", price: 169.00, original_price: 185.00, category: "Spice Powders", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=200&q=80" },
  { id: 5, name: "Munagaku Podi 250g", description: "Suggula's Kitchen Munagaku Podi — drumstick leaves powder packed with nutrients.", price: 160.00, original_price: 180.00, category: "Spice Powders", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1583394293214-0b3f8ed6e0ab?w=200&q=80" },
  { id: 6, name: "Kandi Podi 250g", description: "సాంప్రదాయ రుచికి అసలైన కందిపప్పు పొడి — traditional toor dal spice powder.", price: 179.00, original_price: 199.00, category: "Spice Powders", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=200&q=80" },
  { id: 7, name: "Curry Leaves Herbal Powder 250g", description: "Curry Leaves Herbal Powder — natural health supplement and flavour enhancer.", price: 289.00, original_price: 320.00, category: "Spice Powders", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1591189824344-d7e6c2440e4a?w=200&q=80" },
  { id: 8, name: "Andhra Nallakaram Podi 250g", description: "Experience the authentic Andhra Nallakaram podi — fiery and aromatic.", price: 140.00, original_price: 160.00, category: "Spice Powders", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=200&q=80" },
  { id: 9, name: "Andhra Koora Karam 250g", description: "అమ్మ చేతి కూర కారం — the special Andhra vegetable spice blend.", price: 120.00, original_price: 140.00, category: "Spice Powders", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=200&q=80" },
  { id: 10, name: "Pallila Karam 250g", description: "నాన్నేమైన వేరుసేనగలు, సం... — peanut-based Andhra spice powder.", price: 180.00, original_price: 200.00, category: "Spice Powders", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1599909613253-f3b3a5f7b33f?w=200&q=80" },

  // --- Pickles (Pachallu) ---
  { id: 11, name: "Pandu Mirchi Gongura 250g", description: "Traditional Andhra Pandu Mirchi Gongura pickle — tangy red chilli sorrel blend.", price: 199.00, original_price: 220.00, category: "Pickles", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1567982047351-76b6f93e38ee?w=200&q=80" },
  { id: 12, name: "Pandumirchi Tamota Pickle 250g", description: "Traditional Andhra Pandumirchi Tomato pickle — a classic tangy combination.", price: 199.00, original_price: 220.00, category: "Pickles", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1567982047351-76b6f93e38ee?w=200&q=80" },
  { id: 13, name: "Allam Pandumirchi Pickle 250g", description: "Traditional Andhra Allam Chilli pickle — spicy ginger and chilli blend.", price: 199.00, original_price: 220.00, category: "Pickles", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1589916836867-5208c1f74e23?w=200&q=80" },
  { id: 14, name: "Pandu Mirchi Pickle 250g", description: "పండిన ఎర్ర మిర్చితో, నాన్చు... — slow-fermented red chilli pickle.", price: 229.00, original_price: 245.00, category: "Pickles", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1567982047351-76b6f93e38ee?w=200&q=80" },
  { id: 15, name: "Kothimera Pickle 250g", description: "తాజా కొత్తిమేర సువాస... — fresh coriander leaves pickle.", price: 189.00, original_price: 199.00, category: "Pickles", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1589916836867-5208c1f74e23?w=200&q=80" },
  { id: 16, name: "Classic Avakaya 250g", description: "అసలైన ఆంధ్ర ఆవకాయ... — the king of Andhra pickles, raw mango.", price: 299.00, original_price: 320.00, category: "Pickles", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1567982047351-76b6f93e38ee?w=200&q=80" },

  // --- Snacks & Savories ---
  { id: 17, name: "Challa Chakralu 250g", description: "Traditional Challa Chakralu — crispy butter rice rings, a timeless Andhra snack.", price: 120.00, original_price: 140.00, category: "Snacks & Savories", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80" },
  { id: 18, name: "Rice Vadiyalu 250g", description: "సాంప్రదాయ ఆంధ్ర రుచితో... — traditional sun-dried rice crackers.", price: 120.00, original_price: 140.00, category: "Snacks & Savories", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80" },
  { id: 19, name: "Chekkarala Vadiyalu 250g", description: "అమ్మ చేతి రుచితో, సాంప్రదా... — handmade chekkarala vadiyalu.", price: 150.00, original_price: 160.00, category: "Snacks & Savories", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80" },
  { id: 20, name: "Sagubiyam Vadiyalu 250g", description: "ఎండలో సహజంగా ఆరబెట్టి... — sago sun-dried crackers.", price: 120.00, original_price: 140.00, category: "Snacks & Savories", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80" },
  { id: 21, name: "Bellam Gavvalu 250g", description: "Fresh & Crunchy Bellam Gavvalu — sweet jaggery shells, a traditional treat.", price: 195.00, original_price: 220.00, category: "Snacks & Savories", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80" },
  { id: 22, name: "Karram Gavvalu 250g", description: "Karam Gavvalu — spicy shell-shaped crispy snack from Andhra.", price: 159.00, original_price: 180.00, category: "Snacks & Savories", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80" },

  // --- Sweets & Treats ---
  { id: 23, name: "Palli Patti 250g", description: "Peanut Chikki / Palli Patti — crunchy peanut brittle with jaggery.", price: 169.00, original_price: 189.00, category: "Sweets & Treats", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=200&q=80" },
  { id: 24, name: "Pala Penilu 250g", description: "Experience the authentic taste of Pala Penilu — milk-based traditional sweet.", price: 249.00, original_price: 269.00, category: "Sweets & Treats", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=200&q=80" },
  { id: 25, name: "Royal Honey Cashew 250g", description: "Every bite is rich, crunchy, and coated in pure honey — premium cashew delight.", price: 319.00, original_price: 340.00, category: "Sweets & Treats", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=200&q=80" },
  { id: 26, name: "Gondhu Laddu 250g", description: "ఈ గొంధు (కృఫ్ల్) నెయ్యిలో... — traditional Gondhu Laddu with pure ghee.", price: 319.00, original_price: 340.00, category: "Sweets & Treats", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=200&q=80" },
  { id: 27, name: "Suggula's Kitchen Sweet 250g", description: "Suggula's Kitchen Sweet & Special — traditional handmade sweet boxes.", price: 369.00, original_price: 408.00, category: "Sweets & Treats", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=200&q=80" },

  // --- Mixes & Instant ---
  { id: 28, name: "Instant Rasam Mix 250g", description: "Instant Rasam Mix — Bring the warmth of homemade rasam to your table instantly.", price: 140.00, original_price: 160.00, category: "Mixes & Instant", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200&q=80" },
  { id: 29, name: "Karram Charu Mix 250g", description: "Karam Charu Mix (Instant Rasam Powder) — spicy pepper rasam mix.", price: 165.00, original_price: 195.00, category: "Mixes & Instant", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200&q=80" },
  { id: 30, name: "Chinthapandu Pulihora Mix 250g", description: "Chinthapandu Pulihora Mix — tamarind rice spice blend for perfect pulihora.", price: 165.00, original_price: 185.00, category: "Mixes & Instant", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200&q=80" },
  { id: 31, name: "Instant Gravy Mix 250g", description: "రెస్తారెంట్ స్టైల్ కర్రీ... — restaurant-style instant curry gravy mix.", price: 149.00, original_price: 199.00, category: "Mixes & Instant", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200&q=80" },

  // --- Special Products ---
  { id: 32, name: "Suggula's Kitchen Traditional 250g", description: "Suggula's Kitchen Traditional — handcrafted special recipe from grandma's kitchen.", price: 349.00, original_price: 360.00, category: "Special Products", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1606914501449-5a96b6ce24ca?w=200&q=80" },
  { id: 33, name: "Ashadam Special Neeyi Annam Podi 250g", description: "Neeyi Annam Podi Ashadam Special — pure ghee rice powder for festive occasions.", price: 449.00, original_price: 499.00, category: "Special Products", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1606914501449-5a96b6ce24ca?w=200&q=80" },
  { id: 34, name: "Saddu Baby Bottu 5g", description: "Saddu Baby Bottu — traditional herbal bottu for infants, a heritage product.", price: 99.00, original_price: 109.00, category: "Special Products", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1606914501449-5a96b6ce24ca?w=200&q=80" },
  { id: 35, name: "Herbal Sunnipindi 250g", description: "Sunni Pindi Herbal Bath Powder — natural herbal body cleansing powder.", price: 299.00, original_price: 320.00, category: "Special Products", business_type: "home_foods", is_active: true, image_url: "https://images.unsplash.com/photo-1606914501449-5a96b6ce24ca?w=200&q=80" },
  { id: 36, name: "Snack Supply Samosa 250g", description: "Crisp pastry filled with spiced potatoes and peas — B2B2C snack supply.", price: 20.00, original_price: 25.00, category: "Snacks & Savories", business_type: "snack_supply", is_active: true, image_url: "https://images.unsplash.com/photo-1601000157769-35ac8d01c9d0?w=200&q=80" },
];

function initMockDB() {
  // Always reset mock_menu to ensure new catalog items are picked up
  localStorage.setItem("mock_outlets", JSON.stringify(INITIAL_OUTLETS));
  localStorage.setItem("mock_menu", JSON.stringify(INITIAL_MENU_ITEMS));
  if (!localStorage.getItem("mock_users") || true) {
    localStorage.setItem("mock_users", JSON.stringify([
      { id: 1, email: "admin", role: "admin", first_name: "John", last_name: "Admin" },
      { id: 2, email: "customer@gmail.com", role: "customer", first_name: "Sarah", last_name: "Customer" },
      { id: 3, email: "staff@brand.com", role: "staff", outlet_id: 1, first_name: "Alex", last_name: "Staff" },
      { id: 4, email: "owner@brand.com", role: "outlet_owner", first_name: "Rajesh", last_name: "Owner" }
    ]));
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
  if (!localStorage.getItem("mock_audit_logs")) {
    localStorage.setItem("mock_audit_logs", JSON.stringify([
      { id: 1, created_at: new Date().toISOString(), outlet_name: "Outlet 1: Connaught Place Corner", menu_item_name: "Crispy Samosa (Snack Supply)", change_qty: -5, change_type: "waste", stock_before: 20, stock_after: 15, notes: "Disposal: Damaged in storage" }
    ]));
  }
}

initMockDB();

// Mock API implementations for fallback mode
const mockApi = {
  async register(email, password, role, first_name, last_name, phone, outlet_id) {
    const users = JSON.parse(localStorage.getItem("mock_users"));
    if (users.find(u => u.email === email)) {
      throw new Error("Email already registered");
    }
    const newId = users.length + 1;
    const user = { id: newId, email, role, first_name, last_name, phone, outlet_id };
    users.push(user);
    localStorage.setItem("mock_users", JSON.stringify(users));
    return { message: "Registration successful", user };
  },

  async login(email, password) {
    const users = JSON.parse(localStorage.getItem("mock_users"));
    const user = users.find(u => u.email === email);
    if (!user) {
      throw new Error("Invalid email or password");
    }
    // Simulate JWT token containing payload claims
    const token = btoa(JSON.stringify({ id: user.id, email: user.email, role: user.role, outlet_id: user.outlet_id }));
    return { access_token: token, user };
  },

  async getFoodsMenu() {
    const menu = JSON.parse(localStorage.getItem("mock_menu"));
    return menu.filter(item => (item.business_type === "home_foods" || item.business_type === "both") && item.is_active);
  },

  async placeOrder(userId, itemsData, deliveryAddress, paymentMethod = "COD") {
    const menu = JSON.parse(localStorage.getItem("mock_menu"));
    const orders = JSON.parse(localStorage.getItem("mock_orders"));
    
    let total = 0;
    const items = itemsData.map(it => {
      const menuItem = menu.find(m => m.id === it.menu_item_id);
      if (!menuItem) throw new Error("Item not found");
      total += menuItem.price * it.quantity;
      return {
        id: Math.random(),
        menu_item_id: menuItem.id,
        menu_item_name: menuItem.name,
        quantity: it.quantity,
        price: menuItem.price
      };
    });

    const newOrder = {
      id: orders.length + 1000,
      customer_id: parseInt(userId),
      customer_email: "customer@gmail.com",
      status: "pending",
      total_price: total,
      tracking_code: null,
      is_received: false,
      feedback_submitted: false,
      delivery_address: deliveryAddress || "",
      payment_method: paymentMethod,
      items,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    orders.push(newOrder);
    localStorage.setItem("mock_orders", JSON.stringify(orders));
    return { message: "Order placed successfully", order: newOrder };
  },

  async getOrderHistory(userId) {
    const orders = JSON.parse(localStorage.getItem("mock_orders"));
    return orders.filter(o => o.customer_id === parseInt(userId)).reverse();
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

  async posSell(userId, outletId, itemsData, paymentMethod) {
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

  async adminShipOrder(orderId, trackingCode) {
    const orders = JSON.parse(localStorage.getItem("mock_orders"));
    const order = orders.find(o => o.id === parseInt(orderId));
    if (!order) throw new Error("Order not found");
    order.status = "shipped";
    order.tracking_code = trackingCode.trim();
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
    localStorage.setItem("mock_outlets", JSON.stringify(outlets));
    return { message: "Outlet updated successfully", outlet };
  },

  async adminAddMenuItem(data) {
    const menu = JSON.parse(localStorage.getItem("mock_menu"));
    const newItem = {
      id: Date.now(),
      name: data.name,
      description: data.description,
      price: parseFloat(data.price),
      original_price: data.original_price ? parseFloat(data.original_price) : null,
      category: data.category || "Other",
      business_type: data.business_type,
      image_url: data.image_url || null,
      is_active: true
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

  async forgotPassword(email) {
    const users = JSON.parse(localStorage.getItem("mock_users") || "[]");
    const user = users.find(u => u.email === email);
    if (user) {
      const token = "mock-reset-token-12345";
      user.password_reset_token = token;
      user.password_reset_expiry = new Date(Date.now() + 3600 * 1000).toISOString();
      localStorage.setItem("mock_users", JSON.stringify(users));
      console.log(`[MOCK MODE] PASSWORD RESET TOKEN FOR ${email}: ${token}`);
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
    const users = JSON.parse(localStorage.getItem("mock_users") || "[]");
    return users.filter(u => u.role !== "admin");
  },

  async adminUpdateUser(userId, data) {
    const users = JSON.parse(localStorage.getItem("mock_users") || "[]");
    const user = users.find(u => u.id === parseInt(userId));
    if (!user) throw new Error("User not found");
    if (data.is_active !== undefined) user.is_active = data.is_active;
    if (data.role) user.role = data.role;
    if (data.outlet_id !== undefined) user.outlet_id = data.outlet_id;
    localStorage.setItem("mock_users", JSON.stringify(users));
    return { message: "User updated successfully", user };
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

  async register(email, password, role, first_name = "", last_name = "", phone = "", outlet_id = null) {
    const live = await checkBackendAlive();
    if (!live) return mockApi.register(email, password, role, first_name, last_name, phone, outlet_id);

    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role, first_name, last_name, phone, outlet_id: outlet_id ? parseInt(outlet_id) : null })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Registration failed");
    return data;
  },

  async login(email, password) {
    const live = await checkBackendAlive();
    if (!live) {
      const data = await mockApi.login(email, password);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      return data;
    }

    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Login failed");
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));
    return data;
  },

  logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  getCurrentUser() {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  },

  // -----------------------
  // B2C Customer Endpoints
  // -----------------------
  async getFoodsMenu() {
    const live = await checkBackendAlive();
    if (!live) return mockApi.getFoodsMenu();

    const res = await fetch(`${API_BASE_URL}/foods/menu`);
    if (!res.ok) throw new Error("Failed to load menu");
    return res.json();
  },

  async placeOrder(items, deliveryAddress, paymentMethod = "COD") {
    const live = await checkBackendAlive();
    const user = this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    if (!live) return mockApi.placeOrder(user.id, items, deliveryAddress, paymentMethod);

    const res = await fetch(`${API_BASE_URL}/foods/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ items, delivery_address: deliveryAddress, payment_method: paymentMethod })
    });
    const data = await res.json();
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
    return res.json();
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
    const data = await res.json();
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
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Feedback submission failed");
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
    return res.json();
  },

  async posSell(items, paymentMethod) {
    const live = await checkBackendAlive();
    const user = this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    if (!live) return mockApi.posSell(user.id, user.outlet_id, items, paymentMethod);

    // FIX: Correct endpoint is /pos/sell
    const res = await fetch(`${API_BASE_URL}/pos/sell`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ items, payment_method: paymentMethod })
    });
    const data = await res.json();
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
    return res.json();
  },

  async adminShipOrder(orderId, trackingCode) {
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminShipOrder(orderId, trackingCode);

    // FIX: Correct endpoint is /admin/orders/<id>/ship (PUT)
    const res = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/ship`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ tracking_code: trackingCode })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Failed to update ship status");
    return data;
  },

  async adminGetOutlets() {
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminGetOutlets();

    const res = await fetch(`${API_BASE_URL}/admin/outlets`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load outlets list");
    return res.json();
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
    return res.json();
  },

  async adminUpdateOutlet(outletId, data) {
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminUpdateOutlet(outletId, data);

    const res = await fetch(`${API_BASE_URL}/admin/outlets/${outletId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || result.error || "Failed to update outlet");
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
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || result.error || "Failed to add menu item");
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
    return res.json();
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
    const result = await res.json();
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
    const result = await res.json();
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
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Failed to generate QR");
    return data;
  },

  async posScanArrival(qrData) {
    const live = await checkBackendAlive();
    
    let payload;
    try {
      payload = JSON.parse(qrData);
    } catch (e) {
      throw new Error("Invalid QR code — not a dispatch label.");
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
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Scan failed");
    return data;
  },

  async adminGetAnalytics() {
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminGetAnalytics();

    const res = await fetch(`${API_BASE_URL}/admin/analytics`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load analytics");
    return res.json();
  },

  async adminGetAuditLogs(page = 1, perPage = 50) {
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminGetAuditLogs(page, perPage);

    const res = await fetch(`${API_BASE_URL}/admin/audit-log?page=${page}&per_page=${perPage}`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load audit logs");
    return res.json();
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
    const data = await res.json();
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
    return res.json();
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
    const data = await res.json();
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
    const data = await res.json();
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
    return res.json();
  },

  async forgotPassword(email) {
    const live = await checkBackendAlive();
    if (!live) return mockApi.forgotPassword(email);
    const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const result = await res.json();
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
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || result.error || "Reset failed");
    return result;
  },

  async changePassword(newPassword) {
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
      body: JSON.stringify({ new_password: newPassword })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || result.error || "Change failed");
    
    if (user) {
      user.is_first_login = false;
      localStorage.setItem("user", JSON.stringify(user));
    }
    return result;
  },

  async adminGetUsers() {
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminGetUsers();
    const res = await fetch(`${API_BASE_URL}/admin/users`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to load users");
    return res.json();
  },

  async adminUpdateUser(userId, data) {
    const live = await checkBackendAlive();
    if (!live) return mockApi.adminUpdateUser(userId, data);
    const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || result.error || "Failed to update user");
    return result;
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
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || result.error || "Failed to cancel order");
    return result;
  }
};
