---
title: Request matching
weight: 9
description: Match incoming requests by path, headers, methods, and query parameters.
test:
  matching:
  - file: ${versionRoot}/documentation/configuration/traffic-management/matching.md
    path: matching
---

Based on the route schema (see the [configuration reference]({{< link-hextra path="/reference/configuration/" >}}) for the full field reference and [schema validation]({{< link-hextra path="/reference/configuration/validation/" >}}) for IDE integration), you can configure the following {{< gloss "Matching" >}}matching{{< /gloss >}} conditions for HTTP or TCP routes.

Request matching is a routing-based feature: routes and their match conditions are configured in the top-level `routes` section and attached to a gateway. The simplified `llm` configuration supports header-based model matching (`llm.models[].matches`), but path, method, and query matching require routing-based configuration. For more information about the configuration styles, see [Routing-based configuration]({{< link-hextra path="/documentation/llm/configuration-modes/" >}}).

{{< doc-test paths="matching" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

## HTTP routes

For routes configured with [HTTP or HTTPS listeners]({{< link-hextra path="/documentation/configuration/listeners/" >}}), you can configure the following matching conditions. These matching conditions do not apply to [TLS listeners]({{< link-hextra path="/documentation/configuration/listeners#tls-listeners" >}}), which use TCP routes and only support hostname-based matching.

### Path matching

Match incoming requests based on their path using one of the following strategies.

If no path match is specified, the default is to match all paths (`/`).

| Type        | Example                              | Description                                 |
|-------------|--------------------------------------|---------------------------------------------|
| Exact       | `{ "exact": "/foo/bar" }`            | Matches only the exact path `/foo/bar`      |
| Prefix      | `{ "pathPrefix": "/foo" }`           | Matches any path starting with `/foo`       |
| Regex       | `{ "regex": "/foo/[0-9]+" }`         | Matches the full path with a regular expression |

> [!NOTE]
> Only one of `exact`, `pathPrefix`, or `regex` can be specified per path matcher.

For regex path matching, the regular expression applies to the full request path. For example, `/foo/[0-9]+` matches `/foo/123`, but not `/foo/123/bar`.

You can configure path matching in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
To add a route with a path match in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps. The steps create the same `api-exact` route as the **Exact path matching** example in the **Config file** tab.

1. Open **Traffic** > **Routes**, and click **Add route**.
2. Select the **Gateway**, such as `default`, and enter `api-exact` for the **Name**.
3. Select **Exact** as the **Path match** type. For the other examples, select **Prefix** or **Regex**.
4. Enter `/api/v1/users` for the **Path**.
5. In the **Backends** section, click **Add backend**, and enter `api.example.com:8080` for the **Host**.
6. Click **Save route**.

To add a path match to an existing route, click the edit icon for the route instead. The UI edits only the first entry in `matches`. To add more entries, click the **Raw** icon in the drawer header and edit the YAML, or use the **Config file** tab.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/snippets/review-configuration.md" >}}

{{< tabs >}}
{{< tab name="Exact path matching" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
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
gateways:
  default:
    port: 3000
routes:
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
gateways:
  default:
    port: 3000
routes:
- name: api-regex
  matches:
  - path:
      regex: "/api/v[0-9]+/users"
  backends:
  - host: api.example.com:8080
```
{{< /tab >}}
{{< /tabs >}}
{{% /tab %}}
{{< /tabs >}}

### Header matching

Match incoming requests based on HTTP headers included in the request.

- **Exact match:**  
  `{ "name": "Authorization", "value": { "exact": "Bearer token" } }`
- **Regex match:**  
  `{ "name": "Authorization", "value": { "regex": "^Bearer .*" } }`

You can configure header matching in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
The following steps create the same `multi-header` route as the **Multiple header matching** example in the **Config file** tab.

1. Open **Traffic** > **Routes**, and click **Add route**.
2. Select the **Gateway**, enter `multi-header` for the **Name**, and enter `/api` for the **Path**.
3. In the **Headers** section, click **Add header** for each header condition.
   1. Enter `Authorization` for the header name and `^Bearer .*` for the value. Then, click **Regex** to match the value as a regular expression.
   2. Enter `Content-Type` for the header name and `application/json` for the value. Leave **Regex** off for an exact match.
4. In the **Backends** section, click **Add backend**, and enter `api.example.com:8080` for the **Host**.
5. Click **Save route**.

A request must match every header condition in the list. The UI edits only the first entry in `matches`. To add more entries, click the **Raw** icon in the drawer header and edit the YAML, or use the **Config file** tab.
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/snippets/review-configuration.md" >}}

{{< tabs >}}
{{< tab name="Exact header matching" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
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
{{< tab name="Regex header matching" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
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
{{< tab name="Multiple header matching" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
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
{{% /tab %}}
{{< /tabs >}}

### Method matching

Optionally restrict matches to specific HTTP methods.

```json
{ "method": { "method": "GET" } }
```

You can configure method matching in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
The following steps create the same `get-only` route as the **GET method matching** example in the **Config file** tab.

1. Open **Traffic** > **Routes**, and click **Add route**.
2. Select the **Gateway**, enter `get-only` for the **Name**, and enter `/api` for the **Path**.
3. Enter `GET` for the **Method**.
4. In the **Backends** section, click **Add backend**, and enter `api.example.com:8080` for the **Host**.
5. Click **Save route**.

To send different methods to different backends, add one route for each method. The UI edits only the first entry in `matches`. To add more entries, click the **Raw** icon in the drawer header and edit the YAML, or use the **Config file** tab.
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/snippets/review-configuration.md" >}}

{{< tabs >}}
{{< tab name="GET method matching" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
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
{{< tab name="POST method matching" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
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
{{< tab name="Multiple methods with different backends" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
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
{{% /tab %}}
{{< /tabs >}}

### Query parameter matching

Match on query parameters, either by exact value or regex.

- **Exact:**  
  `{ "name": "version", "value": { "exact": "v1" } }`
- **Regex:**  
  `{ "name": "version", "value": { "regex": "^v[0-9]+$" } }`

You can configure query parameter matching in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
The following steps create the same `multi-query` route as the **Multiple query parameters** example in the **Config file** tab.

1. Open **Traffic** > **Routes**, and click **Add route**.
2. Select the **Gateway**, enter `multi-query` for the **Name**, and enter `/api` for the **Path**.
3. In the **Query** section, click **Add query** for each query condition.
   1. Enter `version` for the query name and `v1` for the value. Leave **Regex** off for an exact match.
   2. Enter `format` for the query name and `^(json|xml)$` for the value. Then, click **Regex** to match the value as a regular expression.
4. In the **Backends** section, click **Add backend**, and enter `api.example.com:8080` for the **Host**.
5. Click **Save route**.

A request must match every query condition in the list. The UI edits only the first entry in `matches`. To add more entries, click the **Raw** icon in the drawer header and edit the YAML, or use the **Config file** tab.
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/snippets/review-configuration.md" >}}

{{< tabs >}}
{{< tab name="Exact query parameter matching" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
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
{{< tab name="Regex query parameter matching" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
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
{{< tab name="Multiple query parameters" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
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
{{% /tab %}}
{{< /tabs >}}

### Combined matching

You can combine multiple matching conditions to create a more specific route, such as the following example.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
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
gateways:
  default:
    port: 3000
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
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

## TCP routes

For routes configured with [TCP listeners]({{< link-hextra path="/documentation/configuration/routes#tcp-routes" >}}), you can configure the following matching conditions.

### Hostname matching

Match incoming requests based on the hostname included in the request. This is primarily used for TLS termination scenarios.

{{< tabs >}}
{{% tab name="UI" %}}
The following steps assume that you have a TCP gateway named `database-proxy`. To add one, see [TCP listeners]({{< link-hextra path="/documentation/configuration/listeners/#tcp-listeners" >}}).

1. Open **Traffic** > **Routes**, and click **Add route**.
2. Select **TCP** as the **Kind**, and select the `database-proxy` **Gateway**.
3. Enter `database-backend` for the **Name** and `db.example.com` for the **Hostnames**. To match more than one hostname, separate them with commas.
4. In the **Backends** section, click **Add backend**, and enter `postgres.example.com:5432` for the **Host**.
5. Click **Save route**.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  database-proxy:
    port: 5432
    protocol: TCP
tcpRoutes:
- name: database-backend
  gateways: [database-proxy]
  hostnames:
  - "db.example.com"
  backends:
  - host: postgres.example.com:5432
```
{{% /tab %}}
{{< /tabs >}}

### Backend routing

Route directly to backends. You can include multiple backends and weights to load balance across them.

Higher weights receive more traffic. Each new TCP connection is assigned to a backend proportionally based on the ratio of the weights.

In the following example, traffic is load balanced across the three backends in the ratio 1:2:1. The first backend receives 25% of the traffic, the second backend receives 50% of the traffic, and the third backend receives 25% of the traffic.

If no weight is specified, the default is 1. Backends with a weight of 0 receive no traffic. Each incoming TCP connection maintains a 1:1 mapping with an outgoing backend connection; once a connection is established, it remains bound to its assigned backend for the lifetime of that connection.

{{< tabs >}}
{{% tab name="UI" %}}
The following steps assume that you have a TCP gateway named `redis-proxy`. To add one, see [TCP listeners]({{< link-hextra path="/documentation/configuration/listeners/#tcp-listeners" >}}).

1. Open **Traffic** > **Routes**, and click **Add route**.
2. Select **TCP** as the **Kind**, select the `redis-proxy` **Gateway**, and enter `redis-cluster` for the **Name**.
3. In the **Backends** section, click **Add backend** three times. Enter the **Host** and **Weight** of each backend.
   * `redis-1.example.com:6379` with a weight of `1`
   * `redis-2.example.com:6379` with a weight of `2`
   * `redis-3.example.com:6379` with a weight of `1`
4. Click **Save route**.

The UI leaves out `weight: 1`, because 1 is the default weight.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  redis-proxy:
    port: 6379
    protocol: TCP
tcpRoutes:
- name: redis-cluster
  gateways: [redis-proxy]
  backends:
  - host: redis-1.example.com:6379
    weight: 1
  - host: redis-2.example.com:6379
    weight: 2
  - host: redis-3.example.com:6379
    weight: 1
```
{{% /tab %}}
{{< /tabs >}}

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
gateways:
  redis-proxy:
    port: 6379
    protocol: TCP
tcpRoutes:
- name: redis-cluster
  gateways: [redis-proxy]
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
