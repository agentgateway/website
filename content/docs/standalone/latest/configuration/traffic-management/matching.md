---
title: Request matching
weight: 9
---

Based on the [route schema](https://github.com/agentgateway/agentgateway/blob/main/schema/local.json), you can configure the following {{< gloss "Matching" >}}matching{{< /gloss >}} conditions for HTTP or TCP routes.

## HTTP routes

For routes configured with [HTTP, HTTPS, or TLS listeners](../../listeners/), you can configure the following matching conditions.

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

{{< tabs items="Exact path matching, Prefix path matching, Regex path matching">}}
{{< tab >}}
```yaml
routes:
- name: api-exact
  matches:
  - path:
      exact: "/api/v1/users"
    backends:
    - host: api.example.com:8080
```
{{< /tab >}}
{{< tab >}}
```yaml
routes:
- name: api-prefix
  matches:
  - path:
      pathPrefix: "/api/v1"
    backends:
    - host: api.example.com:8080
```
{{< /tab >}}
{{< tab >}}
```yaml
routes:
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

{{< tabs items="Exact header matching, Regex header matching, Multiple header matching">}}
{{< tab >}}
```yaml
routes:
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
{{< tab >}}
```yaml
routes:
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
{{< tab >}}
```yaml
routes:
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

{{< tabs items="GET method matching, POST method matching, Multiple methods with different backends">}}
{{< tab >}}
```yaml
routes:
- name: get-only
  matches:
  - path:
      pathPrefix: "/api"
    method: "GET"
    backends:
    - host: api.example.com:8080
```
{{< /tab >}}
{{< tab >}}
```yaml
routes:
- name: post-only
  matches:
  - path:
      pathPrefix: "/api/users"
    method: "POST"
    backends:
    - host: api.example.com:8080
```
{{< /tab >}}
{{< tab >}}
```yaml
routes:
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

{{< tabs items="Exact query parameter matching, Regex query parameter matching, Multiple query parameters">}}
{{< tab >}}
```yaml
routes:
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
{{< tab >}}
```yaml
routes:
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
{{< tab >}}
```yaml
routes:
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
routes:
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

## TCP routes

For routes configured with [TCP listeners](../../routes/#tcp-routes), you can configure the following matching conditions.

### Hostname matching

Match incoming requests based on the hostname included in the request. This is primarily used for TLS termination scenarios.

```yaml
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

If no weight is specified, the default is 1. Backends with a weight of 0 receive no traffic. TCP connections are not sticky to specific backends.

```yaml
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
