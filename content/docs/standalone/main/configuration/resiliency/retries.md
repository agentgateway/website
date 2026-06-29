---
title: Retries
weight: 10
description: Configure automatic retry attempts for failed backend requests.
test:
  retries:
  - file: content/docs/standalone/main/configuration/resiliency/retries.md
    path: retries
---

Attaches to: {{< badge content="Route" path="/configuration/routes/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="retries" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

When a backend request fails, agentgateway can be configured to *{{< gloss "Retry" >}}retry{{< /gloss >}}* the request.
When a retry is attempted, a different backend will be preferred (if possible).

{{< tabs >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    retry:
      # total number of attempts allowed.
      # Note: 1 attempt implies no retries; the initial attempt is included in the count.
      attempts: 3
      # Optional; if set, a delay between each additional attempt
      backoff: 500ms
      # A list of HTTP response codes to consider retry-able.
      # In addition, retries are always permitted if the request to a backend was never started.
      codes: [429, 500, 503]
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
        retry:
          # total number of attempts allowed.
          # Note: 1 attempt implies no retries; the initial attempt is included in the count.
          attempts: 3
          # Optional; if set, a delay between each additional attempt
          backoff: 500ms
          # A list of HTTP response codes to consider retry-able.
          # In addition, retries are always permitted if the request to a backend was never started.
          codes: [429, 500, 503]
      backends:
      - host: localhost:8080
```
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="retries" >}}
# WHAT THIS TEST VALIDATES:
#   * The retry policy is accepted by agentgateway in both the routing-based
#     (binds) and simplified MCP (mcp.policies) forms.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That failed requests are actually retried at runtime — requires a backend
#     that returns the retry-able codes the page omits to drive the behavior.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        retry:
          # total number of attempts allowed.
          # Note: 1 attempt implies no retries; the initial attempt is included in the count.
          attempts: 3
          # Optional; if set, a delay between each additional attempt
          backoff: 500ms
          # A list of HTTP response codes to consider retry-able.
          # In addition, retries are always permitted if the request to a backend was never started.
          codes: [429, 500, 503]
      backends:
      - host: localhost:8080
EOF
agentgateway -f config.yaml --validate-only

cat <<'EOF' > config-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    retry:
      # total number of attempts allowed.
      # Note: 1 attempt implies no retries; the initial attempt is included in the count.
      attempts: 3
      # Optional; if set, a delay between each additional attempt
      backoff: 500ms
      # A list of HTTP response codes to consider retry-able.
      # In addition, retries are always permitted if the request to a backend was never started.
      codes: [429, 500, 503]
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config-mcp.yaml --validate-only
{{< /doc-test >}}

When a request has retries enabled and an HTTP body, the request body will be buffered.
If the total body size exceeds a threshold size, retries are disabled.