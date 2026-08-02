import urllib.request
import urllib.error
import json

login_data = json.dumps({"email":"test_checkout2@test.com","password":"password123"}).encode('utf-8')
req = urllib.request.Request("http://127.0.0.1:5000/api/auth/login", data=login_data, headers={'Content-Type': 'application/json'})
res = urllib.request.urlopen(req)
token = json.loads(res.read())['access_token']

order_data = json.dumps({
    "items": [{"menu_item_id": 30, "quantity": 1}],
    "delivery_address": "Test Address",
    "payment_method": "COD",
    "delivery_charge": 50
}).encode('utf-8')
req2 = urllib.request.Request("http://127.0.0.1:5000/api/foods/order", data=order_data, headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'})
try:
    res2 = urllib.request.urlopen(req2)
    print("Success:", res2.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("Error Code:", e.code)
    print("Error Response:", e.read().decode('utf-8'))
