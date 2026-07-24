"""
MySQL Schema Migration Script
Applies the unified schema (Order, Review, STI User) to the MySQL database.
Run once: python migrate_mysql.py
"""
import os
from dotenv import load_dotenv
import pymysql

load_dotenv()

HOST = os.getenv("MYSQL_HOST", "localhost")
USER = os.getenv("MYSQL_USER", "root")
PASSWORD = os.getenv("MYSQL_PASSWORD", "root")
DB = os.getenv("MYSQL_DB", "food")


def column_exists(cursor, table, column):
    cursor.execute(
        "SELECT COUNT(*) FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA=%s AND TABLE_NAME=%s AND COLUMN_NAME=%s",
        (DB, table, column)
    )
    return cursor.fetchone()[0] > 0


def table_exists(cursor, table):
    cursor.execute(
        "SELECT COUNT(*) FROM information_schema.TABLES "
        "WHERE TABLE_SCHEMA=%s AND TABLE_NAME=%s",
        (DB, table)
    )
    return cursor.fetchone()[0] > 0


def add_column_if_missing(cursor, table, column, definition):
    if not column_exists(cursor, table, column):
        print(f"  Adding column {table}.{column}...")
        cursor.execute(f"ALTER TABLE `{table}` ADD COLUMN `{column}` {definition}")
    else:
        print(f"  Column {table}.{column} already exists, skipping.")


def run_migration():
    conn = pymysql.connect(host=HOST, user=USER, password=PASSWORD, database=DB, charset='utf8mb4')
    cursor = conn.cursor()

    print("=" * 60)
    print("Starting MySQL schema migration...")
    print("=" * 60)

    # ---------------------------------------------------------------
    # 1. Extend the `orders` table with POS-specific columns
    # ---------------------------------------------------------------
    print("\n[1] Extending `orders` table...")
    add_column_if_missing(cursor, "orders", "order_type",              "VARCHAR(20) NOT NULL DEFAULT 'online'")
    add_column_if_missing(cursor, "orders", "outlet_id",               "INT NULL")
    add_column_if_missing(cursor, "orders", "staff_id",                "INT NULL")
    add_column_if_missing(cursor, "orders", "payment_method",          "VARCHAR(50) NOT NULL DEFAULT 'COD'")
    add_column_if_missing(cursor, "orders", "loyalty_points_earned",   "INT NOT NULL DEFAULT 0")
    add_column_if_missing(cursor, "orders", "loyalty_points_redeemed", "INT NOT NULL DEFAULT 0")
    add_column_if_missing(cursor, "orders", "cancel_reason",           "VARCHAR(255) NULL")
    add_column_if_missing(cursor, "orders", "delivery_address",        "VARCHAR(500) NULL")
    add_column_if_missing(cursor, "orders", "tracking_label",          "TEXT NULL")
    add_column_if_missing(cursor, "orders", "tracking_link",           "VARCHAR(500) NULL")
    conn.commit()

    # ---------------------------------------------------------------
    # 2. Migrate pos_sales → orders  (only if pos_sales table exists)
    # ---------------------------------------------------------------
    if table_exists(cursor, "pos_sales"):
        print("\n[2] Migrating pos_sales → orders...")

        # Get columns available in pos_sales
        cursor.execute("DESCRIBE pos_sales")
        pos_cols = {row[0] for row in cursor.fetchall()}
        print(f"  pos_sales columns: {pos_cols}")

        # Build dynamic SELECT based on what columns actually exist
        has_customer = "customer_id" in pos_cols
        has_loyalty  = "loyalty_points_earned" in pos_cols and "loyalty_points_redeemed" in pos_cols
        has_updated  = "updated_at" in pos_cols

        customer_sel = "ps.customer_id," if has_customer else ""
        loyalty_sel  = "ps.loyalty_points_earned, ps.loyalty_points_redeemed," if has_loyalty else "0, 0,"
        updated_sel  = "ps.updated_at," if has_updated else "ps.created_at,"
        customer_col = "customer_id," if has_customer else ""
        loyalty_col  = "loyalty_points_earned, loyalty_points_redeemed,"

        # nosec - f-string is safe here because it only interpolates schema column names, not user data
        sql = f"""
            INSERT INTO orders (
                {customer_col}
                outlet_id, staff_id, status, total_price,
                payment_method, is_received, created_at, updated_at,
                order_type, {loyalty_col} is_paid
            )
            SELECT
                {customer_sel}
                ps.outlet_id, ps.staff_id, 'completed', ps.total_amount,
                ps.payment_method, 1, ps.created_at, {updated_sel}
                'pos', {loyalty_sel} 1
            FROM pos_sales ps
        """
        cursor.execute(sql)
        migrated = cursor.rowcount
        print(f"  Migrated {migrated} pos_sale rows into orders.")

        # Migrate pos_sale_items → order_items
        if table_exists(cursor, "pos_sale_items"):
            print("  Migrating pos_sale_items → order_items...")
            cursor.execute("""
                INSERT INTO order_items (order_id, menu_item_id, quantity, price)
                SELECT o.id, psi.menu_item_id, psi.quantity, psi.price
                FROM pos_sale_items psi
                JOIN orders o ON o.outlet_id = (
                    SELECT ps2.outlet_id FROM pos_sales ps2 WHERE ps2.id = psi.sale_id
                )
                AND o.order_type = 'pos'
                AND o.created_at = (
                    SELECT ps3.created_at FROM pos_sales ps3 WHERE ps3.id = psi.sale_id
                )
            """)
            print(f"  Migrated {cursor.rowcount} pos_sale_item rows into order_items.")

            cursor.execute("DROP TABLE pos_sale_items")
            print("  Dropped pos_sale_items table.")

        cursor.execute("DROP TABLE pos_sales")
        print("  Dropped pos_sales table.")
        conn.commit()
    else:
        print("\n[2] pos_sales table not found — skipping POS migration.")

    # ---------------------------------------------------------------
    # 3. Extend `users` table for STI
    # ---------------------------------------------------------------
    print("\n[3] Extending `users` table for Single Table Inheritance...")
    add_column_if_missing(cursor, "users", "loyalty_points", "INT NOT NULL DEFAULT 0")
    add_column_if_missing(cursor, "users", "outlet_id",      "INT NULL")
    add_column_if_missing(cursor, "users", "pin_hash",       "VARCHAR(255) NULL")
    conn.commit()

    # ---------------------------------------------------------------
    # 4. Create unified `reviews` table
    # ---------------------------------------------------------------
    print("\n[4] Creating `reviews` table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reviews (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            menu_item_id INT NULL,
            order_id    INT NULL,
            customer_id INT NOT NULL,
            rating      INT NOT NULL,
            comment     TEXT NULL,
            is_hidden   TINYINT(1) NOT NULL DEFAULT 0,
            admin_reply TEXT NULL,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
            FOREIGN KEY (order_id)    REFERENCES orders(id)      ON DELETE CASCADE,
            FOREIGN KEY (customer_id) REFERENCES users(id)       ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)
    conn.commit()
    print("  reviews table ready.")

    # ---------------------------------------------------------------
    # 5. Migrate feedbacks → reviews
    # ---------------------------------------------------------------
    if table_exists(cursor, "feedbacks"):
        print("\n[5] Migrating feedbacks → reviews...")
        cursor.execute("""
            INSERT INTO reviews (order_id, customer_id, rating, comment, created_at)
            SELECT order_id, customer_id, rating, comment, created_at
            FROM feedbacks
        """)
        print(f"  Migrated {cursor.rowcount} feedback rows.")
        cursor.execute("DROP TABLE feedbacks")
        print("  Dropped feedbacks table.")
        conn.commit()
    else:
        print("\n[5] feedbacks table not found — skipping.")

    # ---------------------------------------------------------------
    # 6. Migrate menu_item_reviews → reviews
    # ---------------------------------------------------------------
    if table_exists(cursor, "menu_item_reviews"):
        print("\n[6] Migrating menu_item_reviews → reviews...")
        cursor.execute("""
            INSERT INTO reviews (menu_item_id, customer_id, rating, comment, is_hidden, admin_reply, created_at)
            SELECT menu_item_id, customer_id, rating, comment, is_hidden, admin_reply, created_at
            FROM menu_item_reviews
        """)
        print(f"  Migrated {cursor.rowcount} menu_item_review rows.")
        cursor.execute("DROP TABLE menu_item_reviews")
        print("  Dropped menu_item_reviews table.")
        conn.commit()
    else:
        print("\n[6] menu_item_reviews table not found — skipping.")

    conn.close()
    print("\n" + "=" * 60)
    print("Migration completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    run_migration()
