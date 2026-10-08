from http.server import BaseHTTPRequestHandler
import json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from core import workspace
class handler(BaseHTTPRequestHandler):
    def do_GET(self):self.respond(405,{'error':'POST required'})
    def do_POST(self):
        try:
            size=int(self.headers.get('Content-Length','0'))
            if size>1500000:return self.respond(413,{'error':'Payload too large'})
            data=json.loads(self.rfile.read(size));self.respond(200,workspace(data))
        except (ValueError,TypeError,KeyError,AttributeError) as e:self.respond(409 if 'conflict' in str(e).lower() else 400,{'error':str(e)})
    def respond(self,status,data):
        b=json.dumps(data).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(b)
