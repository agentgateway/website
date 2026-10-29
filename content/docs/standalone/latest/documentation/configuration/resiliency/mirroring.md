---
title: Mirroring
weight: 10
description: Send copies of requests to alternative backends for shadow testing.
---

Attaches to: {{< badge content="Route" path="/documentation/configuration/routes/">}} {{< badge content="Backend" path="/documentation/configuration/backends/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

Request {{< gloss "Mirroring" >}}mirroring{{< /gloss >}} allows sending a copy of each request to an alternative backend.
These requests will not be retried if they fail.
Set `percentage` to a value from `0.0` to `1.0`. For example, `0.5` mirrors half of the requests. Agentgateway rejects a configuration with a value outside that range, such as `percentage: 50`.

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
gateways:
  default:
    port: 3000
routes:
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