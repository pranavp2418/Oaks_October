from http.server import BaseHTTPRequestHandler
from pathlib import Path
import sys,json,traceback
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from engine import evaluate,Conflict,parse_csv,export_csv

def dispatch(body):
    if not isinstance(body,dict): raise ValueError('JSON object required.')
    if body.get('csv'):
        if not isinstance(body['csv'],dict):raise ValueError('CSV input must be an object.')
        dataset=dict(body.get('dataset') or {})
        dataset['books']=parse_csv(body['csv'].get('books'))
        dataset['bank']=parse_csv(body['csv'].get('bank'))
        body={**body,'dataset':dataset}
    result=evaluate(body)
    result['matchCsv']=export_csv(result['matches'])
    return result

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            n=int(self.headers.get('Content-Length','0'))
            if not 1<=n<=1_000_000:raise ValueError('Body must be 1–1000000 bytes.')
            body=json.loads(self.rfile.read(n));result={'ok':True,'data':dispatch(body)};code=200
        except Conflict as e: result={'ok':False,'error':str(e)};code=409
        except (ValueError,TypeError,KeyError,AttributeError) as e: result={'ok':False,'error':str(e)};code=400
        except Exception:
            traceback.print_exc();result={'ok':False,'error':'Evaluation is temporarily unavailable. Saved workspace kept.'};code=503
        self.send_response(code);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(json.dumps(result,separators=(',',':')).encode())
    def do_GET(self):
        self.send_response(405);self.send_header('Allow','POST');self.end_headers();self.wfile.write(b'POST required')
