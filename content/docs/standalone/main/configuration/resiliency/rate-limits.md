---
title: Rate limiting
weight: 10
description: Enforce budget and spend limits per key by controlling request and token usage.
test:
  rate-limits:
  - file: content/docs/standalone/main/configuration/resiliency/rate-limits.md
    path: rate-limits
---

Attaches to: {{< badge content="Route" path="/configuration/routes/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="rate-limits" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

Use rate limiting to enforce budget and spend limits per key: control the rate of requests and token usage on a route. Token-based limits let you cap usage per user, per API key, or per time window. Combined with API key authentication and observability, this gives you virtual key management.

## Rate limit types

Agentgateway exposes two types of rate limits:

**Local rate limits** apply in memory, and counters are not shared between replicas of agentgateway, nor across restarts.
These are very low overhead, but not appropriate for usage where exact global counts are required, or for limits with long time windows (like monthly limits).

**Remote rate limits** store counters in an pluggable external data store, which enables shared state across replicas of agentgateway.
This is controlled via the [Envoy Rate Limit gRPC service](https://www.envoyproxy.io/docs/envoy/latest/api-v3/service/ratelimit/v3/rls.proto) to enable re-use with existing rate limiting services built for Envoy; the Envoy project has an example [rate limiter service](https://github.com/envoyproxy/ratelimit) that can be used.

## Rate limit modes

In additional to simple request-based rate limits, agentgateway can limit requests based on *tokens* for [LLM consumption]({{< link-hextra path="/llm/" >}}).

### Request-based rate limits

By default, agentgateway applies rate limits to requests. Therefore, each request consumes 1 unit of capacity.

To explicitly set request-based rate limits, set the rate limiting type to `requests` as shown in the following example. 

{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    localRateLimit:
    - maxTokens: 10
      tokensPerFill: 1
      fillInterval: 60s
      type: requests
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
    localRateLimit:
    - maxTokens: 10
      tokensPerFill: 1
      fillInterval: 60s
      type: requests
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
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        localRateLimit:
        - maxTokens: 10
          tokensPerFill: 1
          fillInterval: 60s
          type: requests
      backends:
      - host: localhost:8080
```
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="rate-limits" >}}
# WHAT THIS TEST VALIDATES:
#   * The request-based localRateLimit policy is accepted by agentgateway in the
#     routing-based (binds), simplified LLM (llm.policies), and simplified MCP
#     (mcp.policies) forms.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That requests are actually limited at runtime — requires driving traffic
#     past the configured bucket, which the page does not exercise.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        localRateLimit:
        - maxTokens: 10
          tokensPerFill: 1
          fillInterval: 60s
          type: requests
      backends:
      - host: localhost:8080
EOF
agentgateway -f config.yaml --validate-only

cat <<'EOF' > config-llm.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    localRateLimit:
    - maxTokens: 10
      tokensPerFill: 1
      fillInterval: 60s
      type: requests
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
    localRateLimit:
    - maxTokens: 10
      tokensPerFill: 1
      fillInterval: 60s
      type: requests
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config-mcp.yaml --validate-only
{{< /doc-test >}}

### Token-based rate limits

For tokens, each token (prompt or completion) consumes 1 unit of capacity.
Because the number of tokens that are used for the completion is not known at the time the request is sent, calculating the number of tokens can become tricky. To work around this issue, agentgateway checks token-based rate limits in two phases, at request time and at response time. 

To enable token-based rate limiting, set the rate limiting type to `tokens`. This example shows only the `localRateLimit` policy; attach it to a route as shown in the complete examples in the [Configuration](#configuration) section.

```yaml
localRateLimit:
- maxTokens: 10
  tokensPerFill: 1
  fillInterval: 60s
  type: tokens
```

#### At request time

{{< reuse "agw-docs/snippets/ratelimit-requesttime.md" >}}

#### At response time

{{< reuse "agw-docs/snippets/ratelimit-responsetime.md" >}}

## Configuration

### Local

Local rate limiting uses a [Token bucket](https://en.wikipedia.org/wiki/Token_bucket) algorithm.

|Field|Meaning|
|-|-|
|`maxTokens`|Maximum, and initial, size of the bucket|
|`fillInterval`|How often to refill the bucket|
|`tokensPerFill`|How many tokens to replenish per fill|
|`type`|The type of rate limiting. Choose between `requests` for request-based rate limits, and `tokens` for token-based rate limits. |

Below shows an example rate limit configuration that allows 5,000 tokens per hour, and 60 requests per second.

{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    localRateLimit:
    - maxTokens: 5000
      # Every hour, refill 5000 tokens
      tokensPerFill: 5000
      fillInterval: 1h
      type: tokens
    - maxTokens: 60
      # Every second, refill 1 token
      tokensPerFill: 1
      fillInterval: 1s
      type: requests
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
    localRateLimit:
    - maxTokens: 5000
      # Every hour, refill 5000 tokens
      tokensPerFill: 5000
      fillInterval: 1h
      type: tokens
    - maxTokens: 60
      # Every second, refill 1 token
      tokensPerFill: 1
      fillInterval: 1s
      type: requests
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
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        localRateLimit:
        - maxTokens: 5000
          # Every hour, refill 5000 tokens
          tokensPerFill: 5000
          fillInterval: 1h
          type: tokens
        - maxTokens: 60
          # Every second, refill 1 token
          tokensPerFill: 1
          fillInterval: 1s
          type: requests
      backends:
      - host: localhost:8080
```
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="rate-limits" >}}
# WHAT THIS TEST VALIDATES:
#   * The Local example config (5000 tokens/hour and 60 requests/second) is
#     accepted by agentgateway in the routing-based (binds), simplified LLM
#     (llm.policies), and simplified MCP (mcp.policies) forms.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That the token-bucket limits actually refill and throttle at runtime —
#     requires sustained traffic over the fill intervals, which the page omits.
#   * The token-based and failOpen fragments on this page are focused field-
#     reference snippets, not standalone configs, so they are not tested here.
cat <<'EOF' > config2.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        localRateLimit:
        - maxTokens: 5000
          # Every hour, refill 5000 tokens
          tokensPerFill: 5000
          fillInterval: 1h
          type: tokens
        - maxTokens: 60
          # Every second, refill 1 token
          tokensPerFill: 1
          fillInterval: 1s
          type: requests
      backends:
      - host: localhost:8080
EOF
agentgateway -f config2.yaml --validate-only

cat <<'EOF' > config2-llm.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    localRateLimit:
    - maxTokens: 5000
      # Every hour, refill 5000 tokens
      tokensPerFill: 5000
      fillInterval: 1h
      type: tokens
    - maxTokens: 60
      # Every second, refill 1 token
      tokensPerFill: 1
      fillInterval: 1s
      type: requests
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
EOF
agentgateway -f config2-llm.yaml --validate-only

cat <<'EOF' > config2-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    localRateLimit:
    - maxTokens: 5000
      # Every hour, refill 5000 tokens
      tokensPerFill: 5000
      fillInterval: 1h
      type: tokens
    - maxTokens: 60
      # Every second, refill 1 token
      tokensPerFill: 1
      fillInterval: 1s
      type: requests
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config2-mcp.yaml --validate-only
{{< /doc-test >}}

> [!NOTE]
> The term "tokens" is used for two distinct meanings. In `maxTokens` and `tokensPerFill`, it indicates the "token" in the token bucket counter. Each token can allow either 1 LLM token, or 1 HTTP request, based on the `type`.

### Remote

Remote rate limits are not defined directly in agentgateway.
Instead, agentgateway is configured to connect to an external rate limit server, and which "descriptors" to send to the server.
The rate limit server is responsible for defining, and enforcing, the appropriate limits matching the descriptors.

{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    remoteRateLimit:
      # The address to access the rate limit server
      host: localhost:9090
      # Arbitrary 'domain' to match limits on the rate limit server
      domain: example.com
      descriptors:
      # Rate limit requests based on a header, whether the user is authenticated, and a static value (used to match a specific rate limit rule on the rate limit server)
      - entries:
        - key: some-static-value
          value: '"something"'
        - key: organization
          value: 'request.headers["x-organization"]'
        - key: authenticated
          value: 'has(jwt.sub)'
        type: tokens # or 'requests'
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
    remoteRateLimit:
      # The address to access the rate limit server
      host: localhost:9090
      # Arbitrary 'domain' to match limits on the rate limit server
      domain: example.com
      descriptors:
      # Rate limit requests based on a header, whether the user is authenticated, and a static value (used to match a specific rate limit rule on the rate limit server)
      - entries:
        - key: some-static-value
          value: '"something"'
        - key: organization
          value: 'request.headers["x-organization"]'
        - key: authenticated
          value: 'has(jwt.sub)'
        type: tokens # or 'requests'
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
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        remoteRateLimit:
          # The address to access the rate limit server
          host: localhost:9090
          # Arbitrary 'domain' to match limits on the rate limit server
          domain: example.com
          descriptors:
          # Rate limit requests based on a header, whether the user is authenticated, and a static value (used to match a specific rate limit rule on the rate limit server)
          - entries:
            - key: some-static-value
              value: '"something"'
            - key: organization
              value: 'request.headers["x-organization"]'
            - key: authenticated
              value: 'has(jwt.sub)'
            type: tokens # or 'requests'
      backends:
      - host: localhost:8080
```
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="rate-limits" >}}
# WHAT THIS TEST VALIDATES:
#   * The Remote example config (remoteRateLimit with descriptors) is accepted
#     by agentgateway in the routing-based (binds), simplified LLM
#     (llm.policies), and simplified MCP (mcp.policies) forms.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That limits are actually enforced at runtime — requires an external Envoy
#     rate limit server the page omits to define and enforce the descriptors.
#   * The failOpen and backend-connection-policy snippets below are focused
#     field-reference fragments, not standalone configs, so they are not tested.
cat <<'EOF' > config3.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        remoteRateLimit:
          # The address to access the rate limit server
          host: localhost:9090
          # Arbitrary 'domain' to match limits on the rate limit server
          domain: example.com
          descriptors:
          # Rate limit requests based on a header, whether the user is authenticated, and a static value (used to match a specific rate limit rule on the rate limit server)
          - entries:
            - key: some-static-value
              value: '"something"'
            - key: organization
              value: 'request.headers["x-organization"]'
            - key: authenticated
              value: 'has(jwt.sub)'
            type: tokens # or 'requests'
      backends:
      - host: localhost:8080
EOF
agentgateway -f config3.yaml --validate-only

cat <<'EOF' > config3-llm.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    remoteRateLimit:
      # The address to access the rate limit server
      host: localhost:9090
      # Arbitrary 'domain' to match limits on the rate limit server
      domain: example.com
      descriptors:
      # Rate limit requests based on a header, whether the user is authenticated, and a static value (used to match a specific rate limit rule on the rate limit server)
      - entries:
        - key: some-static-value
          value: '"something"'
        - key: organization
          value: 'request.headers["x-organization"]'
        - key: authenticated
          value: 'has(jwt.sub)'
        type: tokens # or 'requests'
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
EOF
agentgateway -f config3-llm.yaml --validate-only

cat <<'EOF' > config3-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    remoteRateLimit:
      # The address to access the rate limit server
      host: localhost:9090
      # Arbitrary 'domain' to match limits on the rate limit server
      domain: example.com
      descriptors:
      # Rate limit requests based on a header, whether the user is authenticated, and a static value (used to match a specific rate limit rule on the rate limit server)
      - entries:
        - key: some-static-value
          value: '"something"'
        - key: organization
          value: 'request.headers["x-organization"]'
        - key: authenticated
          value: 'has(jwt.sub)'
        type: tokens # or 'requests'
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config3-mcp.yaml --validate-only
{{< /doc-test >}}

Each descriptor value is a [CEL expression]({{< link-hextra path="/configuration/traffic-management/transformations" >}}).

#### Failure behavior

By default, if the remote rate limit service is unavailable or returns an error, agentgateway **fails closed**: the request is denied with a `500 Internal Server Error`. This prevents unmetered traffic in the event of a service outage.

To allow requests through when the rate limit service is unavailable, set `failureMode` to `failOpen`:

```yaml
remoteRateLimit:
  host: localhost:9090
  domain: example.com
  failureMode: failOpen
  descriptors:
  - entries:
    - key: organization
      value: 'request.headers["x-organization"]'
    type: requests
```

| Value | Behavior |
|-------|----------|
| `failClosed` (default) | Deny requests with `500` when the rate limit service is unavailable |
| `failOpen` | Allow requests through when the rate limit service is unavailable |

{{< callout type="warning" >}}
Be cautious when setting the failure mode to `failOpen`. While this setting prevents service disruptions if the rate limiting server is unavailable, rate limits are not enforced for your routes until the rate limiting server is available again.
{{< /callout >}}

#### Backend connection policies

You can configure connection policies on the `remoteRateLimit` field to secure or tune how agentgateway connects to the rate limit service. This includes TLS, authentication, and connection timeouts.

```yaml
remoteRateLimit:
  host: ratelimit-service:8081
  domain: my-api
  policies:
    backendAuth:
      key:
        file: /secrets/api-key
    backendTLS:
      root: /certs/ca.pem
      insecure: false
    tcp:
      connectTimeout:
        secs: 3
        nanos: 0
  descriptors:
    - entries:
        - key: service
          value: '"my-service"'
  failureMode: failOpen
```

| Field | Description |
|-------|-------------|
| `policies.backendAuth` | Credentials to authenticate to the rate limit service. Supports `key` (API key from file or inline), `gcp`, `aws`, and `azure` auth. |
| `policies.backendTLS` | TLS settings for the connection to the rate limit service. Use `root` to specify a CA cert, `insecure: true` to skip certificate verification (not recommended for production). |
| `policies.tcp.connectTimeout` | Connection timeout specified as `secs` and `nanos`. |
| `policies.http.requestTimeout` | Request-level timeout as a duration string (for example, `"5s"`). Use for HTTP-based rate limit service connections. |

## Conditional execution

To apply different rate limits based on the request, use the `conditional` field. For example, you can apply stricter limits on writes than on reads. For details, see [Conditional policies]({{< link-hextra path="/configuration/policies/conditional-policies" >}}).
