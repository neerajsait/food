import os

def fix_api_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    idx = content.find("const live = true;")
    if idx != -1:
        header_idx = content.rfind("// API client for communicating", 0, idx)
        if header_idx != -1:
            clean_content = content[header_idx:]
            lines = clean_content.split('\n')
            final_lines = [line for line in lines if not line.startswith('>>>>>>>')]
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write('\n'.join(final_lines))
            print(f"Fixed {filepath}")
        else:
            print(f"Header not found in {filepath}")
    else:
        print(f"const live = true not found in {filepath}")

fix_api_file(r'd:\python project\food\frontend-customer\src\utils\api.js')
fix_api_file(r'd:\python project\food\frontend-admin\src\utils\api.js')
