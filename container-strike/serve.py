#!/usr/bin/env python3
"""Container Strike game server.

Standalone server for Container Strike only — completely separate from the
other games in this repository (run those with their own serve.py).

- Serves this folder no matter where you launch it from.
- Tells the browser never to cache, so updates always show after a refresh.
- If the port is taken, it picks the next free one instead of fighting over it.
- Opens the game in your browser automatically (pass --no-browser to skip).
Run: python serve.py   (or: py serve.py on Windows)
"""
import http.server
import os
import socketserver
import sys
import threading
import webbrowser

GAME_DIR = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if a.isdigit()]
START_PORT = int(args[0]) if args else 8010  # away from the other games' 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=GAME_DIR, **kw)

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
    print('  CONTAINER STRIKE')
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
