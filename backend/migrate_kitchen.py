import os
import pymysql
import sqlite3
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("No DATABASE_URL found. Falling back to sqlite db.sqlite3")
    DATABASE_URL = "sqlite:///db.sqlite3"

def migrate():
    if DATABASE_URL.startswith("mysql"):
        conn_str = DATABASE_URL.replace("mysql+pymysql://", "").replace("mysql://", "")
        credentials, rest = conn_str.split("@")
        user, password = credentials.split(":")
        host_port, dbname = rest.split("/")
        if ":" in host_port:
            host, port = host_port.split(":")
            port = int(port)
        else:
            host = host_port
            port = 3306

        print(f"Connecting to MySQL DB {dbname} at {host}...")
        conn = pymysql.connect(
            host=host, port=port, user=user, password=password, database=dbname
        )
        cursor = conn.cursor()

        print("Creating production_batches table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS production_batches (
            id INT AUTO_INCREMENT PRIMARY KEY,
            menu_item_id INT NOT NULL,
            batch_number VARCHAR(50) NOT NULL UNIQUE,
            quantity_produced INT NOT NULL,
            mfg_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            expiry_date DATE NOT NULL,
            produced_by INT,
            status VARCHAR(20) DEFAULT 'produced',
            qr_code_base64 TEXT,
            FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
            FOREIGN KEY (produced_by) REFERENCES users(id) ON DELETE SET NULL
        )
        """)
        
        # We don't need to explicitly create KitchenStaff since they are part of users table.
        # But we need to update the role column ENUM if it's strictly typed. In this project, it's VARCHAR(20), so it's fine.

        conn.commit()
        cursor.close()
        conn.close()
        print("MySQL migration completed successfully.")

    elif DATABASE_URL.startswith("sqlite"):
        db_file = DATABASE_URL.replace("sqlite:///", "")
        print(f"Connecting to SQLite DB {db_file}...")
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()

        print("Creating production_batches table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS production_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            menu_item_id INTEGER NOT NULL,
            batch_number VARCHAR(50) NOT NULL UNIQUE,
            quantity_produced INTEGER NOT NULL,
            mfg_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            expiry_date DATE NOT NULL,
            produced_by INTEGER,
            status VARCHAR(20) DEFAULT 'produced',
            qr_code_base64 TEXT,
            FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
            FOREIGN KEY (produced_by) REFERENCES users(id) ON DELETE SET NULL
        )
        """)

        conn.commit()
        cursor.close()
        conn.close()
        print("SQLite migration completed successfully.")
    else:
        print("Unsupported DATABASE_URL prefix.")

if __name__ == "__main__":
    migrate()
