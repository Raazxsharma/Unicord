import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

start = html.find('<script id="unicord-bundle">')
end = html.rfind('</script>')

if start != -1 and end != -1:
    js = html[start + len('<script id="unicord-bundle">'):end]
    with open('test_bundle.js', 'w', encoding='utf-8') as f:
        f.write(js)
    print('Saved test_bundle.js with length:', len(js))
else:
    print('Could not find script block')
