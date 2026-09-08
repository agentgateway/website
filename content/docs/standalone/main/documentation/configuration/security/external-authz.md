---
title: External authorization
weight: 20
description: Delegate authorization decisions to external services like OPA.
test:
  external-authz:
  - file: ${versionRoot}/documentation/configuration/security/external-authz.md
    path: external-authz
---

Attaches to: {{< badge content="Listener" path="/documentation/configuration/listeners/">}} {{< badge content="Route" path="/documentation/configuration/routes/">}} {{< badge content="Backend" path="/documentation/configuration/backends/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="external-authz" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

When {{< gloss "Authorization (AuthZ)" >}}authorization{{< /gloss >}} decisions need to be made out-of-process, use an external authorization policy.
This policy has agentgateway send the request to an external server, such as [Open Policy Agent](https://www.openpolicyagent.org/docs/envoy) which decides whether the request is allowed or denied.
You can configure agentgateway to do this by using the [External Authorization gRPC service](https://www.envoyproxy.io/docs/envoy/latest/api-v3/service/auth/v3/external_auth.proto) or by using HTTP requests.

## gRPC External Authorization

The [Envoy External Authorization gRPC service](https://www.envoyproxy.io/docs/envoy/latest/api-v3/service/auth/v3/external_auth.proto) provides a standardized API to make authorization decisions.
Agentgateway is API-compatible with the Envoy External Authorization gRPC service.

> [!NOTE]
> gRPC refers to the protocol of the external authorization service. The service can authorize both gRPC and HTTP requests from the user.

When an ExtAuthz server returns header modifications, agentgateway uses `insert` instead of `append` for response headers. This ensures headers are properly set rather than potentially duplicated.

{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    extAuthz:
      host: localhost:9000
      protocol:
        grpc:
          # Optional: metadata to send to the external authorization service
          # The value is a CEL expression
          metadata:
            dev.agentgateway.jwt: '{"claims": jwt}'
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```
{{< /tab >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    extAuthz:
      host: localhost:9000
      protocol:
        grpc:
          # Optional: metadata to send to the external authorization service
          # The value is a CEL expression
          metadata:
            dev.agentgateway.jwt: '{"claims": jwt}'
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
    extAuthz:
      host: localhost:9000
      protocol:
        grpc:
          # Optional: metadata to send to the external authorization service
          # The value is a CEL expression
          metadata:
            dev.agentgateway.jwt: '{"claims": jwt}'
  backends:
  - host: localhost:8080
```
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="external-authz" >}}
# WHAT THIS TEST VALIDATES:
#   * The gRPC extAuthz policy example config is accepted by agentgateway in all
#     three configuration forms: routing-based (gateways), simplified LLM
#     (llm.policies), and simplified MCP (mcp.policies).
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That authorization decisions are actually enforced at runtime — requires a
#     running external authorization service the page omits.
#   * The bare `extAuthz:` snippets later on the page are focused fragments
#     (no `gateways:`), so they are not tested.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- policies:
    extAuthz:
      host: localhost:9000
      protocol:
        grpc:
          # Optional: metadata to send to the external authorization service
          # The value is a CEL expression
          metadata:
            dev.agentgateway.jwt: '{"claims": jwt}'
  backends:
  - host: localhost:8080
EOF
agentgateway -f config.yaml --validate-only

cat <<'EOF' > config-llm.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    extAuthz:
      host: localhost:9000
      protocol:
        grpc:
          # Optional: metadata to send to the external authorization service
          # The value is a CEL expression
          metadata:
            dev.agentgateway.jwt: '{"claims": jwt}'
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
EOF
agentgateway -f config-llm.yaml --validate-only

cat <<'EOF' > config-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    extAuthz:
      host: localhost:9000
      protocol:
        grpc:
          # Optional: metadata to send to the external authorization service
          # The value is a CEL expression
          metadata:
            dev.agentgateway.jwt: '{"claims": jwt}'
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config-mcp.yaml --validate-only
{{< /doc-test >}}

The remaining examples in this section show only the `extAuthz` policy. Attach each one to a listener, route, or backend as needed.

### Cache authorization results

You can cache gRPC external authorization decisions with `extAuthz.cache`. Caching is supported only for `protocol.grpc`; HTTP external authorization requests are always sent to the authorization service.

> [!WARNING]
> The cache key must include every request property that your authorization service uses to make a decision. For example, if the service evaluates both the request path and the `Authorization` header, include both values in `cache.key`. Otherwise, agentgateway can incorrectly reuse one request's authorization result for another request.

If any `cache.key` expression fails to evaluate or returns an unsupported value, agentgateway still sends the request to the authorization service, but skips both the cache lookup and the cache write for that request.

Use the following fields to configure the cache:

| Field | Description |
|---|---|
| `cache.key` | Required ordered list of 1-16 CEL expressions used to build the cache key. |
| `cache.ttl` | Required expiration for cached results. Set this to a duration such as `"5m"`, to a CEL expression that returns a duration, or to a CEL expression that returns the timestamp when the cached result expires. The expression is evaluated after the authorization response has been applied to the request. |
| `cache.maxEntries` | Optional maximum number of cached authorization results. If unset, agentgateway defaults to `10000`. |

Example configuration:

```yaml
extAuthz:
  host: localhost:9000
  protocol:
    grpc:
      metadata:
        dev.agentgateway.jwt: '{"claims": jwt}'
  cache:
    key:
      - request.method
      - request.path
      - request.headers["authorization"]
    ttl: '"5m"'
    maxEntries: 20000
```

## HTTP External Authorization

HTTP External Authorization allows sending plain HTTP requests to an authorization service.
If the service returns a 2xx status code, the request is allowed. Otherwise, it is denied.

Example configuration: For the full set of options, see the [configuration reference]({{< link-hextra path="/reference/configuration" >}}).

```yaml
extAuthz:
  host: localhost:9000
  protocol:
    includeRequestHeaders:
      # By default, only the Authorization header is included.
      - cookie
    http:
      # We send to /auth/<original request path>.
      path: |
        "/auth" + request.path
      includeResponseHeaders:
      # Pass the user request to the upstream service.
      # This is not required, and is just an example
      - x-auth-request-user
```

For advanced cases, configure settings for the request to the authorization service, as well as the response from the authorization service.
For example, configure `redirect` to redirect users to a sign-in page, and `metadata` to extract information from the authorization response to include in logs. Review the following table for more advanced options.

|Option|Description|
|---|---|
|`protocol.http.path`|CEL expression to construct the request path|
|`protocol.http.includeResponseHeaders`|Specific headers from the authorization response will be copied into the request to the backend.|
|`protocol.http.addRequestHeaders`|Specific headers to add in the authorization request, based on the CEL expression|
|`protocol.http.redirect`|When server returns "unauthorized", redirect to the URL resolved by the provided expression rather than directly returning the error.|
|`protocol.http.metadata`|Metadata to include under the `extauthz` variable, based on the authorization response.|
|`includeRequestHeaders`|Specific headers to include in the authorization request.<br>If unset, the gRPC protocol sends all request headers. The HTTP protocol sends only 'Authorization'.|
|`includeRequestBody`|Options for including the request body in the authorization request|
|`includeRequestBody.maxRequestBytes`|Maximum size of request body to buffer (default: 8192)|
|`includeRequestBody.allowPartialMessage`|If true, send partial body when max_request_bytes is reached|

## Backend connection policies

You can configure connection policies on the `extAuthz` field to secure or tune how agentgateway connects to the external authorization service. This includes TLS, authentication, and connection timeouts.

```yaml
extAuthz:
  host: authz-server:9001
  policies:
    backendTLS:
      root: /certs/ca.pem
      hostname: authz-server
    backendAuth:
      key:
        file: /secrets/api-key
    http:
      requestTimeout: "5s"
  protocol:
    grpc: {}
```

| Field | Description |
|-------|-------------|
| `policies.backendTLS` | TLS settings for the connection to the authorization service. Use `root` to specify a CA cert, `hostname` to override the SNI hostname, `insecure: true` to skip certificate verification (not recommended for production). |
| `policies.backendAuth` | Credentials to authenticate to the authorization service. Supports `key` (API key from file or inline), `gcp`, `aws`, and `azure` auth. |
| `policies.http.requestTimeout` | Request-level timeout as a duration string (for example, `"5s"`). |
| `policies.tcp.connectTimeout` | Connection timeout as a duration string, such as `3s`. |

## Backend-level external authorization

You can also attach an `extAuthz` policy directly to a backend. Backend-level external authorization runs after agentgateway selects the backend, so the policy applies even when a route load-balances or fails over across multiple backends. Attach at the backend level when the authorization service shapes the outgoing request, for example by inserting a token, rather than only deciding whether the incoming request is allowed.

```yaml
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: localhost:8080
    policies:
      extAuthz:
        host: localhost:9000
        protocol:
          grpc: {}
```

{{< doc-test paths="external-authz" >}}
# WHAT THIS TEST VALIDATES:
#   * The backend-level extAuthz policy example config is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That backend-level authorization is actually enforced at runtime —
#     requires a running external authorization service the page omits.
cat <<'EOF' > config2.yaml
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: localhost:8080
    policies:
      extAuthz:
        host: localhost:9000
        protocol:
          grpc: {}
EOF
agentgateway -f config2.yaml --validate-only
{{< /doc-test >}}

## Conditional execution

To choose between multiple external authorization servers based on the request, use the `conditional` field. For example, you can send admin paths to a stricter authorization server and route every other request to a standard one. For details, see [Conditional policies]({{< link-hextra path="/documentation/configuration/policies/conditional-policies" >}}).

## Connection-level external authorization {#network-extauthz}

The `extAuthz` policy calls the authorization service once for each HTTP request. To call it once for each downstream connection instead, use the `networkExtAuthz` frontend policy.

Scoping external authorization to a downstream connection is useful in the following cases.

- The gateway carries TCP traffic that has no HTTP requests to authorize.
- The connection is long-lived, and a callout on every request costs more than the decision is worth.

Configure connection-level authorization under the `frontendPolicies.networkExtAuthz` section. The section takes the same fields as `extAuthz`, with one restriction.

> [!IMPORTANT]
> The `networkExtAuthz` policy calls the authorization service over HTTP only, so you must set `protocol.http` explicitly. The `protocol` field defaults to `grpc`, which means that a configuration that omits it fails to start with `frontendPolicies.networkExtAuthz only supports protocol.http`.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  networkExtAuthz:
    host: localhost:9000
    protocol:
      http: {}

gateways:
  default:
    port: 3000
routes:
- backends:
  - host: localhost:8080
```

Because the policy runs before protocol handling, it also applies to a gateway that carries non-HTTP traffic.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  networkExtAuthz:
    host: localhost:9000
    protocol:
      http: {}

gateways:
  default:
    port: 3000
    protocol: TCP
tcpRoutes:
- gateways: [default]
  backends:
  - host: localhost:8080
```

### Choose between request-level and connection-level authorization {#network-extauthz-compare}

A gateway can carry an `extAuthz` policy, a `networkExtAuthz` policy, or both, so decide which policy a decision belongs in. The following table compares the request-level `extAuthz` policy that the rest of this page covers with the connection-level `networkExtAuthz` policy. The two policies differ in where they attach, in what the authorization service sees, and in what a denial affects.

| | `extAuthz` | `networkExtAuthz` |
| -- | -- | -- |
| Runs | Once per HTTP request | Once per downstream connection |
| Attaches to | Listener, route, or backend | Gateway or listener, under `frontendPolicies` |
| Gateway protocol | HTTP gateways only | Any gateway protocol, including `TCP` |
| Callout protocol | `grpc` (default) or `http` | `http` only |
| Request data available | Method, path, headers, and body | Connection attributes only, because no request has been read yet |
| A denial rejects | The single request | The whole connection, including every request that would have followed |

You can set both policies at once. Use `networkExtAuthz` for a coarse decision that the connection either passes or fails, and `extAuthz` for a per-request decision that needs the path or the headers.

For a CEL-based decision on the connection that does not call an external service, use [network authorization]({{< link-hextra path="/documentation/configuration/security/network-authz/" >}}) instead.
