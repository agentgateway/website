---
title: Redirects
weight: 11
description: Return a redirect response that rewrites the scheme, host, path, or status code before a request reaches any backend.
---

Attaches to: {{< badge content="Route" path="/documentation/configuration/routes/">}} {{< badge content="Backend" path="/documentation/configuration/backends/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

Request {{< gloss "Redirect" >}}redirects{{< /gloss >}} allow returning a direct response redirecting users to another location.

Start the `path.full` and `path.prefix` values with `/`. If you use `path.prefix` on a route that does not delegate to a route group, every match on the route must use `pathPrefix`. Agentgateway rejects a configuration that does not follow these rules.

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
gateways:
  default:
    port: 3000
routes:
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