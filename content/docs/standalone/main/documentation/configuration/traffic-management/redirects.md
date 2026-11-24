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
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
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
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
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

Each part of the redirect is optional. The redirect keeps every part of the request URL that you do not set.

| Setting | Description |
| --- | --- |
| `scheme` | Replaces the scheme. If you set `scheme` to `http` or `https` without `authority`, the redirect drops the port of the request, so the client uses the default port of the new scheme. |
| `authority.full` | Replaces the host and the port. |
| `authority.host` | Replaces the host. The redirect keeps the port of the request, unless you also set `scheme`. |
| `authority.port` | Replaces the port. If the port is the default port of the scheme, such as `443` for `https`, the `location` header leaves out the port. |
| `path.full` | Replaces the path, and keeps the query string. |
| `path.prefix` | Replaces the part of the path that the route's `pathPrefix` match matched, and keeps the rest of the path and the query string. |
| `status` | Sets the status code of the redirect response. Defaults to `302`. |

The following table shows the `location` header for a few redirect settings.

| Request | Route match and redirect settings | `location` header |
| --- | --- | --- |
| `http://localhost:3000/old-host/a?x=1` | `authority.host: example.com` | `http://example.com:3000/old-host/a?x=1` |
| `http://localhost:3000/v1/users?x=1` | `pathPrefix: /v1` match, `path.prefix: /v2` | `http://localhost:3000/v2/users?x=1` |
| `http://localhost:3000/secure/a` | `scheme: https` | `https://localhost/secure/a` |
