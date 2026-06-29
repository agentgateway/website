---
title: Direct Response
weight: 14
description: Return custom responses directly without forwarding to a backend.
test:
  direct-response:
  - file: content/docs/standalone/main/configuration/traffic-management/direct-response.md
    path: direct-response
---

Attaches to: {{< badge content="Route" path="/configuration/routes/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

Directly respond to a request with a custom response using {{< gloss "Direct Response" >}}direct response{{< /gloss >}}, without forwarding to any backend.

{{< doc-test paths="direct-response" >}}
# WHAT THIS TEST VALIDATES:
#   * The direct response example config loads and serves: the gateway returns
#     the configured 404 status directly, without a backend.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The conditional-execution variant — requires config/traffic the page omits
#     (the `conditional` field is documented on a separate page).
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

For example, the following configuration returns a `404 Not found!` response.

{{< tabs >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    directResponse:
      body: "Not found!"
      status: 404
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
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        directResponse:
          body: "Not found!"
          status: 404
```
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="direct-response" >}}
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        directResponse:
          body: "Not found!"
          status: 404
EOF

cat <<'EOF' > config-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    directResponse:
      body: "Not found!"
      status: 404
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config-mcp.yaml --validate-only
{{< /doc-test >}}

{{< doc-test paths="direct-response" >}}
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3
{{< /doc-test >}}

{{< doc-test paths="direct-response" >}}
YAMLTest -f - <<'EOF'
- name: Direct response returns configured 404
  http:
    url: "http://localhost:3000"
    path: /
    method: GET
  source:
    type: local
  expect:
    statusCode: 404
EOF
{{< /doc-test >}}

## Conditional execution

To return a direct response only when a CEL expression matches, use the `conditional` field. For example, you can return `410 Gone` on deprecated paths and let every other request reach the backend. For details, see [Conditional policies]({{< link-hextra path="/configuration/policies/conditional-policies" >}}).
