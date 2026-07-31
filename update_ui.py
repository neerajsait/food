import sys
import re

with open(r'd:\python project\food\frontend-customer\src\components\CustomerView.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

header_lines = lines[:644] # 0 to 643

new_jsx = """  return (
    <div style={{ maxWidth: "100%", minHeight: "100vh", position: "relative", background: "var(--bg-canvas)", color: "var(--text-primary)" }} className="animate-fade-in">
      
      {/* ── Navbar ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "var(--brand)", color: "#ffffff",
        padding: "1rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ background: "#ffffff", color: "var(--brand)", borderRadius: "var(--r-sm)", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", fontWeight: "900" }}>
            S
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: "900", fontFamily: "var(--font-heading)", letterSpacing: "-0.5px" }}>
              Suggula's Kitchen
            </h1>
            <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.85, textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600" }}>Homemade with Love</p>
          </div>
        </div>
        
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => setActiveTab("menu")} style={{ background: activeTab === "menu" ? "rgba(255,255,255,0.2)" : "transparent", color: "#fff", border: "none", padding: "0.5rem 1rem", borderRadius: "var(--r-full)", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}>Menu</button>
          <button onClick={() => setActiveTab("orders")} style={{ background: activeTab === "orders" ? "rgba(255,255,255,0.2)" : "transparent", color: "#fff", border: "none", padding: "0.5rem 1rem", borderRadius: "var(--r-full)", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}>Orders</button>
          <button onClick={() => setActiveTab("tickets")} style={{ background: activeTab === "tickets" ? "rgba(255,255,255,0.2)" : "transparent", color: "#fff", border: "none", padding: "0.5rem 1rem", borderRadius: "var(--r-full)", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}>Support</button>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button onClick={openProfileModal} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>
            <User size={22} />
          </button>
          <button onClick={openCartDrawer} style={{ background: "var(--brand-pink)", color: "#fff", border: "none", padding: "0.6rem 1.2rem", borderRadius: "var(--r-full)", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", boxShadow: "0 4px 12px rgba(233, 30, 99, 0.3)", transition: "all 0.2s" }}>
            <ShoppingCart size={18} /> Basket
            {getCartCount() > 0 && <span style={{ background: "#ffffff", color: "var(--brand-pink)", padding: "2px 8px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: "900" }}>{getCartCount()}</span>}
          </button>
          <button onClick={onLogout} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", opacity: 0.8 }}><LogOut size={20} /></button>
        </div>
      </header>

      <main style={{ padding: "2rem", maxWidth: "var(--content-max-w)", margin: "0 auto" }}>
        {activeTab === "menu" && (
          <>
            {/* Hero Section */}
            <div style={{ position: "relative", background: "var(--accent-terracotta)", borderRadius: "var(--r-xl)", padding: "3rem", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", overflow: "hidden", marginBottom: "3rem" }}>
              <div style={{ position: "relative", zIndex: 2, maxWidth: "600px" }}>
                <h2 style={{ fontSize: "3rem", fontWeight: "900", fontFamily: "var(--font-heading)", margin: "0 0 1rem", lineHeight: 1.1 }}>Authentic Recipes,<br/>Delivered to You.</h2>
                <p style={{ fontSize: "1.1rem", opacity: 0.9, marginBottom: "2rem" }}>Experience the true taste of Andhra with our homemade pickles, spice powders, and traditional sweets. Made with love and the finest ingredients.</p>
                <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                  <div style={{ position: "relative", width: "100%", maxWidth: "350px" }}>
                    <Search size={18} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                    <input 
                      type="text" 
                      placeholder="Search for pickles, sweets..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ width: "100%", padding: "1rem 1rem 1rem 3rem", borderRadius: "var(--r-full)", border: "none", fontSize: "1rem", outline: "none", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", color: "var(--text-primary)" }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ position: "absolute", right: "-10%", top: "-50%", opacity: 0.15, pointerEvents: "none" }}>
                <div style={{ width: "600px", height: "600px", borderRadius: "50%", background: "var(--accent-yellow)", filter: "blur(80px)" }}></div>
              </div>
            </div>

            {/* Categories */}
            <div style={{ marginBottom: "3rem" }}>
              <h3 style={{ fontSize: "1.5rem", fontWeight: "800", fontFamily: "var(--font-heading)", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}><Sparkles size={24} color="var(--brand-pink)"/> Explore Categories</h3>
              <div style={{ display: "flex", gap: "1rem", overflowX: "auto", paddingBottom: "1rem", scrollbarWidth: "none" }}>
                {CATEGORIES.map(cat => (
                  <button 
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    style={{ 
                      flexShrink: 0,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
                      padding: "1rem 1.5rem", borderRadius: "var(--r-lg)",
                      background: activeCategory === cat.id ? "var(--brand)" : "var(--bg-elevated)",
                      color: activeCategory === cat.id ? "#fff" : "var(--text-primary)",
                      border: activeCategory === cat.id ? "2px solid var(--brand)" : "2px solid var(--border-default)",
                      cursor: "pointer", transition: "all 0.2s",
                      minWidth: "120px",
                      boxShadow: activeCategory === cat.id ? "0 10px 20px var(--brand-glow)" : "0 4px 10px rgba(0,0,0,0.03)"
                    }}
                  >
                    <span style={{ fontSize: "2rem" }}>{cat.emoji}</span>
                    <span style={{ fontSize: "0.9rem", fontWeight: "700" }}>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "2rem" }}>
              {Object.entries(groupedMenu).map(([catName, items]) => (
                <React.Fragment key={catName}>
                  {items.map(item => (
                    <div key={item.id} className="glass-card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
                      
                      {/* Product Image Placeholder */}
                      <div style={{ height: "200px", background: "var(--bg-canvas)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ fontSize: "4rem", opacity: 0.5 }}>{catConfig(item.category).emoji}</div>
                        )}
                        {/* New Badge */}
                        <div style={{ position: "absolute", top: "1rem", left: "1rem", background: "var(--brand-pink)", color: "#fff", padding: "0.3rem 0.8rem", borderRadius: "var(--r-full)", fontSize: "0.75rem", fontWeight: "800", boxShadow: "0 4px 10px rgba(233,30,99,0.3)" }}>⭐ New</div>
                        
                        {/* Favorite Button */}
                        <button onClick={(e) => toggleFavorite(item.id, e)} style={{ position: "absolute", top: "1rem", right: "1rem", background: "#fff", border: "none", width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 10px rgba(0,0,0,0.1)", color: favorites.includes(item.id) ? "var(--brand-pink)" : "var(--text-muted)", transition: "all 0.2s" }}>
                          <Heart fill={favorites.includes(item.id) ? "currentColor" : "none"} size={18} />
                        </button>
                      </div>

                      {/* Product Details */}
                      <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", flex: 1 }}>
                        <h4 style={{ fontSize: "1.1rem", fontWeight: "800", margin: "0 0 0.5rem", fontFamily: "var(--font-heading)", color: "var(--text-primary)", lineHeight: 1.3 }}>{item.name}</h4>
                        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "0 0 1.5rem", flex: 1, lineHeight: 1.5 }}>
                          {item.description || "Authentic traditional recipe, made with the finest ingredients."}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                          <span style={{ fontSize: "1.25rem", fontWeight: "900", color: "var(--text-primary)" }}>₹{item.price.toFixed(0)}</span>
                          
                          {(cart[item.id] || 0) > 0 ? (
                            <div style={{ display: "flex", alignItems: "center", background: "var(--bg-canvas)", border: "1px solid var(--border-default)", borderRadius: "var(--r-full)", overflow: "hidden" }}>
                              <button onClick={() => removeFromCart(item.id)} style={{ background: "none", border: "none", color: "var(--text-primary)", padding: "0.5rem 0.8rem", cursor: "pointer", fontWeight: "bold" }}><Minus size={14}/></button>
                              <span style={{ padding: "0 0.5rem", fontWeight: "800", fontSize: "0.9rem" }}>{cart[item.id]}</span>
                              <button onClick={() => addToCart(item.id)} style={{ background: "none", border: "none", color: "var(--text-primary)", padding: "0.5rem 0.8rem", cursor: "pointer", fontWeight: "bold" }}><Plus size={14}/></button>
                            </div>
                          ) : (
                            <button onClick={() => addToCart(item.id)} style={{ background: "var(--brand-pink)", color: "#fff", border: "none", padding: "0.6rem 1.25rem", borderRadius: "var(--r-full)", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 12px rgba(233,30,99,0.3)", transition: "all 0.2s" }}>
                              Add
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
            
            {filteredMenu.length === 0 && (
              <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
                <Search size={48} style={{ margin: "0 auto 1rem", opacity: 0.3 }} />
                <h3>No products found</h3>
                <p>Try adjusting your search or category filters.</p>
              </div>
            )}
          </>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <h2 style={{ fontSize: "2rem", fontWeight: "900", fontFamily: "var(--font-heading)", marginBottom: "2rem" }}>My Orders</h2>
            {orders.length === 0 ? (
              <div className="glass-card" style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
                <ShoppingBag size={48} style={{ margin: "0 auto 1rem", opacity: 0.3 }} />
                <h3>No orders yet</h3>
                <p>When you place an order, it will appear here.</p>
                <button onClick={() => setActiveTab("menu")} className="btn btn-primary" style={{ background: "var(--brand)", marginTop: "1rem" }}>Start Shopping</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {orders.map(order => (
                  <div key={order.id} className="glass-card" style={{ padding: "1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-light)", paddingBottom: "1rem", marginBottom: "1rem" }}>
                      <div>
                        <h4 style={{ margin: "0 0 0.25rem", fontSize: "1.1rem", fontWeight: "800" }}>Order #{order.id}</h4>
                        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{new Date(order.created_at).toLocaleString()}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
                        <span className={`badge-status status-${order.status}`}>{order.status}</span>
                        <span style={{ fontWeight: "900", fontSize: "1.2rem", color: "var(--brand)" }}>₹{parseFloat(order.total_price).toFixed(0)}</span>
                      </div>
                    </div>
                    <div>
                      {order.items.map((it, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", fontSize: "0.95rem" }}>
                          <span><span style={{ color: "var(--brand)", marginRight: "0.5rem", fontWeight: "700" }}>{it.quantity}x</span> {it.menu_item_name}</span>
                          <span style={{ fontWeight: "700" }}>₹{(it.price * it.quantity).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                    {order.status === 'delivered' && !order.receipt_confirmed && (
                      <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px dashed var(--border-light)", display: "flex", gap: "0.5rem" }}>
                        <input type="text" placeholder="Tracking code" value={trackingCodes[order.id] || ""} onChange={e => setTrackingCodes({...trackingCodes, [order.id]: e.target.value})} className="form-input" style={{ flex: 1, background: "var(--bg-canvas)" }} />
                        <button onClick={() => handleConfirmReceipt(order.id)} className="btn btn-success" style={{ background: "var(--brand)" }}>Confirm</button>
                      </div>
                    )}
                    <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                      <button onClick={(e) => handleQuickReorder(order.items, e)} className="btn btn-outline" style={{ borderColor: "var(--brand-pink)", color: "var(--brand-pink)", background: "transparent" }}>Reorder Items</button>
                      <button onClick={() => handleDownloadReceipt(order)} className="btn btn-secondary" style={{ background: "var(--bg-canvas)" }}><FileText size={16}/> Invoice</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Support Tab */}
        {activeTab === "tickets" && (
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
              <h2 style={{ fontSize: "2rem", fontWeight: "900", fontFamily: "var(--font-heading)", margin: 0 }}>Support Tickets</h2>
              <button onClick={() => handleReportIssue(null)} className="btn btn-primary" style={{ background: "var(--brand-pink)", borderRadius: "var(--r-full)", padding: "0.6rem 1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}><Plus size={16} /> New Ticket</button>
            </div>
            
            {tickets.length === 0 ? (
              <div className="glass-card" style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
                <MessageSquare size={48} style={{ margin: "0 auto 1rem", opacity: 0.3 }} />
                <h3>No support tickets</h3>
                <p>Need help? Create a new ticket and we'll get back to you.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {tickets.map(t => (
                  <div key={t.id} className="glass-card" style={{ padding: "1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <h4 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "800" }}>{t.issue_type}</h4>
                      <span className={`badge-status status-${t.status === 'open' ? 'warning' : 'success'}`}>{t.status}</span>
                    </div>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: "0 0 1rem" }}>{t.description}</p>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "600" }}>{new Date(t.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 🛒 Checkout / Cart Drawer */}
      {showCartDrawer && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }} onClick={() => setShowCartDrawer(false)}>
          <div className="animate-slide-in-right" style={{ width: "100%", maxWidth: "450px", height: "100%", background: "var(--bg-canvas)", display: "flex", flexDirection: "column", boxShadow: "-5px 0 25px rgba(0,0,0,0.1)" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "1.5rem", background: "var(--bg-card)", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1.25rem", fontWeight: "900", margin: 0, fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>Your Basket</h3>
              <button onClick={() => setShowCartDrawer(false)} style={{ background: "var(--bg-hover)", border: "none", width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-primary)" }}><X size={18} /></button>
            </div>
            
            <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
              {getCartCount() === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-muted)" }}>
                  <ShoppingBag size={48} style={{ margin: "0 auto 1rem", opacity: 0.3 }} />
                  <h4>Your basket is empty</h4>
                  <p style={{ fontSize: "0.9rem" }}>Looks like you haven't added anything yet.</p>
                  <button onClick={() => setShowCartDrawer(false)} className="btn btn-primary" style={{ background: "var(--brand-pink)", marginTop: "1rem", borderRadius: "var(--r-full)" }}>Start Shopping</button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
                    {Object.entries(cart).map(([id, qty]) => {
                      const item = menu.find(m => m.id === parseInt(id));
                      if(!item) return null;
                      return (
                        <div key={id} style={{ display: "flex", gap: "1rem", background: "var(--bg-card)", padding: "1rem", borderRadius: "var(--r-md)", border: "1px solid var(--border-light)" }}>
                          <div style={{ width: "60px", height: "60px", borderRadius: "var(--r-sm)", background: "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>
                            {item.image_url ? <img src={item.image_url} style={{width:"100%", height:"100%", objectFit:"cover", borderRadius:"var(--r-sm)"}} /> : catConfig(item.category).emoji}
                          </div>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.95rem", fontWeight: "800", color: "var(--text-primary)" }}>{item.name}</h4>
                            <div style={{ fontSize: "0.95rem", fontWeight: "900", color: "var(--brand)" }}>₹{item.price.toFixed(0)}</div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.5rem" }}>
                              <div style={{ display: "flex", alignItems: "center", background: "var(--bg-canvas)", border: "1px solid var(--border-default)", borderRadius: "var(--r-full)" }}>
                                <button onClick={() => removeFromCart(item.id)} style={{ background: "none", border: "none", padding: "0.2rem 0.6rem", cursor: "pointer", fontWeight: "bold" }}><Minus size={12}/></button>
                                <span style={{ fontSize: "0.85rem", fontWeight: "800" }}>{qty}</span>
                                <button onClick={() => addToCart(item.id)} style={{ background: "none", border: "none", padding: "0.2rem 0.6rem", cursor: "pointer", fontWeight: "bold" }}><Plus size={12}/></button>
                              </div>
                              <button onClick={() => setCart(p => { const n={...p}; delete n[item.id]; return n; })} style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", fontSize: "0.8rem", fontWeight: "700" }}>Remove</button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Delivery Address */}
                  <div style={{ background: "var(--bg-card)", padding: "1.25rem", borderRadius: "var(--r-md)", border: "1px solid var(--border-light)", marginBottom: "1.5rem" }}>
                    <h4 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: "800", color: "var(--text-primary)" }}>Delivery Address</h4>
                    <select value={selectedAddressId} onChange={e => {
                      const id = parseInt(e.target.value);
                      setSelectedAddressId(id);
                      const addr = addresses.find(a => a.id === id);
                      setCheckoutAddress(addr ? addr.address : "");
                    }} className="form-input" style={{ marginBottom: "0.5rem", background: "var(--bg-canvas)", border: "1px solid var(--border-default)" }}>
                      {addresses.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                      <option value="-1">Custom Address</option>
                    </select>
                    <textarea value={checkoutAddress} onChange={e => setCheckoutAddress(e.target.value)} className="form-input" rows="2" style={{ background: "var(--bg-canvas)", resize: "none", border: "1px solid var(--border-default)" }} placeholder="Enter full address..." />
                  </div>

                  {/* Payment Method */}
                  <div style={{ background: "var(--bg-card)", padding: "1.25rem", borderRadius: "var(--r-md)", border: "1px solid var(--border-light)", marginBottom: "1.5rem" }}>
                    <h4 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: "800", color: "var(--text-primary)" }}>Payment Method</h4>
                    <div style={{ display: "flex", gap: "0.5rem", flexDirection: "column" }}>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {["COD", "UPI", "CARD"].map(method => (
                          <button key={method} onClick={() => setPaymentMethod(method)} style={{ flex: 1, padding: "0.75rem 0", background: paymentMethod === method ? "var(--brand)" : "var(--bg-canvas)", color: paymentMethod === method ? "#fff" : "var(--text-primary)", border: paymentMethod === method ? "1px solid var(--brand)" : "1px solid var(--border-default)", borderRadius: "var(--r-sm)", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer", transition: "all 0.2s" }}>
                            {method}
                          </button>
                        ))}
                      </div>
                      
                      {paymentMethod === "CARD" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "1rem" }}>
                          <input type="text" className="form-input" placeholder="Cardholder Name" value={cardName} onChange={e => setCardName(e.target.value)} style={{ background: "var(--bg-canvas)" }}/>
                          <input type="text" className="form-input" placeholder="0000 0000 0000 0000" maxLength={19} value={cardNumber} onChange={e => { const v = e.target.value.replace(/\D/g,""); setCardNumber(v.match(/.{1,4}/g)?.join(" ") || ""); }} style={{ background: "var(--bg-canvas)" }}/>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                            <input type="text" className="form-input" placeholder="MM/YY" maxLength={5} value={cardExpiry} onChange={e => { let v = e.target.value.replace(/\D/g,""); if(v.length>2) v = v.substring(0,2)+"/"+v.substring(2); setCardExpiry(v); }} style={{ background: "var(--bg-canvas)" }}/>
                            <input type="password" className="form-input" placeholder="CVV" maxLength={3} value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g,""))} style={{ background: "var(--bg-canvas)" }}/>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Total Footer */}
            {getCartCount() > 0 && (
              <div style={{ padding: "1.5rem", background: "var(--bg-card)", borderTop: "1px solid var(--border-light)", boxShadow: "0 -4px 12px rgba(0,0,0,0.03)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.9rem", fontWeight: "600" }}>
                  <span>Subtotal</span><span>₹{getCartTotal().toFixed(0)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem", color: "var(--text-secondary)", fontSize: "0.9rem", fontWeight: "600" }}>
                  <span>Delivery</span><span>{getCartTotal() >= 499 ? "FREE" : "₹49"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem", fontWeight: "900", fontSize: "1.25rem", color: "var(--text-primary)" }}>
                  <span>Total</span><span style={{ color: "var(--brand)" }}>₹{finalTotal.toFixed(0)}</span>
                </div>
                <button onClick={handlePlaceOrder} disabled={paymentProcessing} className="btn btn-primary btn-block" style={{ background: "var(--brand-pink)", padding: "1rem", fontSize: "1.1rem", borderRadius: "var(--r-full)", boxShadow: "0 4px 15px rgba(233,30,99,0.3)" }}>
                  {paymentProcessing ? "Processing..." : `Checkout ₹${finalTotal.toFixed(0)}`}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Profile Modal */}
      {showProfileModal && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }} onClick={() => setShowProfileModal(false)}>
          <div className="glass-card" onClick={e => e.stopPropagation()} style={{ width: "90%", maxWidth: "450px", padding: "2rem", borderRadius: "var(--r-xl)", background: "var(--bg-card)" }}>
            <h3 style={{ margin: "0 0 1.5rem", fontSize: "1.5rem", fontWeight: "900", fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>My Profile</h3>
            <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <input type="text" placeholder="First Name" className="form-input" value={profileForm.first_name} onChange={e => setProfileForm({...profileForm, first_name: e.target.value})} style={{ background: "var(--bg-canvas)" }} />
                <input type="text" placeholder="Last Name" className="form-input" value={profileForm.last_name} onChange={e => setProfileForm({...profileForm, last_name: e.target.value})} style={{ background: "var(--bg-canvas)" }} />
              </div>
              <input type="tel" placeholder="Phone" className="form-input" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} style={{ background: "var(--bg-canvas)" }} />
              <textarea placeholder="Address" className="form-input" value={profileForm.address} onChange={e => setProfileForm({...profileForm, address: e.target.value})} style={{ background: "var(--bg-canvas)" }} />
              <button type="submit" disabled={profileUpdating} className="btn btn-primary" style={{ background: "var(--brand)", padding: "1rem", borderRadius: "var(--r-full)", marginTop: "1rem", fontSize: "1.05rem" }}>Save Profile</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Ticket Modal */}
      {isTicketModalOpen && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(4px)" }}>
          <div className="glass-card" style={{ padding: "2rem", width: "100%", maxWidth: "500px", borderRadius: "var(--r-xl)", position: "relative" }}>
            <button onClick={() => setIsTicketModalOpen(false)} style={{ position: "absolute", top: "1rem", right: "1rem", background: "var(--bg-hover)", border: "none", borderRadius: "50%", padding: "0.5rem", cursor: "pointer", color: "var(--text-primary)" }}>
              <X size={18} />
            </button>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", fontWeight: 900, marginBottom: "1.5rem", color: "var(--text-primary)" }}>
              {ticketForm.id ? "Edit Ticket" : "New Ticket"}
            </h2>
            <form onSubmit={handleTicketSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <input type="text" className="form-input" required value={ticketForm.issue_type} onChange={e => setTicketForm({ ...ticketForm, issue_type: e.target.value })} placeholder="Issue Summary" style={{ background: "var(--bg-canvas)" }} />
              <textarea className="form-input" required rows="4" value={ticketForm.description} onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })} placeholder="Details of the issue..." style={{ background: "var(--bg-canvas)", resize: "none" }} />
              <button type="submit" className="btn btn-primary" style={{ background: "var(--brand)", marginTop: "1rem", padding: "1rem", borderRadius: "var(--r-full)" }}>
                {ticketForm.id ? "Update Ticket" : "Submit Ticket"}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Dynamic Popup Banner */}
      {showPopupBanner && popupBanner && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }} onClick={() => { setShowPopupBanner(false); sessionStorage.setItem("popupDismissed_" + popupBanner.id, "true"); }}>
          <div className="glass-card" onClick={e => e.stopPropagation()} style={{ width: "90%", maxWidth: "400px", padding: "2rem", borderRadius: "var(--r-xl)", position: "relative", textAlign: "center" }}>
            <button onClick={() => { setShowPopupBanner(false); sessionStorage.setItem("popupDismissed_" + popupBanner.id, "true"); }} style={{ position: "absolute", top: "1rem", right: "1rem", background: "rgba(0,0,0,0.1)", border: "none", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-primary)" }}><X size={16}/></button>
            <Sparkles size={48} color="var(--brand-pink)" style={{ margin: "0 auto 1rem" }} />
            <h2 style={{ fontSize: "1.75rem", fontWeight: "900", fontFamily: "var(--font-heading)", margin: "0 0 1rem", color: "var(--text-primary)" }}>{popupBanner.title}</h2>
            {popupBanner.image_url && <img src={popupBanner.image_url} style={{ width: "100%", borderRadius: "var(--r-md)", marginBottom: "1rem" }}/>}
            <button onClick={() => { setShowPopupBanner(false); sessionStorage.setItem("popupDismissed_" + popupBanner.id, "true"); if(popupBanner.target_url) window.location.href=popupBanner.target_url; }} className="btn btn-primary btn-block" style={{ background: "var(--brand-pink)", padding: "1rem", borderRadius: "var(--r-full)", fontSize: "1.1rem" }}>Explore Now</button>
          </div>
        </div>,
        document.body
      )}

      {/* Toasts */}
      {toast && (
        <div style={{ position: "fixed", bottom: "2rem", right: "2rem", background: toast.type === "success" ? "var(--brand)" : "var(--error)", color: "#fff", padding: "1rem 1.5rem", borderRadius: "var(--r-md)", boxShadow: "0 10px 30px rgba(0,0,0,0.2)", zIndex: 99999, fontWeight: "700", display: "flex", alignItems: "center", gap: "1rem" }}>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", display: "flex" }}><X size={16}/></button>
        </div>
      )}
      
    </div>
  );
}
"""

with open(r'd:\python project\food\frontend-customer\src\components\CustomerView.jsx.new', 'w', encoding='utf-8') as f:
    f.writelines(header_lines)
    f.write(new_jsx)
