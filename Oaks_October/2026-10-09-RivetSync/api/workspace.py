from http.server import BaseHTTPRequestHandler
import json,sys,os
sys.path.insert(0,os.path.dirname(os.path.dirname(__file__)))
from core import dispatch
class handler(BaseHTTPRequestHandler):
 def do_POST(self):
  try:
   length=int(self.headers.get('content-length','0'))
   if not 0<length<=200000:raise ValueError('Payload limit 200KB')
   result=dispatch(json.loads(self.rfile.read(length)));status=200
  except (ValueError,KeyError,TypeError) as e:result={'error':str(e)};status=400
  self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(json.dumps(result).encode())
