from http.server import BaseHTTPRequestHandler
import json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from core import replay,Conflict
class handler(BaseHTTPRequestHandler):
 def do_POST(self):
  try:
   n=int(self.headers.get('Content-Length','0'))
   if n<1 or n>200000: raise ValueError('Body must be 1–200000 bytes')
   body=json.loads(self.rfile.read(n));result=replay(body.get('data'),body.get('events',[]));self.send_response(200)
  except Conflict as e: result={'error':str(e)};self.send_response(409)
  except (ValueError,TypeError,KeyError,AttributeError) as e: result={'error':str(e)};self.send_response(400)
  self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(json.dumps(result).encode())
