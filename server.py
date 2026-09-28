import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 5050
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS and caching headers
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

def run_server():
    os.chdir(DIRECTORY)
    port = PORT
    for p in range(PORT, PORT + 20):
        try:
            with socketserver.TCPServer(("", p), Handler) as httpd:
                print(f"[UniCord Server] Running at: http://localhost:{p}")
                print(f"[UniCord Server] Press Ctrl+C to stop.")
                webbrowser.open(f"http://localhost:{p}")
                httpd.serve_forever()
                break
        except OSError:
            print(f"[UniCord Server] Port {p} busy, trying next port...")

if __name__ == '__main__':
    run_server()
