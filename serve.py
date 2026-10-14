#!/usr/bin/env python3
"""Friday Night Gridiron game server.

- Tells the browser never to cache, so updates always show after a refresh.
- If the port is taken (a forgotten old server), it picks the next free one
  instead of fighting over it.
- Opens the game in your browser automatically (pass --no-browser to skip).
Run: python serve.py   (or: py serve.py on Windows)
"""
import http.server
import socketserver
import sys
import threading
import webbrowser

args = [a for a in sys.argv[1:] if a.isdigit()]
START_PORT = int(args[0]) if args else 8000
# --open racing/  → open that page instead of the site root (used by race.bat)
OPEN_PATH = ''
if '--open' in sys.argv:
    i = sys.argv.index('--open')
    if i + 1 < len(sys.argv):
        OPEN_PATH = sys.argv[i + 1].lstrip('/')


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    # Windows sometimes maps .js to text/plain in the registry, which makes
    # browsers refuse ES modules. Pin the types the games need.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
        '.json': 'application/json', '.html': 'text/html', '.png': 'image/png',
        '.svg': 'image/svg+xml', '.wav': 'audio/wav',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *a):
        pass  # keep the console clean


def main():
    httpd = None
    port = START_PORT
    for _ in range(25):
        try:
            # localhost-only: no Windows firewall popup, no LAN exposure
            httpd = socketserver.TCPServer(('127.0.0.1', port), NoCacheHandler)
            break
        except OSError:
            port += 1
    if httpd is None:
        print('Could not find a free port. Close other game windows and retry.')
        input('Press Enter to close...')
        return

    url = f'http://localhost:{port}/{OPEN_PATH}'
    print()
    print('  MIDNIGHT FREQUENCY' if OPEN_PATH.startswith('racing') else '  VARSITY 27')
    print(f'  Game is live at  {url}')
    if port != START_PORT:
        print(f'  (port {START_PORT} was busy — an old window may still be running)')
    print('  Keep this window open while you play. Ctrl+C or close it to stop.')
    print()
    if '--no-browser' not in sys.argv:
        try:
            threading.Timer(0.8, lambda: webbrowser.open(url)).start()
        except Exception:
            pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
