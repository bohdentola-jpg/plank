#!/usr/bin/env python3
"""CHROMA CLASH game server.

Serves the repository root (the game shares the vendored three.js) and opens
http://localhost:<port>/chroma/ in your browser. No-cache headers so updates
always show after a refresh; picks the next free port if 8100 is busy.
Run: python3 serve.py   (or: py serve.py on Windows)   --no-browser to skip opening.
"""
import functools
import http.server
import os
import socketserver
import sys
import threading
import webbrowser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = [a for a in sys.argv[1:] if a.isdigit()]
START_PORT = int(args[0]) if args else 8100


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.mjs': 'text/javascript'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *a):
        pass


def main():
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    httpd, port = None, START_PORT
    for _ in range(25):
        try:
            httpd = socketserver.TCPServer(('127.0.0.1', port), handler)
            break
        except OSError:
            port += 1
    if httpd is None:
        print('Could not find a free port. Close other game windows and retry.')
        return
    url = f'http://localhost:{port}/chroma/'
    print()
    print('  CHROMA CLASH')
    print(f'  Game is live at  {url}')
    print('  Keep this window open while you play. Ctrl+C or close it to stop.')
    print()
    if '--no-browser' not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
