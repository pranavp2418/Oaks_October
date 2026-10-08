from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from api.workspace import handler
import os
class Local(SimpleHTTPRequestHandler):
    def __init__(self,*a,**k):super().__init__(*a,directory='public',**k)
    def do_POST(self):
        if self.path=='/api/workspace':handler.do_POST(self)
        else:self.send_error(404)
    def respond(self,*a):return handler.respond(self,*a)
ThreadingHTTPServer(('0.0.0.0',int(os.getenv('PORT','3102'))),Local).serve_forever()
