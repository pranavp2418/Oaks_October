"""Local API server; run Vite separately. Development only, loopback-bound."""
from http.server import HTTPServer
from api.workspace import handler

if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 8081), handler).serve_forever()
