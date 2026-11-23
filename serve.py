#!/usr/bin/env python3
"""Game server for the games in this repo (VARSITY 27 at /, COLD BOOT at /coldboot/).

- Serves many files at once: a browser loading a game made of ES modules asks
  for 100+ files in parallel, so requests are handled on threads with a deep
  connection queue (a single-threaded server with Python's default queue of 5
  drops connections on Windows, and the game fails with "Failed to fetch
  dynamically imported module").
- Sends the right types for .js/.mjs/.json/.ogg… whatever the Windows registry
  says (some machines map .js to text/plain, which browsers refuse to run).
- Tells the browser never to cache, so updates always show after a refresh.
- If the port is taken (a forgotten old server), it picks the next free one.
- Opens the game in your browser (pass --no-browser to skip; --open coldboot/
  opens COLD BOOT).
Run: python serve.py   (or: py serve.py on Windows)
"""
import http.server
import socketserver
import sys
import threading
import webbrowser

args = [a for a in sys.argv[1:] if a.isdigit()]
START_PORT = int(args[0]) if args else 8000
# --open <path>: open a sub-game instead of the root page (e.g. --open coldboot/)
OPEN_PATH = ''
if '--open' in sys.argv:
    i = sys.argv.index('--open')
    if i + 1 < len(sys.argv):
        OPEN_PATH = sys.argv[i + 1].lstrip('/')

TYPES = {
    '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
    '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
    '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary',
    '.bin': 'application/octet-stream', '.wasm': 'application/wasm', '.woff2': 'font/woff2',
    '.txt': 'text/plain', '.md': 'text/plain',
}


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'          # keep-alive: fewer connections to juggle
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, **TYPES}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *a):
        pass  # keep the console clean


class GameServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    request_queue_size = 256
    # no SO_REUSEADDR: on Windows it would let two servers share a port, and the
    # "port busy, try the next one" check below would stop working
    allow_reuse_address = False

    def handle_error(self, request, client_address):
        # a tab closed or reloaded mid-download: not worth a stack trace
        err = sys.exc_info()[1]
        if isinstance(err, (ConnectionResetError, ConnectionAbortedError, BrokenPipeError, TimeoutError)):
            return
        super().handle_error(request, client_address)


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

    url = f'http://localhost:{port}/' + OPEN_PATH
    print()
    print('  COLD BOOT' if OPEN_PATH.startswith('coldboot') else '  VARSITY 27')
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
