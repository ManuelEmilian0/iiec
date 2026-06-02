import os

css_path = 'style.css'
with open(css_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

def get_blocks():
    blocks = []
    current_block = []
    current_title = "Unknown"
    
    for line in lines:
        if line.startswith('/* ========================================='):
            if current_block:
                blocks.append((current_title, current_block))
            current_block = [line]
            current_title = "Block"
        else:
            if len(current_block) == 2 and line.strip().startswith('1.'):
                current_title = 'reset'
            elif len(current_block) == 2 and line.strip().startswith('2.'):
                current_title = 'reset'
            elif len(current_block) == 2 and line.strip().startswith('3.'):
                current_title = 'layout'
            elif len(current_block) == 2 and line.strip().startswith('4.'):
                current_title = 'layout'
            elif len(current_block) == 2 and line.strip().startswith('5.'):
                current_title = 'components'
            elif len(current_block) == 2 and line.strip().startswith('6.'):
                current_title = 'components'
            elif len(current_block) == 2 and line.strip().startswith('7.'):
                current_title = 'components'
            elif len(current_block) == 2 and line.strip().startswith('8.'):
                current_title = 'map'
            elif len(current_block) == 2 and line.strip().startswith('9.'):
                current_title = 'map'
            elif len(current_block) == 2 and line.strip().startswith('10.'):
                current_title = 'map'
            elif len(current_block) == 2 and line.strip().startswith('11.'):
                current_title = 'components'
            elif len(current_block) == 2 and line.strip().startswith('12.'):
                current_title = 'components'
            elif len(current_block) == 2 and line.strip().startswith('13.'):
                current_title = 'layout'
            elif len(current_block) == 2 and line.strip().startswith('14.'):
                current_title = 'layout'
            
            if current_block is not None:
                current_block.append(line)
                
    if current_block:
        blocks.append((current_title, current_block))
        
    return blocks

blocks = get_blocks()

files = {
    'reset.css': [],
    'layout.css': [],
    'components.css': [],
    'map.css': []
}

for title, block in blocks:
    if title == 'reset':
        files['reset.css'].extend(block)
    elif title == 'layout':
        files['layout.css'].extend(block)
    elif title == 'components':
        files['components.css'].extend(block)
    elif title == 'map':
        files['map.css'].extend(block)
    else:
        files['components.css'].extend(block)

os.makedirs('estilos', exist_ok=True)
for fname, fcontent in files.items():
    with open(os.path.join('estilos', fname), 'w', encoding='utf-8') as f:
        f.write("".join(fcontent))

with open('style.css', 'w', encoding='utf-8') as f:
    f.write("@import url('estilos/reset.css');\n")
    f.write("@import url('estilos/layout.css');\n")
    f.write("@import url('estilos/components.css');\n")
    f.write("@import url('estilos/map.css');\n")

print("CSS split successfully.")
