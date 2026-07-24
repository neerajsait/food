import os
import sqlalchemy
from dotenv import load_dotenv


def main():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")

    if not db_url:
        h = os.getenv("MYSQL_HOST")
        u = os.getenv("MYSQL_USER")
        p = os.getenv("MYSQL_PASSWORD")
        d = os.getenv("MYSQL_DB")
        if all([h, u, p, d]):
            db_url = "mysql+pymysql://{}:{}@{}/{}".format(u, p, h, d)
        else:
            db_url = "sqlite:///food.db"

    print("Connecting to database: {}".format(db_url))
    engine = sqlalchemy.create_engine(db_url)

    # All ALTER TABLE statements - safe to re-run; existing columns are skipped
    alter_queries = [
        # Existing ERP enhancements
        "ALTER TABLE menu_items ADD COLUMN global_stock INTEGER;",
        "ALTER TABLE menu_item_reviews ADD COLUMN is_hidden BOOLEAN DEFAULT 0;",
        "ALTER TABLE menu_item_reviews ADD COLUMN admin_reply TEXT;",
        "ALTER TABLE coupons ADD COLUMN expiry_date DATE;",
        "ALTER TABLE coupons ADD COLUMN usage_limit INTEGER;",
        "ALTER TABLE coupons ADD COLUMN usage_count INTEGER DEFAULT 0;",
        # Tracking link on orders (previous migration)
        "ALTER TABLE orders ADD COLUMN tracking_link VARCHAR(500);",
        "ALTER TABLE orders ADD COLUMN tracking_label TEXT;",
        "ALTER TABLE orders ADD COLUMN cancel_reason VARCHAR(255);",
        "ALTER TABLE orders ADD COLUMN delivery_address VARCHAR(500);",
        "ALTER TABLE orders ADD COLUMN payment_method VARCHAR(50) DEFAULT 'COD';",
        # 4-digit product code on menu items
        "ALTER TABLE menu_items ADD COLUMN code VARCHAR(4);",
        "ALTER TABLE menu_items ADD COLUMN original_price NUMERIC(10,2);",
        # Staff shift & loyalty features
        "ALTER TABLE users ADD COLUMN pin_hash VARCHAR(255);",
        "ALTER TABLE users ADD COLUMN loyalty_points INTEGER DEFAULT 0;",
        "ALTER TABLE pos_sales ADD COLUMN customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL;",
        "ALTER TABLE pos_sales ADD COLUMN loyalty_points_earned INTEGER DEFAULT 0;",
        "ALTER TABLE pos_sales ADD COLUMN loyalty_points_redeemed INTEGER DEFAULT 0;",
    ]

    # Determine dialect for table creation
    dialect = engine.dialect.name

    if dialect == "mysql":
        create_shifts_table = (
            "CREATE TABLE IF NOT EXISTS staff_shifts ("
            "id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, "
            "staff_id INT NOT NULL, "
            "outlet_id INT NOT NULL, "
            "clock_in_time DATETIME NOT NULL, "
            "clock_out_time DATETIME, "
            "expected_cash NUMERIC(10,2), "
            "actual_cash NUMERIC(10,2), "
            "cash_discrepancy NUMERIC(10,2), "
            "status VARCHAR(20) NOT NULL DEFAULT 'active', "
            "notes TEXT, "
            "FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE, "
            "FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE"
            ");"
        )
    else:
        create_shifts_table = (
            "CREATE TABLE IF NOT EXISTS staff_shifts ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, "
            "staff_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
            "outlet_id INTEGER NOT NULL REFERENCES outlets(id) ON DELETE CASCADE, "
            "clock_in_time DATETIME NOT NULL, "
            "clock_out_time DATETIME, "
            "expected_cash NUMERIC(10,2), "
            "actual_cash NUMERIC(10,2), "
            "cash_discrepancy NUMERIC(10,2), "
            "status VARCHAR(20) NOT NULL DEFAULT 'active', "
            "notes TEXT"
            ");"
        )


    with engine.begin() as conn:
        for q in alter_queries:
            try:
                conn.execute(sqlalchemy.text(q))
                print("  OK : {}".format(q))
            except sqlalchemy.exc.OperationalError as e:
                err = str(e).lower()
                if "duplicate column" in err or "already exists" in err:
                    print("  SKIP (exists): {}".format(q))
                else:
                    print("  WARN: {} -> {}".format(q, e))
            except Exception as e:
                print("  ERROR: {} -> {}".format(q, e))

        try:
            conn.execute(sqlalchemy.text(create_shifts_table))
            print("  OK : staff_shifts table ready")
        except Exception as e:
            print("  ERROR creating staff_shifts: {}".format(e))

    print("\nAll migrations complete!")


if __name__ == "__main__":
    main()
