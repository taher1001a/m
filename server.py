"""خادم محلي بسيط لتشغيل التطبيق والسماح بكاميرا مسح الباركود.
التشغيل:  python server.py
الفتح:    http://localhost:8000
"""
import http.server
import socketserver
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

PORT = 8000
Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.manifest': 'application/manifest+json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
}

with socketserver.ThreadingTCPServer(("", PORT), Handler) as httpd:
    print("=" * 50)
    print("  نظام إدارة الديون والمخزون")
    print(f"  يعمل الآن على:  http://localhost:{PORT}")
    print("  اضغط Ctrl+C لإيقاف الخادم")
    print("=" * 50)
    httpd.serve_forever()
