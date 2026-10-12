import json,sys
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/'api'));from engine import response
class H(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw):super().__init__(*a,directory='public',**kw)
    def do_POST(self):
        if self.path!='/api/materialize':return self.send_error(404)
        try:body=json.dumps(response(json.loads(self.rfile.read(int(self.headers.get('content-length','0'))) or b'{}'))).encode();self.send_response(200)
        except (ValueError,json.JSONDecodeError) as e:body=json.dumps({'error':str(e)}).encode();self.send_response(400)
        self.send_header('content-type','application/json');self.send_header('content-length',str(len(body)));self.end_headers();self.wfile.write(body)
ThreadingHTTPServer(('127.0.0.1',8142),H).serve_forever()
