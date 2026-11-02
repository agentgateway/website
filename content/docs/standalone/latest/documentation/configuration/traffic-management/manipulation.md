---
title: Header manipulation
weight: 10
description: Add, set, or remove HTTP request and response headers.
---

Attaches to: {{< badge content="Route" path="/documentation/configuration/routes/">}} {{< badge content="Backend" path="/documentation/configuration/backends/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

There are a few different policies that offer manipulation of HTTP requests and responses.

The `requestHeaderModifier` and `responseHeaderModifier` modify request and response headers respectively.
These allow you to `add`, `set`, or `remove` headers.
`add` and `set` differ in the case the header already exists; `set` will replace it while `add` will append.
Agentgateway rejects a configuration with a header modifier that contains an invalid HTTP header name or value.

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
gateways:
  default:
    port: 3000
routes:
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

More advanced operations are available with the [`transformation` policy](../transformations).
Like the `HeaderModifier` policies, this can also `add`, `set`, or `remove` headers, but can also manipulate HTTP bodies.
Additionally, each modification is based on a [CEL expression]({{< link-hextra path="/documentation/configuration/traffic-management/transformations" >}}) rather than static strings.