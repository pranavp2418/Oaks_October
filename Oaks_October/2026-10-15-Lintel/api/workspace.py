"""Vercel request-local materialization of a visitor-owned, replayable synthetic journal."""
from http.server import BaseHTTPRequestHandler
from pathlib import Path
import json,sys,tempfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from service import handle,ServiceError
class handler(BaseHTTPRequestHandler):
 def do_POST(self):
  try:
   length=int(self.headers.get('Content-Length','0'))
   if not 0<length<=262144:raise ServiceError(413,'Request must be 1..262144 bytes')
   payload=json.loads(self.rfile.read(length));result=handle(payload,oidc_token=self.headers.get('x-vercel-oidc-token'))
   self.respond(200,result)
  except ServiceError as e:self.respond(e.status,{'error':str(e)})
  except (ValueError,TypeError,KeyError):self.respond(400,{'error':'Invalid request contract'})
  except Exception:self.respond(503,{'error':'Investigation unavailable; retain your local journal and retry.'})
 def respond(self,status,body):
  b=json.dumps(body,allow_nan=False).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
