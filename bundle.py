import os
import re

DIR = os.path.dirname(os.path.abspath(__file__))

def bundle():
    index_path = os.path.join(DIR, 'index.html')
    with open(index_path, 'r', encoding='utf-8') as f:
        html = f.read()

    # Read all CSS
    css_files = ['main.css', 'servers.css', 'channels.css', 'chat.css', 'voice.css', 'members.css', 'modals.css', 'dms.css', 'whiteboard.css']
    all_css = ''
    for c in css_files:
        path = os.path.join(DIR, 'styles', c)
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as cf:
                all_css += f'/* --- {c} --- */\n' + cf.read() + '\n'

    # Read all JS
    js_files = ['audio.js', 'markdown.js', 'state.js', 'network.js', 'voice.js', 'bots.js', 'whiteboard.js', 'ui.js', 'app.js']
    all_js = ''
    for j in js_files:
        path = os.path.join(DIR, 'js', j)
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as jf:
                all_js += f'// --- {j} ---\n' + jf.read() + '\n'

    # Remove existing link tags to styles/
    html = re.sub(r'<link rel="stylesheet" href="styles/[^"]+">\s*', '', html)
    # Remove existing style block if any was added
    html = re.sub(r'<style>[\s\S]*?</style>\s*', '', html)

    # Ensure real-time libraries (MQTT & PeerJS) are in head
    cdn_libs = '''  <!-- Real-Time Cross-Device Chat & WebRTC Voice -->
  <script src="https://unpkg.com/mqtt@5.3.5/dist/mqtt.min.js"></script>
  <script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"></script>
'''
    if 'mqtt.min.js' not in html:
        html = html.replace('</head>', f'{cdn_libs}</head>')

    # Insert combined CSS before </head>
    html = html.replace('</head>', f'<style>\n{all_css}\n</style>\n</head>')

    # Remove existing script tags to js/
    html = re.sub(r'<script src="js/[^"]+"></script>\s*', '', html)
    # Remove existing inline script if any was added
    html = re.sub(r'<script id="unicord-bundle">[\s\S]*?</script>\s*', '', html)

    # Insert combined JS before </body>
    html = html.replace('</body>', f'<script id="unicord-bundle">\n{all_js}\n</script>\n</body>')

    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print('[SUCCESS] index.html successfully bundled into a self-contained production file!')

if __name__ == '__main__':
    bundle()
