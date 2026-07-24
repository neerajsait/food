"""
MySQL Schema Migration Script for New Security and Admin Features
Applies the new columns to users and outlets, and creates admin_audit_logs table.
Run once: python migrate_new_features.py
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
    print("Starting MySQL schema migration for new features...")
    print("=" * 60)

    print("\n[1] Extending `users` table...")
    add_column_if_missing(cursor, "users", "is_banned", "TINYINT(1) NOT NULL DEFAULT 0")
    add_column_if_missing(cursor, "users", "ban_reason", "TEXT NULL")
    add_column_if_missing(cursor, "users", "deleted_at", "DATETIME NULL")
    add_column_if_missing(cursor, "users", "is_email_verified", "TINYINT(1) NOT NULL DEFAULT 0")
    add_column_if_missing(cursor, "users", "emergency_contact", "VARCHAR(255) NULL")
    add_column_if_missing(cursor, "users", "is_superadmin", "TINYINT(1) NOT NULL DEFAULT 0")
    add_column_if_missing(cursor, "users", "admin_department", "VARCHAR(50) NULL")
    conn.commit()

    print("\n[2] Extending `outlets` table...")
    add_column_if_missing(cursor, "outlets", "revenue_share_percentage", "DECIMAL(5,2) NULL DEFAULT 0.00")
    conn.commit()

    print("\n[3] Creating `admin_audit_logs` table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS admin_audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            admin_id INT NOT NULL,
            action VARCHAR(255) NOT NULL,
            target_entity VARCHAR(100) NULL,
            target_id INT NULL,
            details TEXT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)
    conn.commit()
    print("  admin_audit_logs table ready.")

    conn.close()
    print("\n" + "=" * 60)
    print("Migration completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    run_migration()
