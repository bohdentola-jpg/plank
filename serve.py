#!/usr/bin/env python3
"""Local game server (serves VARSITY 27 by default, or "game" with --dir game).

- Tells the browser never to cache, so updates always show after a refresh.
- If the port is taken (a forgotten old server), it picks the next free one
  instead of fighting over it.
- Opens the game in your browser automatically (pass --no-browser to skip).
Run: python serve.py              → VARSITY 27 (repo root)
     python serve.py --dir game   → "game" (the stickman multiplayer game)
"""
import functools
import http.server
import os
import socketserver
import sys
import threading
import webbrowser

args = [a for a in sys.argv[1:] if a.isdigit()]
START_PORT = int(args[0]) if args else 8000

SERVE_DIR = os.path.dirname(os.path.abspath(__file__))
TITLE = 'VARSITY 27'
if '--dir' in sys.argv:
    sub = sys.argv[sys.argv.index('--dir') + 1]
    SERVE_DIR = os.path.join(SERVE_DIR, sub)
    TITLE = 'game' if sub.strip('/').lower() == 'game' else sub
    if not args:
        START_PORT = 8010  # keep both games runnable side by side


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *a):
        pass  # keep the console clean


def main():
    handler = functools.partial(NoCacheHandler, directory=SERVE_DIR)
    httpd = None
    port = START_PORT
    for _ in range(25):
        try:
            # localhost-only: no Windows firewall popup, no LAN exposure
            httpd = socketserver.TCPServer(('127.0.0.1', port), handler)
            break
        except OSError:
            port += 1
    if httpd is None:
        print('Could not find a free port. Close other game windows and retry.')
        input('Press Enter to close...')
        return

    url = f'http://localhost:{port}'
    print()
    print(f'  {TITLE}')
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
