import sqlite3

db = sqlite3.connect(r'd:\python project\food\backend\instance\food.db')
c = db.cursor()

try:
    c.execute('ALTER TABLE users ADD COLUMN staff_code VARCHAR(10);')
    c.execute('CREATE UNIQUE INDEX idx_staff_code ON users(staff_code);')
    print("Added staff_code and unique index")
except Exception as e:
    print("staff_code err:", e)

db.commit()
db.close()
