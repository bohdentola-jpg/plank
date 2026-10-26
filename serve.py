#!/usr/bin/env python3
"""Game server for the games in this repo (VARSITY 27, HARD COUNT).

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
# --open hardcount/  → open that page instead of the site root (used by hardcount.bat)
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


class GameServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    # Browsers fetch dozens of module files at once. A single-threaded server
    # with the default 5-slot queue makes Windows refuse the extras, so the
    # page fails with "Failed to fetch dynamically imported module".
    daemon_threads = True
    request_queue_size = 128


def main():
    httpd = None
    port = START_PORT
    for _ in range(25):
        try:
            # localhost-only: no Windows firewall popup, no LAN exposure
            httpd = GameServer(('127.0.0.1', port), NoCacheHandler)
            break
        except OSError:
            port += 1
    if httpd is None:
        print('Could not find a free port. Close other game windows and retry.')
        input('Press Enter to close...')
        return

    url = f'http://localhost:{port}/{OPEN_PATH}'
    print()
    name = 'VARSITY 27'
    if OPEN_PATH.startswith('hardcount'):
        name = 'HARD COUNT  7-ON-7 FOOTBALL'
    elif OPEN_PATH.startswith('racing'):
        name = 'MIDNIGHT FREQUENCY'
    print('  ' + name)
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
