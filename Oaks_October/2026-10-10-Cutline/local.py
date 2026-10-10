from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from api.workspace import handler
class Local(handler,SimpleHTTPRequestHandler):
 def do_GET(self):
  if self.path.startswith('/api/'):return handler.do_GET(self)
  return SimpleHTTPRequestHandler.do_GET(self)
ThreadingHTTPServer(('0.0.0.0',8111),Local).serve_forever()
