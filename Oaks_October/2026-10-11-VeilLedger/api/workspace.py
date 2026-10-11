from http.server import BaseHTTPRequestHandler
import sys,os,json
sys.path.insert(0,os.path.dirname(os.path.dirname(__file__)))
from core import dispatch,Conflict
class handler(BaseHTTPRequestHandler):
 def do_GET(self):self.send_response(405);self.end_headers()
 def do_POST(self):
  try:
   n=int(self.headers.get('content-length','0'))
   if not 0<n<=500000:raise ValueError('Request limit 500000 bytes')
   result=dispatch(json.loads(self.rfile.read(n)));status=200
  except Conflict as e:result={'error':str(e)};status=409
  except (ValueError,KeyError,TypeError,AttributeError) as e:result={'error':str(e)};status=400
  self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(json.dumps(result).encode())
