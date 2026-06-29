---
title: Header manipulation
weight: 10
description: Add, set, or remove HTTP request and response headers.
test:
  manipulation:
  - file: content/docs/standalone/main/configuration/traffic-management/manipulation.md
    path: manipulation
---

Attaches to: {{< badge content="Route" path="/configuration/routes/">}} {{< badge content="Backend" path="/configuration/backends/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="manipulation" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

There are a few different policies that offer manipulation of HTTP requests and responses.

The `requestHeaderModifier` and `responseHeaderModifier` modify request and response headers respectively.
These allow you to `add`, `set`, or `remove` headers.
`add` and `set` differ in the case the header already exists; `set` will replace it while `add` will append.

{{< tabs >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    requestHeaderModifier:
      add:
        x-req-added: value
      remove:
      - x-remove-me
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
        requestHeaderModifier:
          add:
            x-req-added: value
          remove:
          - x-remove-me
      backends:
      - host: localhost:8080
```
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="manipulation" >}}
# WHAT THIS TEST VALIDATES:
#   * The requestHeaderModifier example config is accepted by agentgateway in
#     both the routing-based (binds) and simplified MCP (mcp.policies) forms.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That headers are actually added/removed at runtime — requires a backend
#     the page omits to forward to and inspect.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        requestHeaderModifier:
          add:
            x-req-added: value
          remove:
          - x-remove-me
      backends:
      - host: localhost:8080
EOF
agentgateway -f config.yaml --validate-only

cat <<'EOF' > config-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    requestHeaderModifier:
      add:
        x-req-added: value
      remove:
      - x-remove-me
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config-mcp.yaml --validate-only
{{< /doc-test >}}

More advanced operations are available with the [`transformation` policy](../transformations).
Like the `HeaderModifier` policies, this can also `add`, `set`, or `remove` headers, but can also manipulate HTTP bodies.
Additionally, each modification is based on a [CEL expression]({{< link-hextra path="/configuration/traffic-management/transformations" >}}) rather than static strings.