from http.server import SimpleHTTPRequestHandler,HTTPServer
import json
from core import dispatch
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kw):super().__init__(*args,directory='public',**kw)
 def do_POST(self):
  try:
   length=int(self.headers.get('content-length',0))
   if not 0<length<=200000:raise ValueError('Payload limit exceeded')
   output=dispatch(json.loads(self.rfile.read(length)));code=200
  except (ValueError,KeyError,TypeError) as e:output={'error':str(e)};code=400
  self.send_response(code);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(output).encode())
HTTPServer(('127.0.0.1',8102),Handler).serve_forever()
