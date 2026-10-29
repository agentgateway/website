---
title: Rewrites
weight: 13
description: Rewrite the host or path of a request before agentgateway forwards it to a backend.
---

Attaches to: {{< badge content="Route" path="/documentation/configuration/routes/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

Modify URLs of incoming requests with {{< gloss "Rewrite" >}}rewrite{{< /gloss >}} policies.

Start the `path.full` and `path.prefix` values with `/`. If you use `path.prefix` on a route that does not delegate to a route group, every match on the route must use `pathPrefix`. Agentgateway rejects a configuration that does not follow these rules.

For example, the following configuration modifies the request hostname to `example.com` and the request path to `/new-path`.

{{< tabs >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    urlRewrite:
      authority:
        full: example.com
      path:
        full: /new-path
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
    urlRewrite:
      authority:
        full: example.com
      path:
        full: /new-path
  backends:
  - host: example.com:443
```
{{< /tab >}}
{{< /tabs >}}