import sqlite3

db = sqlite3.connect(r'd:\python project\food\backend\instance\food.db')
c = db.cursor()

try:
    c.execute('ALTER TABLE users ADD COLUMN staff_code VARCHAR(10) UNIQUE;')
    print("Added staff_code")
except Exception as e:
    print("staff_code err:", e)

try:
    c.execute('ALTER TABLE users ADD COLUMN pin_hash VARCHAR(255);')
    print("Added pin_hash")
except Exception as e:
    print("pin_hash err:", e)

db.commit()
db.close()
