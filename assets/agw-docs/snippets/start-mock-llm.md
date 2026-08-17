# Test-only helper: start a local mock LLM that speaks the OpenAI chat completions
# API, so guides that configure a real provider can be tested without a provider
# API key. It is the standalone counterpart to the httpbun mock LLM that the
# Kubernetes guides use (/llm/providers/httpbun/), which is not reachable from a
# plain binary run. The mock reports the max_tokens value it received as
# usage.completion_tokens, which lets a test assert what agentgateway actually
# sent upstream rather than what the client asked for.
# Point a model at it by adding `baseUrl: http://localhost:3091` to its `params`.
cat > mock-llm.py <<'PY'
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("content-length") or 0)
        request = json.loads(self.rfile.read(length) or b"{}")
        cap = request.get("max_tokens") or request.get("max_completion_tokens") or 0
        message = dict(role="assistant", content="mock completion")
        choice = dict(index=0, finish_reason="length", message=message)
        usage = dict(prompt_tokens=1, completion_tokens=cap, total_tokens=cap + 1)
        response = dict(id="chatcmpl-mock", object="chat.completion", created=0)
        response["model"] = request.get("model", "mock")
        response["choices"] = [choice]
        response["usage"] = usage
        payload = json.dumps(response).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
    def log_message(self, *args):
        pass
HTTPServer(("127.0.0.1", 3091), Handler).serve_forever()
PY
python3 mock-llm.py &
MOCK_LLM_PID=$!
for _ in $(seq 1 20); do curl -sf -o /dev/null -m 2 -X POST http://localhost:3091 -d '{}' && break; sleep 1; done
