from http.server import HTTPServer,SimpleHTTPRequestHandler
from api.compute import handler
class App(SimpleHTTPRequestHandler):
 def do_POST(self):
  if self.path=='/api/compute': handler.do_POST(self)
  else: self.send_error(404)
HTTPServer(('127.0.0.1',8101),App).serve_forever()
