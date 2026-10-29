---
title: Direct Response
weight: 14
description: Serve a fixed status code and response body directly from agentgateway instead of forwarding to a backend.
---

Attaches to: {{< badge content="Route" path="/documentation/configuration/routes/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

Directly respond to a request with a custom response using {{< gloss "Direct Response" >}}direct response{{< /gloss >}}, without forwarding to any backend.

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
gateways:
  default:
    port: 3000
routes:
- policies:
    directResponse:
      body: "Not found!"
      status: 404
```
{{< /tab >}}
{{< /tabs >}}

Set either `body` or `bodyExpression`, not both. Agentgateway rejects a configuration with a direct response policy that sets both fields.

## Conditional execution

To return a direct response only when a CEL expression matches, use the `conditional` field. For example, you can return `410 Gone` on deprecated paths and let every other request reach the backend. For details, see [Conditional policies]({{< link-hextra path="/documentation/configuration/policies/conditional-policies" >}}).
