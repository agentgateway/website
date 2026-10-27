---
title: Retries
weight: 10
description: Configure automatic retry attempts for failed backend requests.
test:
  retries:
  - file: ${versionRoot}/documentation/configuration/resiliency/retries.md
    path: retries
---

Attaches to: {{< badge content="Route" path="/documentation/configuration/routes/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="retries" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

When a backend request fails, agentgateway can be configured to *{{< gloss "Retry" >}}retry{{< /gloss >}}* the request.
Every retry goes to the same route backend as the original request. When a request arrives, agentgateway selects one entry from the route's `backends` list by weight, and every retry reuses that entry. If that backend has several endpoints, agentgateway selects an endpoint again for each retry, so a retry can reach a different endpoint. The endpoint that just failed is not excluded from that selection.

> [!NOTE]
> Retries alone do not fail over between route backends. If a route has two `backends` entries and the selected entry keeps failing, the request fails after its last retry, even when the other entry is healthy. To fail over between LLM providers, use [failover routing]({{< link-hextra path="/documentation/llm/virtual-models/#failover-routing" >}}) in a virtual model, which moves traffic to the next priority group after every target in the current group is evicted.

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
gateways:
  default:
    port: 3000
routes:
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
#     (gateways) and simplified MCP (mcp.policies) forms.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That failed requests are actually retried at runtime — requires a backend
#     that returns the retry-able codes the page omits to drive the behavior.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
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