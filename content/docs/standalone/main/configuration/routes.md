---
title: Routes
weight: 14
description: Configure routes on listeners for agentgateway.
next: /configuration/traffic-management
---

{{< gloss "Route" >}}Routes{{< /gloss >}} are the entry points for traffic to your agentgateway. They are configured on listeners and are used to route traffic to {{< gloss "Backend" >}}backends{{< /gloss >}}.

## Types of routes

You can configure two types of routes: HTTP routes (`routes`) and TCP routes (`tcpRoutes`).

### HTTP routes

[HTTP or HTTPS listeners](../listeners/) use `routes` to configure HTTP routes. HTTP routes support all HTTP features such as path, header, method, or query {{< gloss "Matching" >}}matching{{< /gloss >}}, and HTTP-specific filters and {{< gloss "Policy" >}}policies{{< /gloss >}}.

Example configuration:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 8080
  listeners:
  - name: http-proxy
    protocol: HTTP
    routes:
    - name: http-backend
      hostnames:
      - "example.com"
      matches:
      - path:
          type: PathPrefix
          value: /
      backends:
      - host: http.example.com:8080
        weight: 1
```

HTTP routes support various matching options for incoming requests. For more information, see the [Request matching]({{< link-hextra path="/configuration/traffic-management/matching/" >}}) guide.

### TCP routes

[TCP listeners](../listeners) use `tcpRoutes` instead of `routes`. TCP routes have a simpler structure than HTTP routes.

Keep in mind that TCP routes do not support HTTP features such as path, header, method, or query matching, and HTTP-specific filters and policies.

Example configuration:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 5432
  listeners:
  - name: postgres-proxy
    protocol: TCP
    tcpRoutes:
    - name: postgres-backend
      backends:
      - host: postgres.example.com:5432
        weight: 1
```

For more information, see [TCP route matching]({{< link-hextra path="/configuration/traffic-management/matching#tcp-routes" >}}).

## Route configuration

Routes are configured within the `routes` or `tcpRoutes` section of a listener. The following fields are available for route configuration:

| Field | Description |
|-------|-------------|
| `name` | An optional name for the route. |
| `hostnames` | A list of hostnames that the route serves traffic on. |
| `matches` | Defines the matching rules for the route, including path, headers, methods, and query parameters. For more options, see the [Request matching]({{< link-hextra path="/configuration/traffic-management/matching/" >}}) guide. |
| `backends` | Specifies the {{< gloss "Backend" >}}backend{{< /gloss >}} services to route traffic to. |
| `policies` | Optional {{< gloss "Policy" >}}policies{{< /gloss >}} to apply to the route. |

### Backend configuration

Routes send traffic to backends, which can be configured with the following fields:

| Field | Description |
|-------|-------------|
| `host` | The hostname or IP address of the backend. |
| `weight` | The weight for load balancing across multiple backends. |

For more advanced backend configurations, such as MCP servers and LLM providers, see the [Backends]({{< link-hextra path="/configuration/backends" >}}) documentation.

### Example configuration with policies

The following example shows a route with CORS policy configuration:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        cors:
          allowOrigins:
          - "*"
          allowHeaders:
          - mcp-protocol-version
          - content-type
          - cache-control
          exposeHeaders:
          - "Mcp-Session-Id"
      backends:
      - mcp:
          targets:
          - name: everything
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
```

## Next steps

After you configure routes, you might want to apply policies to them or learn more about traffic management options.

{{< cards >}}
  {{< card path="/configuration/traffic-management/matching/" title="Request matching" >}}
  {{< card path="/configuration/traffic-management/" title="Traffic management" >}}
  {{< card path="/configuration/resiliency/" title="Resiliency" >}}
  {{< card path="/configuration/security/" title="Security" >}}
{{< /cards >}}
