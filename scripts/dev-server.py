#!/usr/bin/env python3
"""Local preview server for the built site (_site/). No caching, clean URLs, 404 page."""
import http.server, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '_site')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4800


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        page = os.path.join(ROOT, '404.html')
        if code == 404 and os.path.exists(page):
            body = open(page, 'rb').read()
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().send_error(code, message, explain)


http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
