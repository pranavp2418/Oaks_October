from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import sys,os
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from api.compute import handler as api
class Local(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kw):super().__init__(*args,directory=str(Path(__file__).resolve().parents[1]/'public'),**kw)
    def do_POST(self):
        if self.path=='/api/compute':return api.do_POST(self)
        self.send_error(404)
    def do_GET(self):
        if self.path=='/api/compute':return api.do_GET(self)
        return super().do_GET()
port=int(os.environ.get('RECON_PORT','3109'));print(f'Reconciliation Engine at http://localhost:{port}',flush=True)
ThreadingHTTPServer(('0.0.0.0',port),Local).serve_forever()
