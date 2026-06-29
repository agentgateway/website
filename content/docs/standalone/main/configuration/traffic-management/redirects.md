---
title: Redirects
weight: 11
description: Return direct redirect responses to send users to another location.
test:
  redirects:
  - file: content/docs/standalone/main/configuration/traffic-management/redirects.md
    path: redirects
---

Attaches to: {{< badge content="Route" path="/configuration/routes/">}} {{< badge content="Backend" path="/configuration/backends/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="redirects" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

Request {{< gloss "Redirect" >}}redirects{{< /gloss >}} allow returning a direct response redirecting users to another location.

For example, the following configuration will return a `307 Temporary Redirect` response with the header `location: https://example.com/new-path`:

{{< tabs >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    requestRedirect:
      scheme: https
      authority:
        full: example.com
      path:
        full: /new-path
      status: 307
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
        requestRedirect:
          scheme: https
          authority:
            full: example.com
          path:
            full: /new-path
          status: 307
```
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="redirects" >}}
# WHAT THIS TEST VALIDATES:
#   * The requestRedirect example config is accepted by agentgateway in both the
#     routing-based (binds) and simplified MCP (mcp.policies) forms.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That a 307 redirect is actually returned at runtime — requires sending a
#     request and inspecting the response, which the page does not demonstrate.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        requestRedirect:
          scheme: https
          authority:
            full: example.com
          path:
            full: /new-path
          status: 307
EOF
agentgateway -f config.yaml --validate-only

cat <<'EOF' > config-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    requestRedirect:
      scheme: https
      authority:
        full: example.com
      path:
        full: /new-path
      status: 307
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config-mcp.yaml --validate-only
{{< /doc-test >}}