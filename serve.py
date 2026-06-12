#!/usr/bin/env python3
"""EB Sports game server — VARSITY 27 and RIM CITY live here.

- Tells the browser never to cache, so updates always show after a refresh.
- If the port is taken (a forgotten old server), it picks the next free one
  instead of fighting over it.
- Opens a game in your browser automatically (pass --no-browser to skip).
Run: python serve.py            → opens VARSITY 27
     python serve.py rimcity    → opens RIM CITY
"""
import http.server
import socketserver
import sys
import threading
import webbrowser

args = [a for a in sys.argv[1:] if a.isdigit()]
START_PORT = int(args[0]) if args else 8000
OPEN_PATH = ''
for a in sys.argv[1:]:
    if not a.isdigit() and not a.startswith('-'):
        OPEN_PATH = '/' + a.strip('/') + '/'


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
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

    url = f'http://localhost:{port}'
    print()
    print('  EB SPORTS ARCADE')
    print(f'  VARSITY 27 (football)    {url}')
    print(f'  RIM CITY (basketball)    {url}/rimcity/')
    if port != START_PORT:
        print(f'  (port {START_PORT} was busy — an old window may still be running)')
    print('  Keep this window open while you play. Ctrl+C or close it to stop.')
    print()
    if '--no-browser' not in sys.argv:
        try:
            threading.Timer(0.8, lambda: webbrowser.open(url + OPEN_PATH)).start()
        except Exception:
            pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
