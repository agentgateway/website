---
title: Retries
weight: 10
description: Configure automatic retry attempts for failed backend requests.
---

Attaches to: {{< badge content="Route" path="/documentation/configuration/routes/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

When a backend request fails, agentgateway can be configured to *{{< gloss "Retry" >}}retry{{< /gloss >}}* the request. Keep in mind that each retry goes to the same route backend as the original request. For LLM traffic, if you also want to configure failover so that an endpoint is marked as unhealthy and a request tried with a different endpoint, use [failover routing with virtual models]({{< link-hextra path="/documentation/llm/virtual-models/#failover-routing" >}}).

{{< tabs >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    retry:
      # Maximum number of retries after the original request.
      # Note: A value of 3 allows up to 3 retries after the initial attempt.
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
      # Maximum number of retries after the original request.
      # Note: A value of 3 allows up to 3 retries after the initial attempt.
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

When a request has retries enabled and an HTTP body, the request body will be buffered.
If the total body size exceeds a threshold size, retries are disabled.