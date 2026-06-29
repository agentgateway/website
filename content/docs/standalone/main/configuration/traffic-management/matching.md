---
title: Request matching
weight: 9
description: Match incoming requests by path, headers, methods, and query parameters.
test:
  matching:
  - file: content/docs/standalone/main/configuration/traffic-management/matching.md
    path: matching
---

Based on the route schema (see the [configuration reference]({{< link-hextra path="/reference/configuration/" >}}) for the full field reference and [schema validation]({{< link-hextra path="/reference/configuration/validation/" >}}) for IDE integration), you can configure the following {{< gloss "Matching" >}}matching{{< /gloss >}} conditions for HTTP or TCP routes.

Request matching is a routing-based feature: routes and their match conditions are configured under `binds`. The simplified `llm` configuration supports header-based model matching (`llm.models[].matches`), but path, method, and query matching require routing-based configuration. For more information about the configuration styles, see [Routing-based configuration]({{< link-hextra path="/llm/configuration-modes/" >}}).

{{< doc-test paths="matching" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

## HTTP routes

For routes configured with [HTTP or HTTPS listeners]({{< link-hextra path="/configuration/listeners/" >}}), you can configure the following matching conditions. These matching conditions do not apply to [TLS listeners]({{< link-hextra path="/configuration/listeners#tls-listeners" >}}), which use TCP routes and only support hostname-based matching.

### Path matching

Match incoming requests based on their path using one of the following strategies.

If no path match is specified, the default is to match all paths (`/`).

| Type        | Example                              | Description                                 |
|-------------|--------------------------------------|---------------------------------------------|
| Exact       | `{ "exact": "/foo/bar" }`            | Matches only the exact path `/foo/bar`      |
| Prefix      | `{ "pathPrefix": "/foo" }`           | Matches any path starting with `/foo`       |
| Regex       | `{ "regex": ["^/foo/[0-9]+$", 0] }`  | Matches paths using a regular expression    |

{{< callout type="info">}}
Only one of `exact`, `pathPrefix`, or `regex` can be specified per path matcher.
{{< /callout >}}

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

{{< tabs >}}
{{< tab name="Exact path matching" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - name: api-exact
      matches:
      - path:
          exact: "/api/v1/users"
      backends:
      - host: api.example.com:8080
```
{{< /tab >}}
{{< tab name="Prefix path matching" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - name: api-prefix
      matches:
      - path:
          pathPrefix: "/api/v1"
      backends:
      - host: api.example.com:8080
```
{{< /tab >}}
{{< tab name="Regex path matching" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - name: api-regex
      matches:
      - path:
          regex: ["^/api/v[0-9]+/users$", 0]
      backends:
      - host: api.example.com:8080
```
{{< /tab >}}
{{< /tabs >}}

### Header matching

Match incoming requests based on HTTP headers included in the request.

- **Exact match:**  
  `{ "name": "Authorization", "value": { "exact": "Bearer token" } }`
- **Regex match:**  
  `{ "name": "Authorization", "value": { "regex": "^Bearer .*" } }`

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

{{< tabs >}}
{{< tab name="Exact header matching" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - name: auth-exact
      matches:
      - path:
          pathPrefix: "/api"
        headers:
        - name: "Authorization"
          value:
            exact: "Bearer abc123token"
      backends:
      - host: api.example.com:8080
```
{{< /tab >}}
{{< tab name="Regex header matching" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - name: auth-regex
      matches:
      - path:
          pathPrefix: "/api"
        headers:
        - name: "Authorization"
          value:
            regex: "^Bearer .*"
      backends:
      - host: api.example.com:8080
```
{{< /tab >}}
{{< tab name="Multiple header matching" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - name: multi-header
      matches:
      - path:
          pathPrefix: "/api"
        headers:
        - name: "Authorization"
          value:
            regex: "^Bearer .*"
        - name: "Content-Type"
          value:
            exact: "application/json"
      backends:
      - host: api.example.com:8080
```
{{< /tab >}}
{{< /tabs >}}

### Method matching

Optionally restrict matches to specific HTTP methods.

```json
{ "method": { "method": "GET" } }
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

{{< tabs >}}
{{< tab name="GET method matching" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - name: get-only
      matches:
      - path:
          pathPrefix: "/api"
        method: "GET"
      backends:
      - host: api.example.com:8080
```
{{< /tab >}}
{{< tab name="POST method matching" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - name: post-only
      matches:
      - path:
          pathPrefix: "/api/users"
        method: "POST"
      backends:
      - host: api.example.com:8080
```
{{< /tab >}}
{{< tab name="Multiple methods with different backends" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - name: read-operations
      matches:
      - path:
          pathPrefix: "/api/users"
        method: "GET"
      backends:
      - host: read-api.example.com:8080
    - name: write-operations
      matches:
      - path:
          pathPrefix: "/api/users"
        method: "POST"
      backends:
      - host: write-api.example.com:8080
```
{{< /tab >}}
{{< /tabs >}}

### Query parameter matching

Match on query parameters, either by exact value or regex.

- **Exact:**  
  `{ "name": "version", "value": { "exact": "v1" } }`
- **Regex:**  
  `{ "name": "version", "value": { "regex": "^v[0-9]+$" } }`

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

{{< tabs >}}
{{< tab name="Exact query parameter matching" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - name: version-exact
      matches:
      - path:
          pathPrefix: "/api"
        query:
        - name: "version"
          value:
            exact: "v1"
      backends:
      - host: api-v1.example.com:8080
```
{{< /tab >}}
{{< tab name="Regex query parameter matching" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - name: version-regex
      matches:
      - path:
          pathPrefix: "/api"
        query:
        - name: "version"
          value:
            regex: "^v[0-9]+$"
      backends:
      - host: api.example.com:8080
```
{{< /tab >}}
{{< tab name="Multiple query parameters" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - name: multi-query
      matches:
      - path:
          pathPrefix: "/api"
        query:
        - name: "version"
          value:
            exact: "v1"
        - name: "format"
          value:
            regex: "^(json|xml)$"
      backends:
      - host: api.example.com:8080
```
{{< /tab >}}
{{< /tabs >}}

### Combined matching

You can combine multiple matching conditions to create a more specific route, such as the following example.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - name: comprehensive-match
      matches:
      - path:
          pathPrefix: "/api/v1"
        method: "GET"
        headers:
        - name: "Authorization"
          value:
            regex: "^Bearer .*"
        query:
        - name: "format"
          value:
            exact: "json"
      backends:
      - host: api.example.com:8080
```

{{< doc-test paths="matching" >}}
# WHAT THIS TEST VALIDATES:
#   * The combined-matching example config (path + method + header + query) is
#     accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * Runtime match behavior — requires a backend the page omits to route to.
#   * The other match-type variants on this page (exact/prefix/regex path,
#     header, method, query) are structurally analogous and not individually tested.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - name: comprehensive-match
      matches:
      - path:
          pathPrefix: "/api/v1"
        method: "GET"
        headers:
        - name: "Authorization"
          value:
            regex: "^Bearer .*"
        query:
        - name: "format"
          value:
            exact: "json"
      backends:
      - host: api.example.com:8080
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

## TCP routes

For routes configured with [TCP listeners]({{< link-hextra path="/configuration/routes#tcp-routes" >}}), you can configure the following matching conditions.

### Hostname matching

Match incoming requests based on the hostname included in the request. This is primarily used for TLS termination scenarios.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 5432
  listeners:
  - name: database-proxy
    protocol: TCP
    tcpRoutes:
    - name: database-backend
      hostnames:
      - "db.example.com"
      backends:
      - host: postgres.example.com:5432
```

### Backend routing

Route directly to backends. You can include multiple backends and weights to load balance across them.

Higher weights receive more traffic. Each new TCP connection is assigned to a backend proportionally based on the ratio of the weights.

In the following example, traffic is load balanced across the three backends in the ratio 1:2:1. The first backend receives 25% of the traffic, the second backend receives 50% of the traffic, and the third backend receives 25% of the traffic.

If no weight is specified, the default is 1. Backends with a weight of 0 receive no traffic. Each incoming TCP connection maintains a 1:1 mapping with an outgoing backend connection; once a connection is established, it remains bound to its assigned backend for the lifetime of that connection.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 6379
  listeners:
  - name: redis-proxy
    protocol: TCP
    tcpRoutes:
    - name: redis-cluster
      backends:
      - host: redis-1.example.com:6379
        weight: 1
      - host: redis-2.example.com:6379
        weight: 2
      - host: redis-3.example.com:6379
        weight: 1
```

{{< doc-test paths="matching" >}}
# WHAT THIS TEST VALIDATES:
#   * The TCP backend-routing example config (weighted multi-backend tcpRoutes)
#     is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * Runtime weighted load balancing — requires live TCP backends the page omits.
#   * The hostname-matching TCP variant on this page is structurally analogous
#     and not individually tested.
cat <<'EOF' > config2.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 6379
  listeners:
  - name: redis-proxy
    protocol: TCP
    tcpRoutes:
    - name: redis-cluster
      backends:
      - host: redis-1.example.com:6379
        weight: 1
      - host: redis-2.example.com:6379
        weight: 2
      - host: redis-3.example.com:6379
        weight: 1
EOF
agentgateway -f config2.yaml --validate-only
{{< /doc-test >}}
