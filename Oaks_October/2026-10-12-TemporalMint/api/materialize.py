import json,sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from engine import response
class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length=int(self.headers.get('content-length','0'))
            if length>20000:raise ValueError('Request too large.')
            result=response(json.loads(self.rfile.read(length) or b'{}'))
            body=json.dumps(result,separators=(',',':')).encode();self.send_response(200)
        except (ValueError,json.JSONDecodeError) as e:
            body=json.dumps({'error':str(e)}).encode();self.send_response(400)
        self.send_header('content-type','application/json');self.send_header('content-length',str(len(body)));self.end_headers();self.wfile.write(body)
    def do_GET(self):
        body=b'{"error":"POST required"}';self.send_response(405);self.send_header('content-type','application/json');self.send_header('content-length',str(len(body)));self.end_headers();self.wfile.write(body)
