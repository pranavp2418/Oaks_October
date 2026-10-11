from http.server import HTTPServer,SimpleHTTPRequestHandler
from api.workspace import handler
class Local(SimpleHTTPRequestHandler):
 def do_POST(self):
  if self.path=='/api/workspace':handler.do_POST(self)
  else:self.send_error(404)
 def do_GET(self):
  if self.path=='/api/workspace':handler.do_GET(self)
  else:super().do_GET()
if __name__=='__main__':HTTPServer(('127.0.0.1',8132),Local).serve_forever()
