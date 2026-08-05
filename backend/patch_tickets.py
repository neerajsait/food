import re

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. MAX_CONTENT_LENGTH
if 'app.config["MAX_CONTENT_LENGTH"]' not in content:
    content = content.replace('app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False', 
                              'app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False\n    app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024')

# 2. Add allowed file logic
allowed_file_logic = '''
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
'''
if "ALLOWED_EXTENSIONS = " not in content:
    content = content.replace("TICKETS_UPLOAD_FOLDER = ", allowed_file_logic + "\nTICKETS_UPLOAD_FOLDER = ")

# 3. Sanitize multipart
content = content.replace('data = request.form', 'data = sanitize_input(dict(request.form))')

# 4. create_ticket file upload
old_create_file = '''        if "attachment" in request.files:
            file = request.files["attachment"]
            if file and file.filename:
                filename = secure_filename(file.filename)
                unique_name = f"{int(datetime.now().timestamp())}_{filename}"'''

new_create_file = '''        if "attachment" in request.files:
            file = request.files["attachment"]
            if file and file.filename:
                if not allowed_file(file.filename):
                    return jsonify({"error": "Bad Request", "message": "Disallowed file extension"}), 400
                filename = secure_filename(file.filename)
                unique_name = f"{int(datetime.now().timestamp())}_{filename}"'''

content = content.replace(old_create_file, new_create_file)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched tickets")
