import sqlite3

def check_db():
    conn = sqlite3.connect('backend/instance/food.db')
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    print(cur.fetchall())
    conn.close()

if __name__ == "__main__":
    check_db()
