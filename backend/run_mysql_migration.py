"""Run this script to complete the MySQL migration."""
import pymysql
from dotenv import load_dotenv
load_dotenv()
import os
conn = pymysql.connect(
    host=os.getenv('MYSQL_HOST', 'localhost'),
    user=os.getenv('MYSQL_USER', 'root'),
    password=os.getenv('MYSQL_PASSWORD', 'root'),
    database=os.getenv('MYSQL_DATABASE', 'food'),
    charset='utf8mb4'
)
c = conn.cursor()

def table_exists(name):
    c.execute("SHOW TABLES LIKE %s", (name,))
    return c.fetchone() is not None

def col_exists(table, col):
    c.execute("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='food' AND TABLE_NAME=%s AND COLUMN_NAME=%s", (table, col))
    return c.fetchone()[0] > 0

# --- 1. Migrate pos_sales ---
if table_exists('pos_sales'):
    # Make customer_id nullable so POS sales without a customer can be stored
    c.execute("ALTER TABLE orders MODIFY COLUMN customer_id INT NULL")
    conn.commit()
    print("Made orders.customer_id nullable")

    c.execute("DESCRIBE pos_sales")
    pos_cols = {row[0] for row in c.fetchall()}
    print("pos_sales cols:", pos_cols)

    has_customer = 'customer_id' in pos_cols

    c.execute("""
        INSERT INTO orders (customer_id, outlet_id, staff_id, status, total_price, payment_method,
         is_received, created_at, updated_at, order_type, loyalty_points_earned, loyalty_points_redeemed)
         SELECT customer_id, outlet_id, staff_id, 'completed', total_amount, payment_method,
         1, created_at, created_at, 'pos', loyalty_points_earned, loyalty_points_redeemed FROM pos_sales
    """)
    print(f"Migrated {c.rowcount} pos_sales rows")
    conn.commit()

    if table_exists('pos_sale_items'):
        c.execute("""
            INSERT INTO order_items (order_id, menu_item_id, quantity, price)
            SELECT o.id, psi.menu_item_id, psi.quantity, psi.price
            FROM pos_sale_items psi
            JOIN pos_sales ps ON ps.id = psi.sale_id
            JOIN orders o ON o.outlet_id <=> ps.outlet_id
                           AND o.staff_id <=> ps.staff_id
                           AND o.order_type = 'pos'
                           AND ABS(TIMESTAMPDIFF(SECOND, o.created_at, ps.created_at)) < 2
        """)
        print(f"Migrated {c.rowcount} pos_sale_items rows")
        conn.commit()
        c.execute("DROP TABLE pos_sale_items")
        conn.commit()
        print("Dropped pos_sale_items")

    c.execute("DROP TABLE pos_sales")
    conn.commit()
    print("Dropped pos_sales")
else:
    print("pos_sales not found, skipping")

# --- 2. Migrate feedbacks ---
if table_exists('feedbacks'):
    c.execute("INSERT INTO reviews (order_id, customer_id, rating, comment, created_at) SELECT order_id, customer_id, rating, comment, created_at FROM feedbacks")
    print(f"Migrated {c.rowcount} feedbacks")
    conn.commit()
    c.execute("DROP TABLE feedbacks")
    conn.commit()
    print("Dropped feedbacks")
else:
    print("feedbacks not found, skipping")

# --- 3. Migrate menu_item_reviews ---
if table_exists('menu_item_reviews'):
    c.execute("INSERT INTO reviews (menu_item_id, customer_id, rating, comment, is_hidden, admin_reply, created_at) SELECT menu_item_id, customer_id, rating, comment, is_hidden, admin_reply, created_at FROM menu_item_reviews")
    print(f"Migrated {c.rowcount} menu_item_reviews")
    conn.commit()
    c.execute("DROP TABLE menu_item_reviews")
    conn.commit()
    print("Dropped menu_item_reviews")
else:
    print("menu_item_reviews not found, skipping")

# --- 4. Add STI columns to users ---
for col, defn in [
    ('loyalty_points', 'INT NOT NULL DEFAULT 0'),
    ('outlet_id', 'INT NULL'),
    ('pin_hash', 'VARCHAR(255) NULL')
]:
    if not col_exists('users', col):
        c.execute(f"ALTER TABLE `users` ADD COLUMN `{col}` {defn}")
        conn.commit()
        print(f"Added users.{col}")
    else:
        print(f"users.{col} already exists")

conn.close()
print("Migration complete!")
