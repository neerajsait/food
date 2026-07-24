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
        # Parsing mysql://user:pass@host:port/dbname
        # Format usually: mysql+pymysql://user:password@host/dbname
        conn_str = DATABASE_URL.replace("mysql+pymysql://", "").replace("mysql://", "")
        # Split by @
        credentials, rest = conn_str.split("@")
        user, password = credentials.split(":")
        # Split by /
        host_port, dbname = rest.split("/")
        if ":" in host_port:
            host, port = host_port.split(":")
            port = int(port)
        else:
            host = host_port
            port = 3306

        print(f"Connecting to MySQL DB {dbname} at {host}...")
        conn = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=dbname
        )
        cursor = conn.cursor()

        # Create addresses table
        print("Creating addresses table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS addresses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            title VARCHAR(50) NOT NULL,
            address_line VARCHAR(500) NOT NULL,
            is_default BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        # Create favorites table
        print("Creating favorites table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS favorites (
            id INT AUTO_INCREMENT PRIMARY KEY,
            customer_id INT NOT NULL,
            menu_item_id INT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
        )
        """)
        
        conn.commit()
        cursor.close()
        conn.close()
        print("MySQL migration completed successfully.")

    elif DATABASE_URL.startswith("sqlite"):
        db_file = DATABASE_URL.replace("sqlite:///", "")
        print(f"Connecting to SQLite DB {db_file}...")
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()

        # Create addresses table
        print("Creating addresses table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS addresses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title VARCHAR(50) NOT NULL,
            address_line VARCHAR(500) NOT NULL,
            is_default BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        # Create favorites table
        print("Creating favorites table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            menu_item_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
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
