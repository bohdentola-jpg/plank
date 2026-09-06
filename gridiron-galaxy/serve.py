#!/usr/bin/env python3
"""Gridiron Galaxy local server: no caching, auto-opens the browser, finds a free port.
Run:  python3 serve.py      (Windows: py serve.py, or double-click play.bat)"""
import http.server, socketserver, sys, threading, webbrowser, os

os.chdir(os.path.dirname(os.path.abspath(__file__)))
START_PORT = int(next((a for a in sys.argv[1:] if a.isdigit()), 8080))

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()
    def log_message(self, *a):
        pass

def main():
    port = START_PORT; httpd = None
    for _ in range(30):
        try:
            httpd = socketserver.TCPServer(('127.0.0.1', port), Handler); break
        except OSError:
            port += 1
    if httpd is None:
        print('No free port found. Close other windows and try again.'); input('Press Enter...'); return
    url = f'http://localhost:{port}/'
    print(f'\n  GRIDIRON GALAXY: THE LONG BOMB\n  Live at {url}\n  Plug in a PS5 controller and press any button. Ctrl+C to stop.\n')
    if '--no-browser' not in sys.argv:
        threading.Timer(0.7, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass

if __name__ == '__main__':
    main()
