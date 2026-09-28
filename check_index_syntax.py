import re
import subprocess

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = '<script id="unicord-bundle">'
end_marker = '</script>'

start_idx = content.find(start_marker)
if start_idx == -1:
    print('Error: start marker not found')
    exit(1)

start_idx += len(start_marker)
end_idx = content.find(end_marker, start_idx)
if end_idx == -1:
    print('Error: end marker not found')
    exit(1)

js = content[start_idx:end_idx]
print(f'Found JS of length {len(js)}')

with open('temp_bundle_check.js', 'w', encoding='utf-8') as f:
    f.write(js)

node_path = r'C:\Users\Asus\AppData\Local\ms-playwright-go\1.57.0\node.exe'
res = subprocess.run([node_path, '--check', 'temp_bundle_check.js'], capture_output=True, text=True)
print('Exit code:', res.returncode)
print('Stdout:', res.stdout)
print('Stderr:', res.stderr)
