---
title: Mirroring
weight: 10
description: Send copies of requests to alternative backends for shadow testing.
test:
  mirroring:
  - file: content/docs/standalone/main/configuration/resiliency/mirroring.md
    path: mirroring
---

Attaches to: {{< badge content="Route" path="/configuration/routes/">}} {{< badge content="Backend" path="/configuration/backends/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="mirroring" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

Request {{< gloss "Mirroring" >}}mirroring{{< /gloss >}} allows sending a copy of each request to an alternative backend.
These requests will not be retried if they fail.

{{< tabs >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    requestMirror:
      backend:
        host: localhost:8080
      # Mirror 50% of requests
      percentage: 0.5
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
        requestMirror:
          backend:
            host: localhost:8080
          # Mirror 50% of requests
          percentage: 0.5
      backends:
      - host: localhost:8000
```
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="mirroring" >}}
# WHAT THIS TEST VALIDATES:
#   * The requestMirror policy is accepted by agentgateway in both the
#     routing-based (binds) and simplified MCP (mcp.policies) forms.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That requests are actually mirrored at runtime — requires live primary
#     and mirror backends the page omits to send to and inspect.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        requestMirror:
          backend:
            host: localhost:8080
          # Mirror 50% of requests
          percentage: 0.5
      backends:
      - host: localhost:8000
EOF
agentgateway -f config.yaml --validate-only

cat <<'EOF' > config-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    requestMirror:
      backend:
        host: localhost:8080
      # Mirror 50% of requests
      percentage: 0.5
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config-mcp.yaml --validate-only
{{< /doc-test >}}