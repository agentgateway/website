---
title: Body buffering
weight: 17
description: Buffer request and response bodies before forwarding them.
test:
  buffer:
  - file: ${versionRoot}/documentation/configuration/traffic-management/buffer.md
    path: buffer
---

Attaches to: {{< badge content="Route" path="/documentation/configuration/routes/" >}}

{{< doc-test paths="buffer" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Buffer request and response bodies": the example config is accepted by
#     agentgateway (--validate-only), so the `policies.buffer.request.maxBytes`
#     and `policies.buffer.response.maxBytes` field names and nesting are correct.
#   * The same config serves live traffic: with the policy applied, a GET request
#     reaches the backend and returns 200, and a POST request with a body inside
#     the `maxBytes` limit is buffered and forwarded to the backend with all of
#     its bytes intact (the backend echoes the body back).
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * `failureMode` (`failClosed` / `failOpen`) behavior when a body exceeds
#     `maxBytes` - requires config/traffic the page omits; the page documents the
#     fields in a table but shows no example that sets `failureMode` or sends an
#     oversized body.
#   * That bodies are actually accumulated in memory rather than streamed - a
#     different layer; the proxy exposes no per-request signal that this page
#     documents, so only the end-to-end result is asserted.
#   * The `frontendPolicies.http.maxBufferSize` gateway-level limit mentioned in
#     the note - display-only reference to a separate setting, with no example on
#     this page.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

Use the `policies.buffer` policy to buffer request or response bodies in the proxy before the bodies are forwarded. By default, agentgateway streams bodies. When you configure `policies.buffer`, the proxy accumulates the configured body direction in memory until the body is complete, and then forwards it.

> [!NOTE]
> This policy is different from gateway-level buffering, which configures the `frontendPolicies.http.maxBufferSize` limit used by policies that need buffering.

## Buffer settings

You can configure request buffering, response buffering, or both.

| Field | Description | Default |
| -- | -- | -- |
| `policies.buffer.request.maxBytes` | Maximum number of request body bytes to buffer. | Uses the global proxy buffer setting, which defaults to 2 MiB. |
| `policies.buffer.request.failureMode` | Behavior when the request body exceeds `maxBytes`: `failClosed` to reject the request, or `failOpen` to continue. | `failClosed` |
| `policies.buffer.response.maxBytes` | Maximum number of response body bytes to buffer. | Uses the global proxy buffer setting, which defaults to 2 MiB. |
| `policies.buffer.response.failureMode` | Behavior when the response body exceeds `maxBytes`: `failClosed` to reject the response, or `failOpen` to continue. | `failClosed` |

The `maxBytes` value is a number of bytes, such as `65536` for 64 KiB. Large buffered bodies can increase proxy memory usage, so set strict limits for routes that receive untrusted or large payloads. When a body exceeds the applicable buffer limit, agentgateway rejects the body if possible. If response headers were already sent before the limit is exceeded, the proxy closes the connection.

## Buffer request and response bodies

Use the route's `policies` block to configure body buffering.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: localhost:8080
  policies:
    buffer:
      request:
        maxBytes: 65536
      response:
        maxBytes: 262144
```

{{< doc-test paths="buffer" >}}
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: localhost:8080
  policies:
    buffer:
      request:
        maxBytes: 65536
      response:
        maxBytes: 262144
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

{{< doc-test paths="buffer" >}}
# Stand up an HTTP backend on localhost:8080 so the route in the example config
# has something to forward to. The backend echoes the request body back so the
# test can confirm a buffered POST body arrives intact, then wait for it to
# accept connections.
cat <<'EOF' > backend.py
from http.server import BaseHTTPRequestHandler, HTTPServer

class Echo(BaseHTTPRequestHandler):
    def _reply(self, body=b""):
        self.send_response(200)
        self.send_header("content-type", "text/plain")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self._reply(b"ok")

    def do_POST(self):
        length = int(self.headers.get("content-length") or 0)
        self._reply(self.rfile.read(length))

    def log_message(self, *args):
        pass

HTTPServer(("127.0.0.1", 8080), Echo).serve_forever()
EOF
python3 backend.py &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null' EXIT
# Wait for the echo backend, and confirm the responder is actually this backend
# rather than some other process already holding 8080 -- otherwise the POST
# assertion below fails in a way that looks like a buffering bug.
for i in $(seq 1 30); do
  [ "$(curl -sf --max-time 5 -X POST -d probe http://127.0.0.1:8080/ 2>/dev/null)" = "probe" ] && break
  sleep 1
done
if [ "$(curl -sf --max-time 5 -X POST -d probe http://127.0.0.1:8080/ 2>/dev/null)" != "probe" ]; then
  echo "FAIL: the echo backend did not come up on 127.0.0.1:8080 (is the port already in use?)"
  exit 1
fi
{{< /doc-test >}}

{{< doc-test paths="buffer" >}}
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID $BACKEND_PID 2>/dev/null' EXIT
sleep 3
{{< /doc-test >}}

{{< doc-test paths="buffer" >}}
YAMLTest -f - <<'EOF'
- name: Buffered route forwards a GET request to the backend
  retries: 3
  http:
    url: "http://localhost:3000"
    path: /
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
- name: Buffered route forwards a POST request body under maxBytes
  http:
    url: "http://localhost:3000"
    path: /
    method: POST
    headers:
      content-type: text/plain
      accept-encoding: identity
    body: "buffered request body"
  source:
    type: local
  expect:
    statusCode: 200
    headers:
      # The backend echoes the request body, so a content-length of 21 confirms
      # all 21 bytes of "buffered request body" survived buffering.
      - name: content-length
        comparator: equals
        value: "21"
EOF
{{< /doc-test >}}
