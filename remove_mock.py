import re

files = [
    r'd:\python project\food\frontend-customer\src\utils\api.js',
    r'd:\python project\food\frontend-admin\src\utils\api.js'
]

for file_path in files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Remove INITIAL_OUTLETS, INITIAL_MENU_ITEMS, initMockDB
    content = re.sub(r'const INITIAL_OUTLETS = \[.*?\];', '', content, flags=re.DOTALL)
    content = re.sub(r'const INITIAL_MENU_ITEMS = \[.*?\];', '', content, flags=re.DOTALL)
    content = re.sub(r'function initMockDB\(\) \{.*?\}\s*initMockDB\(\);', '', content, flags=re.DOTALL)
    
    # 2. Remove const mockApi = { ... };
    start_str = 'const mockApi = {'
    if start_str in content:
        start_idx = content.find(start_str)
        brace_count = 0
        end_idx = -1
        in_string = False
        escape = False
        quote_char = ''
        
        for i in range(start_idx + len(start_str) - 1, len(content)):
            char = content[i]
            
            if in_string:
                if escape:
                    escape = False
                elif char == '\\':
                    escape = True
                elif char == quote_char:
                    in_string = False
            else:
                if char in '"\'`':
                    in_string = True
                    quote_char = char
                elif char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_idx = i
                        break
        
        if end_idx != -1:
            content = content[:start_idx] + content[end_idx + 1:]

    # 3. Remove Mock fallback block lines
    lines = content.split('\n')
    new_lines = []
    
    # Track multiline removal for lines containing `mockApi` just in case
    for line in lines:
        if 'mockApi.' in line or 'initMockDB()' in line or 'INITIAL_OUTLETS' in line or 'INITIAL_MENU_ITEMS' in line:
            continue
        if 'const live = await checkBackendAlive()' in line:
            continue
        # Also remove the whole Mock Database Initialization section comment
        if 'Mock Database Initialization & State Helpers' in line:
            continue
        new_lines.append(line)
        
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(new_lines))
    print(f"Processed {file_path}")
