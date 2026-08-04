# 🍛 FlavorFlow ERP Platform

[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Flask](https://img.shields.io/badge/Backend-Flask%20(Python)-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![SQLAlchemy](https://img.shields.io/badge/ORM-SQLAlchemy-D71105?style=for-the-badge&logo=redhat&logoColor=white)](https://www.sqlalchemy.org/)
[![Database](https://img.shields.io/badge/Database-SQLite%20%2F%20MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)

FlavorFlow is a comprehensive, multi-portal food enterprise platform designed for managing the end-to-end flow of homemade foods and retail snack supply chain networks. It seamlessly integrates a B2C customer portal with a powerful B2B admin/staff dashboard, offering features ranging from dynamic e-commerce, interactive POS cashier terminals, and loyalty programs, to automated background email reports, strict ACID-compliant wallet transactions, and secure QR-based stock dispatch labeling.

---

## 📂 Repository Structure

The project is structured into a unified Flask backend API and two distinct React single-page applications.

```directory
food/
├── backend/                  # Flask REST API (Python)
│   ├── app.py                # Main server entrypoint (Endpoints, Schedulers)
│   ├── models.py             # SQLAlchemy Database Models & Relationships
│   └── requirements.txt      # Python dependencies
├── frontend-admin/           # React (Vite) SPA for Admin & Staff (POS)
│   ├── src/components/       # Admin dashboards, POS terminal, Kitchen views
│   └── package.json          # Node dependencies
├── frontend-customer/        # React (Vite) SPA for B2C Customers
│   ├── src/components/       # Customer storefront, checkout, wallet, support tickets
│   └── package.json          # Node dependencies
└── README.md                 # Project documentation
```

---

## ✨ Comprehensive Feature Set

### 1. 🛍️ Customer Portal (`frontend-customer`)
Designed with a premium glassmorphic visual theme, providing a complete B2C e-commerce experience.
* **Loyalty & Wallet System:** Customers earn points on purchases and can redeem points at checkout. Full transaction history is tracked in a Wallet Ledger. Cancellations automatically trigger accurate, atomic points refunds.
* **Referral Program:** Users can refer friends using unique referral codes to earn bonus loyalty points.
* **Dynamic Menu & Reviews:** Browse categorized food items, view dynamic average ratings, and submit verified reviews.
* **Customer Support:** Integrated ticketing system allows users to submit queries and read replies from the admin.
* **Dynamic Marketing Banners:** Displays active promotions, banners, and store-wide settings directly fetched from the backend.
* **Address Management:** Save multiple delivery addresses and set a default for quick checkouts.

### 2. 🛡️ Admin & Outlet Management (`frontend-admin`)
A robust command center for enterprise owners and regional managers.
* **Revenue & Sales Analytics:** View deep sales analytics, profit margins, and B2B revenue-share splits across all outlets.
* **Supply Chain & Stock Requests:** Manage B2B suppliers, track inventory limits, approve/reject stock requests from retail outlets, and restock batches.
* **Customer Segments & Marketing:** Analyze customer segments (e.g., VIP, Active, At-Risk) and send targeted broadcast emails or bulk discount coupons.
* **Audit Logging:** Track critical business events (stock disposals, price changes, admin actions) in a secure audit log.

### 3. 🏪 Staff POS & Kitchen Workflows
* **Automated Staff Timesheets:** Staff members are automatically "Clocked In" securely in the background when they log into the system using their PIN, and "Clocked Out" upon logging out, generating accurate shift timesheets.
* **Interactive POS Terminal:** Cashiers process in-store sales using an interactive Point of Sale UI, supporting Cash and **Scan-to-Pay UPI** overlays.
* **Live Shift Reports:** Calculates cash drawer totals, UPI receipts, and sales margins at the end of every active shift.
* **Kitchen Display System (KDS):** Kitchen staff can monitor incoming orders in real-time, prepare batches, and update production statuses.
* **Cryptographic QR Scanning:** Outlets scan incoming stock dispatch labels. QR codes are signed using **HMAC SHA256** checksums tied to the server's `SECRET_KEY` to prevent stock forgery.

### 4. ⚙️ Robust Backend Architecture
* **ACID Transactions:** Financial operations, like order cancellations and loyalty point ledger adjustments, are wrapped in strict SQLAlchemy `.with_for_update()` database locks to prevent race conditions and ensure data integrity.
* **Asynchronous Emails:** Automated HTML emails (Order Confirmations, Welcome Emails, Shipment Tracking) are offloaded to background threads, guaranteeing fast, non-blocking API responses for the user.
* **Background Schedulers:** Uses `APScheduler` to run recurring tasks, such as generating and emailing HTML Daily Digest performance reports to outlet owners every night at 22:00 IST.
* **Database Agnostic:** Uses SQLAlchemy ORM. Fully supports SQLite for local development and MySQL for production deployments.

---

## 🚀 Getting Started

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Configure your environment variables in `.env` (SMTP credentials for emails, database URI, and Flask `SECRET_KEY`).
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the Flask application:
   ```bash
   python app.py
   ```
   * *The Flask server runs on `http://localhost:5000`.*

### 2. Frontend Setup (Admin & Customer)
You need to run both frontend applications concurrently. Open two separate terminal windows.

**For the Admin Portal:**
```bash
cd frontend-admin
npm install
npm run dev
```
* *Vite dev server runs on `http://localhost:5173`.*

**For the Customer Portal:**
```bash
cd frontend-customer
npm install
npm run dev
```
* *Vite dev server runs on `http://localhost:5174`.*

---

## 📋 Production Deployment Checklist

Before deploying this application to production, ensure you complete the following critical steps:

- [ ] **FLASK_ENV**: Set `FLASK_ENV=production` in the backend `.env` file.
- [ ] **Secrets**: Change the default `SECRET_KEY` and `JWT_SECRET_KEY` to secure, random cryptographic strings.
- [ ] **Passwords**: Change the default admin password (`admin/admin`). **Crucially**, remove the demo "quick-login" buttons from the Login components to prevent unauthorized access.
- [ ] **Mail Server**: Configure SMTP parameters in `.env` with a real SMTP provider (e.g., Gmail App Password, SendGrid, AWS SES) to enable order confirmations, password resets, and digest emails.
- [ ] **SSL (HTTPS)**: Serve the application over HTTPS. The QR Scanner functionality utilizes modern browser Camera APIs which are strictly blocked on non-HTTPS origins in production.
- [ ] **Database**: Migrate from SQLite to a robust production database like MySQL or PostgreSQL by updating the `DATABASE_URI` in your `.env`.
