import sqlite3
import os

DB_PATH = os.path.join("instance", "food.db")

def run_migration():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("Starting migration...")

    # 1. Add order_type and staff_id to orders if not exists
    for col, definition in [
        ("order_type", "VARCHAR(20) DEFAULT 'online'"),
        ("staff_id", "INTEGER"),
        ("outlet_id", "INTEGER"),
        ("loyalty_points_earned", "INTEGER DEFAULT 0"),
        ("loyalty_points_redeemed", "INTEGER DEFAULT 0"),
        ("payment_method", "VARCHAR(50) DEFAULT 'COD'"),
        ("delivery_address", "VARCHAR(500)"),
        ("cancel_reason", "VARCHAR(255)"),
        ("tracking_label", "TEXT"),
        ("tracking_link", "VARCHAR(500)")
    ]:
        try:
            cursor.execute(f"ALTER TABLE orders ADD COLUMN {col} {definition}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" not in str(e):
                print(f"Error adding {col} to orders: {e}")

    # 2. Migrate POS sales to orders
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='pos_sales'")
    if cursor.fetchone():
        print("Migrating pos_sales...")
        try:
            cursor.execute("ALTER TABLE orders ADD COLUMN old_pos_id INTEGER")
        except sqlite3.OperationalError:
            pass

        cursor.execute("UPDATE orders SET old_pos_id = NULL")

        cursor.execute("""
            INSERT INTO orders (
                outlet_id, staff_id, status, total_price, payment_method,
                is_received, created_at, updated_at, order_type,
                loyalty_points_earned, loyalty_points_redeemed, old_pos_id
            )
            SELECT 
                outlet_id, staff_id, 'completed', total_amount, payment_method,
                1, created_at, created_at, 'pos',
                0, 0, id
            FROM pos_sales
        """)
        
        cursor.execute("""
            INSERT INTO order_items (
                order_id, menu_item_id, quantity, price
            )
            SELECT 
                o.id, psi.menu_item_id, psi.quantity, psi.price
            FROM pos_sale_items psi
            JOIN orders o ON psi.sale_id = o.old_pos_id
        """)

        cursor.execute("DROP TABLE pos_sale_items")
        cursor.execute("DROP TABLE pos_sales")
        print("pos_sales and pos_sale_items migrated and dropped.")
    
    # 3. Add STI columns to users if not exists
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'customer'")
    except sqlite3.OperationalError as e:
        if "duplicate column name" not in str(e):
            print(f"Error adding role to users: {e}")
            
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN loyalty_points INTEGER DEFAULT 0")
        cursor.execute("ALTER TABLE users ADD COLUMN outlet_id INTEGER")
        cursor.execute("ALTER TABLE users ADD COLUMN pin_hash VARCHAR(255)")
    except sqlite3.OperationalError as e:
        if "duplicate column name" not in str(e):
            pass

    # 4. Create reviews table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        menu_item_id INTEGER,
        order_id INTEGER,
        customer_id INTEGER NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT,
        is_hidden BOOLEAN DEFAULT 0,
        admin_reply TEXT,
        created_at DATETIME,
        FOREIGN KEY (menu_item_id) REFERENCES menu_items (id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES users (id) ON DELETE CASCADE
    )
    ''')

    # Migrate feedbacks to reviews
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='feedbacks'")
    if cursor.fetchone():
        cursor.execute("""
            INSERT INTO reviews (
                order_id, customer_id, rating, comment, created_at
            )
            SELECT 
                order_id, customer_id, rating, comment, created_at
            FROM feedbacks
        """)
        cursor.execute("DROP TABLE feedbacks")
        print("feedbacks migrated and dropped.")

    # Migrate menu_item_reviews to reviews
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='menu_item_reviews'")
    if cursor.fetchone():
        cursor.execute("""
            INSERT INTO reviews (
                menu_item_id, customer_id, rating, comment, is_hidden, admin_reply, created_at
            )
            SELECT 
                menu_item_id, customer_id, rating, comment, is_hidden, admin_reply, created_at
            FROM menu_item_reviews
        """)
        cursor.execute("DROP TABLE menu_item_reviews")
        print("menu_item_reviews migrated and dropped.")
        
    conn.commit()
    conn.close()
    print("Migration completed successfully.")

if __name__ == '__main__':
    run_migration()
