#!/usr/bin/env python3
"""Friday Night Gridiron dev server — like `python -m http.server` but tells
the browser never to cache, so updates always show up. Run: python serve.py"""
import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # keep the console clean


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PORT), NoCacheHandler) as httpd:
    print(f'🏈 Friday Night Gridiron → open http://localhost:{PORT} in your browser')
    print('   (keep this window open while you play · Ctrl+C to stop)')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
