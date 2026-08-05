---
title: CORS
weight: 11
description: Configure Cross-Origin Resource Sharing policies to control cross-domain requests.
test:
  cors:
  - file: ${versionRoot}/configuration/security/cors.md
    path: cors
---

Attaches to: {{< badge content="Route" path="/configuration/routes/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="cors" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * All three example configs (Simplified LLM, Simplified MCP, and
#     Routing-based) are accepted by agentgateway (--validate-only), covering
#     `allowOrigins`, `allowMethods`, `allowHeaders`, `exposeHeaders`,
#     `allowCredentials`, and `maxAge` in both duration (`10m`, `100s`) forms.
#   * The "Origin Allowed" branch of the CORS preflight diagram: with the
#     Routing-based config loaded, an OPTIONS preflight from
#     https://app.example.com returns 200 with access-control-allow-origin,
#     -allow-methods, -allow-headers, -allow-credentials, -expose-headers, and
#     -max-age set to the configured values (maxAge 100s is emitted as `100`).
#   * The "Origin NOT Allowed" branch: an OPTIONS preflight from an origin that
#     is not in `allowOrigins` still returns 200 but with no
#     access-control-allow-origin header, which is what causes the browser to
#     block the response.
#   * The actual (non-preflight) cross-origin request: the Routing-based config is
#     rerun with its placeholder backend (`api.example.com:443`) swapped for a
#     local echo backend, and a GET with an `Origin` header is asserted to reach
#     the backend AND come back with the CORS response headers attached - not
#     just the preflight the earlier assertion covers.
#   * The Simplified (MCP) config at runtime: rerun with a real npx-launched MCP
#     server (the same server used by the mcp/connect guides), and an OPTIONS
#     preflight against the MCP port asserts the CORS headers the settings list
#     documents, including `maxAge: 10m` resolving to a `600`-second header.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That a browser enforces the policy - different layer; as the page's own tip
#     notes, curl and other HTTP clients ignore CORS headers, so the test can only
#     assert the headers agentgateway returns.
#   * The Simplified (LLM) config at runtime - external dependency; it needs a
#     real OpenAI API key to reach a provider that could return CORS headers on
#     an actual completion, so it is only validated as config.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}

# The Simplified (LLM) example reads the API key from the environment.
# --validate-only still resolves env vars, so a placeholder is enough here.
export OPENAI_API_KEY="${OPENAI_API_KEY:-test}"
{{< /doc-test >}}

## About CORS

{{< gloss "CORS (Cross-Origin Resource Sharing)" >}}Cross-origin resource sharing (CORS){{< /gloss >}} is a browser security mechanism which allows a server to control which origins can request and interact with resources that are hosted on a different domain. By default, web browsers only allow requests to resources that are hosted on the same domain as the web page that served the original request. Access to web pages or resources that are hosted on a different domain is restricted to prevent potential security vulnerabilities, such as cross-site request forgery (CRSF).

When CORS is enabled in a web browser and a request for a different domain comes in, the web browser checks whether this request is allowed or not. To do that, it typically sends a preflight request (HTTP `OPTIONS` method) to the server or service that serves the requested resource. The service returns the methods that are permitted to send the actual cross-origin request, such as GET, POST, etc. If the request to the different domain is allowed, the response includes CORS-specific headers that instruct the web browser how to make the cross-origin request. For example, the CORS headers typically include the origin that is allowed to access the resource, and the credentials or headers that must be included in the cross-origin request.

Review the following diagram to see an example CORS request flow: 
```mermaid
sequenceDiagram
    participant B as Browser (JavaScript)
    participant AGW as Agentgateway Proxy
    participant Backend as Backend Service<br/>(LLM / MCP / Agent)

    Note over B,Backend: CORS Preflight Flow

    B->>AGW: OPTIONS /api (Preflight)<br/>Origin: https://app.example.com
    AGW->>AGW: Check origin against<br/>allowOrigins list

    alt Origin Allowed
        AGW-->>B: 200 OK<br/>access-control-allow-origin: https://app.example.com<br/>access-control-allow-methods: GET, POST, OPTIONS<br/>access-control-allow-headers: Authorization, Content-Type<br/>access-control-max-age: 86400
        B->>AGW: POST /api (Actual Request)<br/>Origin: https://app.example.com<br/>Authorization: Bearer <token>
        AGW->>Backend: Forward request
        Backend-->>AGW: Response
        AGW-->>B: Response + CORS headers
    else Origin NOT Allowed
        AGW-->>B: 200 OK (no CORS headers)<br/>Browser blocks the response
        Note over B: Browser denies access<br/>to response data
    end
```

Note that the preflight request is optional. Web browsers can also be configured to send the cross-origin directly. However, access to the request resource is granted only if CORS headers were returned in the response. If no headers are returned during the preflight request, the web browser denies access to the resource in the other domain.

CORS policies are typically implemented to limit access to server resources for JavaScripts that are embedded in a web page, such as:

* A JavaScript on a web page at `example.com` tries to access a different domain, such as `api.com`.
* A JavaScript on a web page at `example.com` tries to access a different subdomain, such as `api.example.com`.
* A JavaScript on a web page at `example.com` tries to access a different port, such as `example.com:3001`.
* A JavaScript on a web page at `https://example.com` tries to access the resources by using a different protocol, such as `http://example.com`.

> [!TIP]
> Requests that violate the CORS policy will still have responses returned, but the browser will reject them. As such, usage of tools like `curl` with `cors` can be confusing, as `curl` does not respect CORS headers.

- `allowOrigins`
- `allowMethods`
- `allowHeaders`
- `exposeHeaders`
- `allowCredentials`
- `maxAge`

{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    cors:
      allowOrigins:
      - https://chat.example.com
      allowMethods:
      - POST
      - OPTIONS
      allowHeaders:
      - authorization
      - content-type
      exposeHeaders:
      - x-request-id
      allowCredentials: true
      maxAge: 10m
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```
{{< /tab >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    cors:
      allowOrigins:
      - https://chat.example.com
      allowMethods:
      - POST
      - OPTIONS
      allowHeaders:
      - authorization
      - content-type
      exposeHeaders:
      - x-request-id
      allowCredentials: true
      maxAge: 10m
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```
{{< /tab >}}
{{< tab name="Routing-based" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: api.example.com:443
  policies:
    cors:
      allowOrigins:
      - https://app.example.com
      allowMethods:
      - GET
      - POST
      - OPTIONS
      allowHeaders:
      - authorization
      - content-type
      exposeHeaders:
      - x-request-id
      allowCredentials: true
      maxAge: 100s
```
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="cors" >}}
cat <<'EOF' > config-llm.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    cors:
      allowOrigins:
      - https://chat.example.com
      allowMethods:
      - POST
      - OPTIONS
      allowHeaders:
      - authorization
      - content-type
      exposeHeaders:
      - x-request-id
      allowCredentials: true
      maxAge: 10m
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
EOF
agentgateway -f config-llm.yaml --validate-only

cat <<'EOF' > config-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    cors:
      allowOrigins:
      - https://chat.example.com
      allowMethods:
      - POST
      - OPTIONS
      allowHeaders:
      - authorization
      - content-type
      exposeHeaders:
      - x-request-id
      allowCredentials: true
      maxAge: 10m
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config-mcp.yaml --validate-only

cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: api.example.com:443
  policies:
    cors:
      allowOrigins:
      - https://app.example.com
      allowMethods:
      - GET
      - POST
      - OPTIONS
      allowHeaders:
      - authorization
      - content-type
      exposeHeaders:
      - x-request-id
      allowCredentials: true
      maxAge: 100s
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

{{< doc-test paths="cors" >}}
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null || true' EXIT
sleep 3
{{< /doc-test >}}

{{< doc-test paths="cors" >}}
YAMLTest -f - <<'EOF'
- name: Preflight from an allowed origin returns the configured CORS headers
  retries: 3
  http:
    url: "http://localhost:3000"
    path: /
    method: OPTIONS
    headers:
      origin: "https://app.example.com"
      access-control-request-method: GET
      access-control-request-headers: authorization
  source:
    type: local
  expect:
    statusCode: 200
    headers:
      - name: access-control-allow-origin
        comparator: equals
        value: "https://app.example.com"
      - name: access-control-allow-methods
        comparator: contains
        value: GET
      - name: access-control-allow-headers
        comparator: contains
        value: authorization
      - name: access-control-expose-headers
        comparator: contains
        value: x-request-id
      - name: access-control-allow-credentials
        comparator: equals
        value: "true"
      - name: access-control-max-age
        comparator: equals
        value: "100"
EOF
{{< /doc-test >}}

{{< doc-test paths="cors" >}}
# The "Origin NOT Allowed" branch of the diagram: agentgateway still answers the
# preflight, but omits access-control-allow-origin, which is what makes the
# browser block the response.
DISALLOWED_HEADERS=$(curl -s -i -X OPTIONS http://localhost:3000/ \
  -H "Origin: https://not-allowed.example.com" \
  -H "Access-Control-Request-Method: GET")
if grep -qi '^access-control-allow-origin' <<<"$DISALLOWED_HEADERS"; then
  echo "FAIL: preflight from a disallowed origin returned access-control-allow-origin"
  echo "$DISALLOWED_HEADERS"
  exit 1
fi
echo "✓ Preflight from a disallowed origin returned no access-control-allow-origin header"
{{< /doc-test >}}

{{< doc-test paths="cors" >}}
# Confirm CORS headers reach an actual (non-preflight) cross-origin request, not
# just the preflight asserted above. Rerun the Routing-based config with its
# placeholder backend (api.example.com:443) swapped for a local echo backend, so
# a GET with an Origin header has something to forward to.
kill $AGW_PID 2>/dev/null || true
wait $AGW_PID 2>/dev/null || true

cat <<'PYEOF' > backend.py
from http.server import BaseHTTPRequestHandler, HTTPServer

class Echo(BaseHTTPRequestHandler):
    def do_GET(self):
        body = b"ok"
        self.send_response(200)
        self.send_header("content-type", "text/plain")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass

HTTPServer(("127.0.0.1", 8081), Echo).serve_forever()
PYEOF
python3 backend.py &
BACKEND_PID=$!
trap 'kill $AGW_PID $BACKEND_PID 2>/dev/null || true' EXIT
for i in $(seq 1 30); do
  curl -sf -o /dev/null http://127.0.0.1:8081/ && break
  sleep 1
done

sed 's#api.example.com:443#localhost:8081#' config.yaml > config-cors-local.yaml
agentgateway -f config-cors-local.yaml &
AGW_PID=$!
sleep 3

RESPONSE=$(curl -s -i http://localhost:3000/ -H "Origin: https://app.example.com")
if ! grep -qi '^access-control-allow-origin: https://app.example.com' <<<"$RESPONSE"; then
  echo "FAIL: an actual cross-origin GET did not come back with access-control-allow-origin"
  echo "$RESPONSE"
  exit 1
fi
if ! grep -q '^ok$' <<<"$RESPONSE"; then
  echo "FAIL: the request was not actually forwarded to the backend"
  echo "$RESPONSE"
  exit 1
fi
echo "✓ An actual cross-origin request reached the backend and came back with CORS headers"

kill $AGW_PID $BACKEND_PID 2>/dev/null || true
wait $AGW_PID $BACKEND_PID 2>/dev/null || true
{{< /doc-test >}}

{{< doc-test paths="cors" >}}
# Confirm the Simplified (MCP) config's CORS policy works at runtime, using a
# real npx-launched MCP server (the same server the mcp/connect guides use) so
# no external dependency is needed.
agentgateway -f config-mcp.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null || true' EXIT
for i in $(seq 1 30); do
  curl -sf -o /dev/null --max-time 5 http://localhost:15021/healthz/ready && break
  sleep 2
done

MCP_HEADERS=$(curl -s -i -X OPTIONS http://127.0.0.1:3000/mcp \
  -H "Origin: https://chat.example.com" \
  -H "Access-Control-Request-Method: POST")
if ! grep -qi '^access-control-allow-origin: https://chat.example.com' <<<"$MCP_HEADERS"; then
  echo "FAIL: MCP port preflight did not return access-control-allow-origin"
  echo "$MCP_HEADERS"
  exit 1
fi
if ! grep -qi '^access-control-max-age: 600' <<<"$MCP_HEADERS"; then
  echo "FAIL: MCP port preflight's access-control-max-age was not 600 (maxAge: 10m)"
  echo "$MCP_HEADERS"
  exit 1
fi
echo "✓ The Simplified (MCP) CORS policy answers a real preflight against the MCP port"

kill $AGW_PID 2>/dev/null || true
wait $AGW_PID 2>/dev/null || true
{{< /doc-test >}}
