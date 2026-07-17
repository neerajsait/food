"""
Standalone migration script — runs BEFORE create_app() to add missing columns.
Supports both MySQL and SQLite using SQLAlchemy inspector.
Run this with: python run_migrate.py
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, inspect

load_dotenv()

db_url = os.getenv("DATABASE_URL")
if not db_url:
    h = os.getenv("MYSQL_HOST")
    u = os.getenv("MYSQL_USER")
    pw = os.getenv("MYSQL_PASSWORD")
    d = os.getenv("MYSQL_DB")
    if all([h, u, pw, d]):
        db_url = f"mysql+pymysql://{u}:{pw}@{h}/{d}"
        db_name = d
    else:
        db_url = "sqlite:///food.db"
        db_name = "food.db (SQLite)"
else:
    if "sqlite" in db_url:
        db_name = "food.db (SQLite)"
    else:
        db_name = db_url.split("/")[-1].split("?")[0]

engine = create_engine(db_url)
is_sqlite = engine.dialect.name == 'sqlite'

# Each migration is (table_name, column_name, column_definition)
COLUMNS_TO_ADD = [
    ("users",       "is_active",            "BOOLEAN NOT NULL DEFAULT TRUE"),
    ("users",       "updated_at",           "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
    ("users",       "password_reset_token",  "VARCHAR(255) NULL"),
    ("users",       "password_reset_expiry", "DATETIME NULL"),
    ("users",       "is_first_login",       "BOOLEAN NOT NULL DEFAULT 0"),
    ("outlets",     "owner_id",             "INT NULL"),
    ("menu_items",  "category",             "VARCHAR(50) NULL"),
    ("menu_items",  "image_url",            "VARCHAR(255) NULL"),
    ("orders",      "cancel_reason",        "VARCHAR(255) NULL"),
    ("orders",      "delivery_address",     "VARCHAR(500) NULL"),
    ("orders",      "payment_method",       "VARCHAR(50) NOT NULL DEFAULT 'COD'"),
    ("outlet_stocks","updated_at",           "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
]

print(f"Running migrations against database: {db_name}\n")

# Verify if tables exist before inspecting them. If tables do not exist, SQLAlchemy db.create_all() will handle it.
inspector = inspect(engine)
try:
    existing_tables = inspector.get_table_names()
except Exception as e:
    existing_tables = []
    print(f"Database/tables check skipped: {str(e)[:80]}")

with engine.connect() as conn:
    for table, column, definition in COLUMNS_TO_ADD:
        if table not in existing_tables:
            print(f"  SKIP  [{table}] — table does not exist (will be created by SQLAlchemy)")
            continue

        # Check if column already exists
        columns = [col['name'] for col in inspector.get_columns(table)]
        exists = column in columns

        if exists:
            print(f"  SKIP  [{table}.{column}] — already exists")
        else:
            # Adjust definition for SQLite
            sql_def = definition
            if is_sqlite:
                sql_def = sql_def.replace("ON UPDATE CURRENT_TIMESTAMP", "")
                
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {sql_def}"))
                conn.commit()
                print(f"  OK    [{table}.{column}] — added")
            except Exception as e:
                print(f"  ERROR [{table}.{column}] — {str(e)[:80]}")
                conn.rollback()

print("\nMigration complete.")
