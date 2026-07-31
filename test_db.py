import sqlite3
db = sqlite3.connect(r'd:\python project\food\backend\instance\food.db')
db.row_factory = sqlite3.Row
c = db.cursor()
for row in c.execute('PRAGMA table_info(users)').fetchall():
    print(dict(row))
