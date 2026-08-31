---
title: Routes
weight: 30
description: Match HTTP and TCP traffic on a gateway and forward it to backends.
next: /configuration/traffic-management
test:
  routes:
  - file: ${versionRoot}/configuration/routes.md
    path: routes
---

{{< doc-test paths="routes" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "HTTP routes": the example config is accepted by agentgateway
#     (--validate-only), covering the `gateways`, `protocol: HTTP`, `name`,
#     `gateways: [...]`, `hostnames`, `matches.path.pathPrefix`, and
#     `backends[].host` / `weight` fields the route table documents.
#   * "TCP routes": the `tcpRoutes` example is accepted, covering `protocol: TCP`
#     and the simpler TCP route structure.
#   * "Example configuration with policies": the route-with-CORS example is
#     accepted, covering `policies.cors` on a route and an inline `backends[].mcp`
#     backend with a `stdio` target.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That traffic is actually matched and forwarded - requires config/traffic the
#     page omits; every example points at a placeholder backend
#     (`http.example.com:8080`, `postgres.example.com:5432`) that the test cannot
#     stand up, so only config acceptance is asserted.
#   * The `matches` header, method, and query options, and the "attaches to the
#     gateway named `default`" fallback - display-only table rows with no example
#     config on this page. Matching is covered by the Request matching guide.
#   * The CORS policy's runtime behavior - covered by the CORS guide's own test;
#     here the block only proves the policy is accepted on a route.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

{{< gloss "Route" >}}Routes{{< /gloss >}} are the entry points for traffic to your agentgateway. They attach to [gateways]({{< link-hextra path="/documentation/configuration/gateways/" >}}) and are used to route traffic to {{< gloss "Backend" >}}backends{{< /gloss >}}.

## Types of routes

You can configure two types of routes: HTTP routes (`routes`) and TCP routes (`tcpRoutes`).

### HTTP routes

[HTTP or HTTPS gateways](../listeners/) use `routes` to configure HTTP routes. HTTP routes support all HTTP features such as path, header, method, or query {{< gloss "Matching" >}}matching{{< /gloss >}}, and HTTP-specific filters and {{< gloss "Policy" >}}policies{{< /gloss >}}.

Example configuration:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  http-proxy:
    port: 8080
    protocol: HTTP
routes:
- name: http-backend
  gateways: [http-proxy]
  hostnames:
  - "example.com"
  matches:
  - path:
      pathPrefix: /
  backends:
  - host: http.example.com:8080
    weight: 1
```

{{< doc-test paths="routes" >}}
cat <<'EOF' > config-http.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  http-proxy:
    port: 8080
    protocol: HTTP
routes:
- name: http-backend
  gateways: [http-proxy]
  hostnames:
  - "example.com"
  matches:
  - path:
      pathPrefix: /
  backends:
  - host: http.example.com:8080
    weight: 1
EOF
agentgateway -f config-http.yaml --validate-only
{{< /doc-test >}}

HTTP routes support various matching options for incoming requests. For more information, see the [Request matching]({{< link-hextra path="/documentation/configuration/traffic-management/matching/" >}}) guide.

### TCP routes

[TCP gateways](../listeners) use `tcpRoutes` instead of `routes`. TCP routes have a simpler structure than HTTP routes.

Keep in mind that TCP routes do not support HTTP features such as path, header, method, or query matching, and HTTP-specific filters and policies.

Example configuration:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  postgres-proxy:
    port: 5432
    protocol: TCP
tcpRoutes:
- name: postgres-backend
  gateways: [postgres-proxy]
  backends:
  - host: postgres.example.com:5432
    weight: 1
```

{{< doc-test paths="routes" >}}
cat <<'EOF' > config-tcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  postgres-proxy:
    port: 5432
    protocol: TCP
tcpRoutes:
- name: postgres-backend
  gateways: [postgres-proxy]
  backends:
  - host: postgres.example.com:5432
    weight: 1
EOF
agentgateway -f config-tcp.yaml --validate-only
{{< /doc-test >}}

For more information, see [TCP route matching]({{< link-hextra path="/documentation/configuration/traffic-management/matching#tcp-routes" >}}).

## Route configuration

Routes are configured in the top-level `routes` or `tcpRoutes` section. The following fields are available for route configuration:

| Field | Description |
|-------|-------------|
| `gateways` | The gateways that the route attaches to, in the form `<gateway-name>` or `<gateway-name>/<listener-name>`. When omitted, the route attaches to the gateway named `default`. |
| `name` | An optional name for the route. |
| `hostnames` | A list of hostnames that the route serves traffic on. |
| `matches` | Defines the matching rules for the route, including path, headers, methods, and query parameters. For more options, see the [Request matching]({{< link-hextra path="/documentation/configuration/traffic-management/matching/" >}}) guide. |
| `backends` | Specifies the {{< gloss "Backend" >}}backend{{< /gloss >}} services to route traffic to. |
| `policies` | Optional {{< gloss "Policy" >}}policies{{< /gloss >}} to apply to the route. |

### Backend configuration

Routes send traffic to backends, which can be configured with the following fields:

| Field | Description |
|-------|-------------|
| `host` | The hostname or IP address of the backend. |
| `weight` | The weight for load balancing across multiple backends. |

For more advanced backend configurations, such as MCP servers and LLM providers, see the [Backends]({{< link-hextra path="/documentation/configuration/backends" >}}) documentation.

### Example configuration with policies

The following example shows a route with CORS policy configuration:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
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

{{< doc-test paths="routes" >}}
cat <<'EOF' > config-policies.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
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
EOF
agentgateway -f config-policies.yaml --validate-only
{{< /doc-test >}}

## Next steps

After you configure routes, you might want to apply policies to them or learn more about traffic management options.

{{< cards >}}
  {{< card path="/documentation/configuration/traffic-management/matching/" title="Request matching" >}}
  {{< card path="/documentation/configuration/traffic-management/" title="Traffic management" >}}
  {{< card path="/documentation/configuration/resiliency/" title="Resiliency" >}}
  {{< card path="/documentation/configuration/security/" title="Security" >}}
{{< /cards >}}
