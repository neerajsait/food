import re

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

routes = re.findall(r'@app\.route\("([^"]+)"(?:,\s*methods=\[([^\]]+)\])?\)', content)
for r in routes:
    path = r[0]
    methods = r[1] if r[1] else '"GET"'
    methods = methods.replace('"', '').replace("'", "")
    print(f"{methods: <20} {path}")
