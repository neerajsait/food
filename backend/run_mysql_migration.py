"""Run this script to complete the MySQL migration."""
import pymysql
from dotenv import load_dotenv
load_dotenv()
import os
import sys

db_user = os.getenv('MYSQL_USER')
db_password = os.getenv('MYSQL_PASSWORD')
db_host = os.getenv('MYSQL_HOST', 'localhost')
db_name = os.getenv('MYSQL_DB', 'food')

if not db_user or not db_password:
    print("ERROR: MYSQL_USER and MYSQL_PASSWORD environment variables are required.")
    sys.exit(1)

conn = pymysql.connect(
    host=db_host,
    user=db_user,
    password=db_password,
    database=db_name,
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

for col, defn in [
    ('loyalty_points', 'INT NOT NULL DEFAULT 0'),
    ('outlet_id', 'INT NULL'),
    ('pin_hash', 'VARCHAR(255) NULL'),
    ('staff_code', 'VARCHAR(10) NULL UNIQUE'),
    ('referral_code', 'VARCHAR(20) NULL UNIQUE'),
    ('referred_by_id', 'INT NULL')
]:
    if not col_exists('users', col):
        c.execute(f"ALTER TABLE `users` ADD COLUMN `{col}` {defn}")
        conn.commit()
        print(f"Added users.{col}")
    else:
        print(f"users.{col} already exists")

# --- 5. Add columns to menu_items ---
for col, defn in [
    ('code', 'VARCHAR(20) NULL UNIQUE'),
    ('is_veg', 'BOOLEAN NOT NULL DEFAULT 1'),
    ('is_gluten_free', 'BOOLEAN NOT NULL DEFAULT 0'),
    ('spice_level', 'VARCHAR(20) NOT NULL DEFAULT "medium"')
]:
    if not col_exists('menu_items', col):
        c.execute(f"ALTER TABLE `menu_items` ADD COLUMN `{col}` {defn}")
        conn.commit()
        print(f"Added menu_items.{col}")
    else:
        print(f"menu_items.{col} already exists")

# --- 6. Add attachment_url to support_tickets ---
if not col_exists('support_tickets', 'attachment_url'):
    c.execute("ALTER TABLE `support_tickets` ADD COLUMN `attachment_url` VARCHAR(255) NULL")
    conn.commit()
    print("Added support_tickets.attachment_url")
else:
    print("support_tickets.attachment_url already exists")

# --- 7. Add columns to coupons ---
for col, defn in [
    ('discount_amount', 'DECIMAL(10, 2) NULL'),
    ('max_discount_amount', 'DECIMAL(10, 2) NULL'),
    ('applicable_menu_item_id', 'INT NULL'),
    ('applicable_customer_id', 'INT NULL')
]:
    if not col_exists('coupons', col):
        c.execute(f"ALTER TABLE `coupons` ADD COLUMN `{col}` {defn}")
        conn.commit()
        print(f"Added coupons.{col}")
    else:
        print(f"coupons.{col} already exists")

# Add foreign keys for coupons if missing
try:
    c.execute("SHOW CREATE TABLE coupons")
    create_stmt = c.fetchone()[1]
    if 'fk_coupons_menu_item_id' not in create_stmt:
        c.execute("ALTER TABLE `coupons` ADD CONSTRAINT `fk_coupons_menu_item_id` FOREIGN KEY (`applicable_menu_item_id`) REFERENCES `menu_items` (`id`) ON DELETE CASCADE")
        conn.commit()
        print("Added fk_coupons_menu_item_id")
    if 'fk_coupons_customer_id' not in create_stmt:
        c.execute("ALTER TABLE `coupons` ADD CONSTRAINT `fk_coupons_customer_id` FOREIGN KEY (`applicable_customer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE")
        conn.commit()
        print("Added fk_coupons_customer_id")
except Exception as e:
    print(f"FK constraint check/add failed on coupons: {e}")

# --- 8. Migrate banners table ---
# Modify image_url column in banners to MEDIUMTEXT to allow base64 images
try:
    c.execute("ALTER TABLE `banners` MODIFY COLUMN `image_url` MEDIUMTEXT NOT NULL")
    conn.commit()
    print("Modified banners.image_url to MEDIUMTEXT")
except Exception as e:
    print(f"Failed to modify banners.image_url: {e}")

# Add display_location column to banners if missing
if not col_exists('banners', 'display_location'):
    try:
        c.execute("ALTER TABLE `banners` ADD COLUMN `display_location` VARCHAR(100) NOT NULL DEFAULT 'home'")
        conn.commit()
        print("Added banners.display_location")
    except Exception as e:
        print(f"Failed to add banners.display_location: {e}")
else:
    print("banners.display_location already exists")

conn.close()
print("Migration complete!")
