---
title: Rate limiting
weight: 10
description: Enforce budget and spend limits per key by controlling request and token usage.
---

Attaches to: {{< badge content="Route" path="/documentation/configuration/routes/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

Use rate limiting to enforce budget and spend limits per key: control the rate of requests and token usage on a route. Token-based limits let you cap usage per user, per API key, or per time window. Combined with API key authentication and observability, this gives you virtual key management.

## Rate limit types

Agentgateway exposes two types of rate limits:

**Local rate limits** apply in memory, and counters are not shared between replicas of agentgateway, nor across restarts.
These are very low overhead, but not appropriate for usage where exact global counts are required, or for limits with long time windows (like monthly limits).

**Remote rate limits** store counters in an pluggable external data store, which enables shared state across replicas of agentgateway.
This is controlled via the [Envoy Rate Limit gRPC service](https://www.envoyproxy.io/docs/envoy/latest/api-v3/service/ratelimit/v3/rls.proto) to enable re-use with existing rate limiting services built for Envoy; the Envoy project has an example [rate limiter service](https://github.com/envoyproxy/ratelimit) that can be used.

## Rate limit modes

In additional to simple request-based rate limits, agentgateway can limit requests based on *tokens* for [LLM consumption]({{< link-hextra path="/documentation/llm/" >}}).

### Request-based rate limits

By default, agentgateway applies rate limits to requests. Therefore, each request consumes 1 unit of capacity.

To explicitly set request-based rate limits, set the rate limiting type to `requests` as shown in the following example. 

{{< tabs >}}
{{% tab name="UI" %}}
The following steps add the same `localRateLimit` policy as the **Simplified (LLM)** example in the **Config file** tab.

1. Create a configuration with an LLM model, but no rate limit policy. You add the policy in the UI.
   ```yaml
   # yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
   llm:
     models:
     - name: "*"
       provider: openAI
       params:
         apiKey: "$OPENAI_API_KEY"
   ```
2. Start agentgateway with this configuration.
3. Open [http://localhost:15000/ui/llm/policies](http://localhost:15000/ui/llm/policies) (**LLM** > **Policies**), and click the **Local rate limit** tile.
4. Fill out the form.
   1. **Limit type**: Keep **Requests**.
   2. **Fill interval**: `60s`
   3. **Max tokens**: `10`
   4. **Tokens per fill**: `1`

   {{< reuse-image src="img/ui-llm-policy-local-rate-limit.png" srcDark="img/ui-llm-policy-local-rate-limit-dark.png" alt="Local rate limit drawer with the Requests type, a 60s fill interval, 10 maximum tokens, and 1 token per fill" >}}

5. Click **Save policy**.

The UI omits `type: requests`, because `requests` is the default type. The form edits a single rate limit rule without a `key`. To add more rules or a per-key limit, use the **Raw** icon (`<>`) in the drawer header or the **Config file** tab.

You can also add a local rate limit policy in **MCP** > **Policies**, or in the **Route policies** section of a named route in **Traffic** > **Routes**.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
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
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
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
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
gateways:
  default:
    port: 3000
routes:
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
{{< tab name="traffic-ratelimiting-local example" >}}
For a runnable version of the routing-based configuration, see the [`traffic-ratelimiting-local` example](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-ratelimiting-local) in the agentgateway repository.

{{% github-yaml url="https://agentgateway.dev/examples/traffic-ratelimiting-local/config.yaml" %}}
{{< /tab >}}
{{< /tabs >}}
{{% /tab %}}
{{< /tabs >}}

### Token-based rate limits

For tokens, each token (prompt or completion) consumes 1 unit of capacity.
Because the number of tokens that are used for the completion is not known at the time the request is sent, calculating the number of tokens can become tricky. To work around this issue, agentgateway checks token-based rate limits in two phases, at request time and at response time. 

To enable token-based rate limiting, set the rate limiting type to `tokens`. This example shows only the `localRateLimit` policy; attach it to a route as shown in the complete examples in the [Configuration](#configuration) section.

{{< tabs >}}
{{% tab name="UI" %}}
1. Open the **Local rate limit** policy drawer, such as in **LLM** > **Policies**.
2. Select **Tokens** for the **Limit type**.
3. Fill out the other fields.
   1. **Fill interval**: `60s`
   2. **Max tokens**: `10`
   3. **Tokens per fill**: `1`
4. Click **Save policy**.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
localRateLimit:
- maxTokens: 10
  tokensPerFill: 1
  fillInterval: 60s
  type: tokens
```
{{% /tab %}}
{{< /tabs >}}

#### At request time

{{< reuse "agw-docs/snippets/ratelimit-requesttime.md" >}}

#### At response time

{{< reuse "agw-docs/snippets/ratelimit-responsetime.md" >}}

The input count that agentgateway charges against the limit includes the tokens that the provider read from or wrote to its prompt cache. Providers disagree about whether their own input count includes cached tokens, so agentgateway normalizes the number first. For providers that exclude cached tokens, such as Anthropic and Amazon Bedrock, a cache-heavy request therefore consumes more capacity than the provider's reported input count. For more information, see [Token usage fields]({{< link-hextra path="/documentation/llm/observability/#token-usage-fields" >}}).

## Configuration

### Local

Local rate limiting uses a [Token bucket](https://en.wikipedia.org/wiki/Token_bucket) algorithm.

|Field|Meaning|
|-|-|
|`maxTokens`|Maximum, and initial, size of the bucket|
|`fillInterval`|How often to refill the bucket|
|`tokensPerFill`|How many tokens to replenish per fill|
|`type`|The type of rate limiting. Choose between `requests` for request-based rate limits, and `tokens` for token-based rate limits. |
|`key`|Optional CEL expression that selects the bucket a request counts against, such as the `jwt.sub` claim for a limit per user. Each distinct value gets its own bucket with the limits above. When unset, all requests that the rule matches share one bucket. For more information, see [Per-key limits](#per-key).|

Below shows an example rate limit configuration that allows 5,000 tokens per hour, and 60 requests per second.

{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
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
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
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
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
gateways:
  default:
    port: 3000
routes:
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

When `localRateLimit` lists more than one entry, a request must fit in every entry. The first entry that is empty refuses the request with a `429`, and the order of the entries does not matter. A `requests` entry takes its token when the request arrives. Unless `tokenize` is enabled, a `tokens` entry checks only that its bucket is not empty when the request arrives. The entry is then charged the tokens that the model reports when the response completes. A refused request does not use up the entries that admitted it, so each entry is charged only for the requests that every entry admitted.

A `tokens` entry counts LLM tokens, so it limits only routes whose backend is an LLM provider. On other routes, such as a route to an HTTP or MCP backend, a `tokens` entry admits every request. Use `type: requests` for those routes.

> [!NOTE]
> The term "tokens" is used for two distinct meanings. In `maxTokens` and `tokensPerFill`, it indicates the "token" in the token bucket counter. Each token can allow either 1 LLM token, or 1 HTTP request, based on the `type`.

#### Per-key limits {#per-key}

By default, every request that a rule matches counts against the same bucket, so the busiest caller can exhaust the limit for everyone else. To limit each caller separately, set `key` to a CEL expression. Each distinct value that the expression returns gets its own bucket with the limits of that rule. This way, you can enforce per-user, per-team, or per-model quotas without running an external rate limit server.

The following example builds on [API key authentication]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}) and gives each virtual key its own budget of 1,000 LLM tokens per hour and its own limit of 60 requests per minute.

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
llm:
  policies:
    apiKey:
      mode: strict
      keys:
      - key: sk-alice-abc123def456
        metadata:
          user: alice
      - key: sk-bob-xyz789uvw012
        metadata:
          user: bob
    localRateLimit:
    # Each API key gets its own budget of 1000 tokens per hour.
    - maxTokens: 1000
      tokensPerFill: 1000
      fillInterval: 1h
      type: tokens
      key: apiKey.user
    # Each API key also gets its own limit of 60 requests per minute.
    - maxTokens: 60
      tokensPerFill: 60
      fillInterval: 60s
      type: requests
      key: apiKey.user
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

The expression can read anything in the request context. Common keys are the `jwt.sub` claim for a limit per user, `jwt.team` for a limit per team, and `jwt.sub + "/" + llm.requestModel` to give each user a separate allowance per model.

Review the following behavior before you set a key.

* **What the key can read**: For LLM requests, both `requests` and `tokens` keys can read `llm.requestModel` and `llmRequest` (the parsed request body). To count requests per model, use `llm.requestModel` as the key. See [Variables and functions]({{< link-hextra path="/reference/cel/variables/" >}}).
* **Requests without a value**: Requests whose key is empty, or whose expression cannot be evaluated, share a single bucket. An empty key does not exempt a request from the limit. To apply a limit to only some requests, use [conditional policies]({{< link-hextra path="/documentation/configuration/policies/conditional-policies/" >}}) instead.
* **How many buckets are kept, and where they live**: {{< reuse "agw-docs/snippets/ratelimit-key-buckets.md" >}} For a quota that is shared across instances, use [remote rate limits](#remote).

#### Per-client, per-tool limits for MCP {#per-key-mcp}

To give each client its own allowance for each MCP tool, combine a conditional rule with a key. The following example counts only `tools/call` requests, so clients can still initialize and list tools after they reach a limit. The key combines the client from the API key metadata with the tool's target and name. Each distinct value gets its own bucket of 2 calls per minute.

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
mcp:
  port: 3000
  prefixMode: always
  policies:
    apiKey:
      mode: strict
      keys:
      - key: alice-key
        metadata:
          client: alice
      - key: bob-key
        metadata:
          client: bob
    localRateLimit:
      conditional:
      - condition: 'mcp.methodName == "tools/call"'
        type: requests
        maxTokens: 2
        tokensPerFill: 2
        fillInterval: 60s
        key: 'apiKey.client + "/" + mcp.tool.target + "/" + mcp.tool.name'
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["-y", "@modelcontextprotocol/server-everything"]
```

When Alice calls `everything_echo` a third time within a minute, the gateway returns a tool result with `isError: true`. Bob's calls and Alice's calls to other tools still work. Two API keys with the same `client` metadata share one allowance.

```json
{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"rate limit exceeded (retry after 59s; limit 2, remaining 0)"}],"isError":true}}
```

A call whose key cannot be evaluated, such as a call to an unknown tool, uses a single bucket that all clients share.

| Field | Description |
|-------|-------------|
| `prefixMode` | How to namespace tool names when you federate targets. With `always`, agentgateway adds the target name to every tool name, such as `everything_echo`, even with a single target. |
| `apiKey.mode` | How agentgateway handles requests without a valid API key. With `strict`, it rejects them. |
| `apiKey.keys[].key` | The API key that the client sends as a bearer token. |
| `apiKey.keys[].metadata` | Values that agentgateway attaches to requests that use the key. CEL expressions read each value as `apiKey.<name>`, such as `apiKey.client`. |
| `localRateLimit.conditional[].condition` | A CEL expression that selects the requests that the rule counts. Here, only `tools/call` requests count. |
| `localRateLimit.conditional[].type` | What the bucket counts. Use `requests` for MCP calls. |
| `localRateLimit.conditional[].maxTokens` | The size of the bucket, which is the number of calls that a client can make in a burst. |
| `localRateLimit.conditional[].tokensPerFill` | The number of calls that the bucket gains each `fillInterval`. |
| `localRateLimit.conditional[].fillInterval` | How often the bucket refills. |
| `localRateLimit.conditional[].key` | A CEL expression. Each distinct value gets its own bucket. Here, the key is the client, the tool's target, and the tool name. |

### Remote

Remote rate limits are not defined directly in agentgateway.
Instead, agentgateway is configured to connect to an external rate limit server, and which "descriptors" to send to the server.
The rate limit server is responsible for defining, and enforcing, the appropriate limits matching the descriptors.

#### Deploy a rate limit server

Agentgateway connects to any server that implements the [Envoy Rate Limit gRPC service](https://www.envoyproxy.io/docs/envoy/latest/api-v3/service/ratelimit/v3/rls.proto). The Envoy project provides a reference [`ratelimit`](https://github.com/envoyproxy/ratelimit) server that stores counters in Redis. If you already run a compatible service, skip to [Connect agentgateway to the rate limit server](#connect-agentgateway-to-the-rate-limit-server) and point `host` at it instead.

The following example runs the `ratelimit` server and its Redis backing store locally with Docker Compose.

1. Create a rate limit configuration for the server. The `domain` and each descriptor `key` must match the `domain` and descriptor entries that agentgateway sends (configured in the next section). This example limits each distinct `organization` value to 5,000 requests per hour.

   ```yaml
   # ratelimit-config/config.yaml
   domain: example.com
   descriptors:
     - key: organization
       rate_limit:
         unit: hour
         requests_per_unit: 5000
   ```

2. Create a Docker Compose file to run the rate limit server and Redis. The server loads every `*.yaml` file under the mounted config directory, and serves the gRPC API on port `8081`.

   ```yaml
   # docker-compose.yaml
   services:
     redis:
       image: redis:8-alpine
       ports: ["6379:6379"]

     ratelimit:
       image: envoyproxy/ratelimit:master
       depends_on: [redis]
       ports:
         - "8081:8081"   # gRPC port that agentgateway connects to
       environment:
         USE_STATSD: "false"
         LOG_LEVEL: debug
         REDIS_SOCKET_TYPE: tcp
         REDIS_URL: redis:6379
         RUNTIME_ROOT: /data
         RUNTIME_SUBDIRECTORY: ratelimit
         RUNTIME_WATCH_ROOT: "false"
       volumes:
         - ./ratelimit-config:/data/ratelimit/config
   ```

3. Start the server.

   ```sh
   docker compose up -d
   ```

4. Verify that the server is running. The `ratelimit` container logs the descriptors it loaded from your config.

   ```sh
   docker compose logs ratelimit
   ```

> [!NOTE]
> Setting `LOG_LEVEL: debug` makes the server log every descriptor it receives from agentgateway at request time, which is the fastest way to confirm that your `domain` and descriptor keys line up on both sides.

#### Connect agentgateway to the rate limit server

With the server running, configure agentgateway to connect to it and specify which descriptors to send. Each descriptor value is a [CEL expression]({{< link-hextra path="/documentation/configuration/traffic-management/transformations" >}}). You can configure the connection in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
The following steps add the same `remoteRateLimit` policy as the **Simplified (LLM)** example in the **Config file** tab.

1. Create a configuration with an LLM model, but no rate limit policy, and start agentgateway with it.
   ```yaml
   # yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
   llm:
     models:
     - name: "*"
       provider: openAI
       params:
         apiKey: "$OPENAI_API_KEY"
   ```
2. Open [http://localhost:15000/ui/llm/policies](http://localhost:15000/ui/llm/policies) (**LLM** > **Policies**), and click the **Remote rate limit** tile.
3. In the **Service** section, fill out the following fields.
   1. **Domain**: `example.com`. The domain must match the domain on the rate limit server.
   2. **Failure mode**: Keep **Fail closed**.
   3. **Host**: Replace the default host with `localhost:8081`, the address of the rate limit server.
4. In the **Descriptors** section, configure **Descriptor 1**.
   1. Select **Tokens** for the **Type**.
   2. Click **Add entry** twice, so that the descriptor has three entries.
   3. Enter the following keys and CEL expressions in the **Entries**. Replace the example entry in the first row.

      | Key | Expression |
      |-----|------------|
      | `some-static-value` | `"something"` |
      | `organization` | `request.headers["x-organization"]` |
      | `authenticated` | `has(jwt.sub)` |

5. Click **Save policy**.

You can also add a remote rate limit policy in **MCP** > **Policies**, or in the **Route policies** section of a named route in **Traffic** > **Routes**.
{{% /tab %}}
{{% tab name="Config file" %}}
{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
llm:
  policies:
    remoteRateLimit:
      # The address to access the rate limit server
      host: localhost:8081
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
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
mcp:
  port: 3000
  policies:
    remoteRateLimit:
      # The address to access the rate limit server
      host: localhost:8081
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
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
gateways:
  default:
    port: 3000
routes:
- policies:
    remoteRateLimit:
      # The address to access the rate limit server
      host: localhost:8081
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
        type: requests
  backends:
  - host: localhost:8080
```
{{< /tab >}}
{{< /tabs >}}
{{% /tab %}}
{{< /tabs >}}

Each descriptor value is a [CEL expression]({{< link-hextra path="/documentation/configuration/traffic-management/transformations" >}}).

A `tokens` descriptor counts LLM tokens, so it applies only to routes whose backend is an LLM provider. On other routes, such as a route to an HTTP or MCP backend, a `tokens` descriptor is never sent to the rate limit server. As a result, the route is not limited. Use `type: requests` for those routes.

> [!WARNING]
> Agentgateway sends a descriptor only when every one of its entries can be evaluated. If an entry reads a header, claim, or metadata field that the request does not have, the whole descriptor is skipped. When no descriptor is left, agentgateway does not call the rate limit server at all, so no limit applies to that request. This behavior differs from a local rate limit `key`, which counts such requests against one shared bucket.

To make sure that every request is counted, give each entry a fallback value for requests that do not have the field. In the following example, requests without an `x-organization` header count against one shared `unknown` organization.

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
gateways:
  default:
    port: 3000
routes:
- policies:
    remoteRateLimit:
      host: localhost:8081
      domain: example.com
      descriptors:
      - entries:
        - key: organization
          # Requests without the header count against one shared "unknown" organization.
          value: '"x-organization" in request.headers ? request.headers["x-organization"] : "unknown"'
        type: requests
  backends:
  - host: localhost:8080
```

For a complete runnable setup, including the Envoy rate limit service configuration and the Docker commands to run it with Redis, see the [`traffic-ratelimiting-global` example](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-ratelimiting-global) in the agentgateway repository.

{{% details title="Configuration from the traffic-ratelimiting-global example" closed="true" %}}
{{% github-yaml url="https://agentgateway.dev/examples/traffic-ratelimiting-global/config.yaml" %}}

The example also defines the limits on the rate limit server side:

{{% github-yaml url="https://agentgateway.dev/examples/traffic-ratelimiting-global/ratelimit-config.yaml" %}}
{{% /details %}}

#### Compute a limit per request {#limit-override}

By default, the rate limit server holds the limit for each descriptor in the `rate_limit` block of its own configuration. To let the request carry its own limit instead, set `limitOverride` on the descriptor. Agentgateway evaluates the CEL expression for each request and sends the result with the descriptor. The rate limit server then applies that limit in place of its own `rate_limit` value for the descriptor. Use this field when the limit belongs to the caller rather than to the route, such as a plan that arrives in a header or a JWT claim.

The expression must return an object with a `unit` and a `requestsPerUnit` field. In the following example, organizations on the gold plan get 3 requests per minute, and every other organization gets 1. The rate limit server's own limit for `organization` does not apply.

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
gateways:
  default:
    port: 3000
routes:
- policies:
    remoteRateLimit:
      host: localhost:8081
      domain: example.com
      descriptors:
      - entries:
        - key: organization
          value: '"x-organization" in request.headers ? request.headers["x-organization"] : "unknown"'
        # Organizations on the gold plan get 3 requests per minute, every other organization 1.
        limitOverride: '"x-plan" in request.headers && request.headers["x-plan"] == "gold" ? {"unit": "minute", "requestsPerUnit": 3} : {"unit": "minute", "requestsPerUnit": 1}'
        type: requests
  backends:
  - host: localhost:8080
```

| Field | Description |
|-------|-------------|
| `descriptors[].limitOverride` | Optional CEL expression that returns the limit for this descriptor, as an object with `unit` and `requestsPerUnit`, such as `{"unit": "minute", "requestsPerUnit": 5}`. Valid `unit` values are `second`, `minute`, `hour`, `day`, `month`, and `year`. The rate limit server applies this limit in place of its own limit for the descriptor. The field sets the limit, not the cost of a request. To set the cost, use `cost`. |

> [!WARNING]
> If the `limitOverride` expression fails for a request, such as when the expression reads a header that the request does not have, the whole descriptor is skipped. No limit applies to that request for this descriptor, not even the rate limit server's own rule. Guard any value that might be absent, as the example does with `in`. An expression that is not valid CEL is rejected when the configuration loads. However, a valid expression that returns an unusable limit, such as a misspelled `unit`, is not caught at load time. In that case, the descriptor is skipped for every request.

#### Limit MCP tool calls {#mcp-tools}

Every MCP message, such as `initialize`, `tools/list`, or `tools/call`, is a separate HTTP request, so a rate limit on an MCP route counts each of these messages. To limit only tool calls, and each tool separately, send the tool name as a descriptor entry. On an MCP route, a descriptor can read the parsed MCP request through the `mcp` variable.

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
gateways:
  default:
    port: 3000
routes:
- policies:
    remoteRateLimit:
      host: localhost:8081
      domain: mcp-tools
      descriptors:
      - entries:
        # The tool name for a tools/call request, and "none" for every other MCP request.
        - key: tool_name
          value: 'mcp.methodName == "tools/call" ? mcp.tool.name : "none"'
        type: requests
  backends:
  - mcp:
      targets:
      - name: everything
        stdio:
          cmd: npx
          args: ["@modelcontextprotocol/server-everything"]
```

On the rate limit server, define a limit for each tool that you want to limit. The following configuration allows one `echo` call per minute. Other tools, and every request that is sent with the `none` value, match no rule and are not limited.

```yaml
# ratelimit-config/mcp-tools.yaml
domain: mcp-tools
descriptors:
  - key: tool_name
    value: echo
    rate_limit:
      unit: minute
      requests_per_unit: 1
```

When a client calls the `echo` tool a second time within the minute, the call returns a tool result with `isError: true`, as described in [Responses when a request is limited](#limited-responses).

For a local alternative that gives each client its own allowance per tool, see [Per-client, per-tool limits for MCP](#per-key-mcp).

#### Failure behavior

By default, if the remote rate limit service is unavailable or returns an error, agentgateway **fails closed**: the request is denied with a `500 Internal Server Error`. This prevents unmetered traffic in the event of a service outage.

To allow requests through when the rate limit service is unavailable, set `failureMode` to `failOpen`:

```yaml
remoteRateLimit:
  host: localhost:8081
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

> [!WARNING]
> Be cautious when setting the failure mode to `failOpen`. While this setting prevents service disruptions if the rate limiting server is unavailable, rate limits are not enforced for your routes until the rate limiting server is available again.

#### Backend connection policies

You can configure connection policies on the `remoteRateLimit` field to secure or tune how agentgateway connects to the rate limit service. This includes TLS, authentication, and connection timeouts.

By default, agentgateway waits 10 seconds for the rate limit service to respond. When the wait runs out, the call fails and the `failureMode` setting decides what happens to the request. To use a different timeout, set `policies.http.requestTimeout`.

The route's own `timeout.requestTimeout` does not limit how long agentgateway waits for the rate limit service. A rate limit service that accepts the connection but does not answer therefore delays each request for the full wait before `failureMode` applies. To bound that delay, set `policies.http.requestTimeout` to a value that is lower than the route's request timeout.

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
      connectTimeout: 3s
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
| `policies.tcp.connectTimeout` | Connection timeout as a duration string, such as `3s`. |
| `policies.http.requestTimeout` | Request-level timeout as a duration string (for example, `"5s"`). If unset, calls to the rate limit service time out after 10 seconds. |

## Responses when a request is limited {#limited-responses}

When a rate limit refuses a request, agentgateway returns a `429 Too Many Requests` response. Responses also carry headers that describe the limit that applied, so that a client can slow down before the client is refused.

| Header | Description |
|--------|-------------|
| `x-ratelimit-limit` | The limit of the bucket or descriptor that applied. When more than one limit applies, the headers describe the limit with the fewest requests remaining. |
| `x-ratelimit-remaining` | How much of that limit is left. |
| `x-ratelimit-reset` | The number of seconds until the limit resets. |
| `retry-after` | On a `429` response only. The number of seconds until the client can retry. |

A local rate limit returns the body `rate limit exceeded`. A remote rate limit returns the body that the rate limit server sends, which is empty for the Envoy reference `ratelimit` server.

For MCP requests, the refusal takes the form that MCP clients expect.

* A refused `tools/call` request gets a tool result with `isError: true` and a text such as `rate limit exceeded (retry after 12s; limit 1, remaining 0)`.
* Other requests that carry a JSON-RPC `id`, such as `initialize`, get an HTTP `200` response with a JSON-RPC error with code `-32003`.
* A notification, which has no `id`, gets a plain `429` response.

For more information, see [Tool-call error results]({{< link-hextra path="/documentation/mcp/spec-compatibility/#tool-call-error-results" >}}).

## Conditional execution

To apply different rate limits based on the request, use the `conditional` field. For example, you can apply stricter limits on writes than on reads. For details, see [Conditional policies]({{< link-hextra path="/documentation/configuration/policies/conditional-policies" >}}).
