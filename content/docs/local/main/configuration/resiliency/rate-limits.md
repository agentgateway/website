---
title: Rate limiting
weight: 10
---

Attach to:
{{< badge content="Route" link="/docs/configuration/routes/">}}

Agentgateway rate limiting policies allow controlling the rate of requests incoming to a route.

## Rate limit types

Agentgateway exposes two types of rate limits:

**Local rate limits** apply in memory, and counters are not shared between replicas of agentgateway, nor across restarts.
These are very low overhead, but not appropriate for usage where exact global counts are required, or for limits with long time windows (like monthly limits).

**Remote rate limits** store counters in an pluggable external data store, which enables shared state across replicas of agentgateway.
This is controlled via the [Envoy Rate Limit gRPC service](https://www.envoyproxy.io/docs/envoy/latest/api-v3/service/ratelimit/v3/rls.proto) to enable re-use with existing rate limiting services built for Envoy; the Envoy project has an example [rate limiter service](https://github.com/envoyproxy/ratelimit) that can be used.

## Rate limit modes

In additional to simple request-based rate limits, agentgateway can limit requests based on *tokens* for [LLM consumption](/docs/llm/).

### Request-based rate limits

By default, agentgateway applies rate limits to requests. Therefore, each request consumes 1 unit of capacity.

To explicitly set request-based rate limits, set the rate limiting type to `requests` as shown in the following example. 

```yaml
      policies:
        localRateLimit:
          - maxTokens: 10
            tokensPerFill: 1
            fillInterval: 60s
            type: requests

```



### Token-based rate limits

For tokens, each token (prompt or completion) consumes 1 unit of capacity.
Because the number of tokens that are used for the completion is not known at the time the request is sent, calculating the number of tokens can become tricky. To work around this issue, agentgateway checks token-based rate limits in two phases, at request time and at response time. 

To enable token-based rate limiting, set the rate limiting type to `token` as shown in the following example. 

```yaml
      policies:
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

```yaml
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
```

> [!NOTE]
> The term "tokens" is used for two distinct meanings. In `maxTokens` and `tokensPerFill`, it indicates the "token" in the token bucket counter. Each token can allow either 1 LLM token, or 1 HTTP request, based on the `type`.

### Remote

Remote rate limits are not defined directly in agentgateway.
Instead, agentgateway is configured to connect to an external rate limit server, and which "descriptors" to send to the server.
The rate limit server is responsible for defining, and enforcing, the appropriate limits matching the descriptors.

```yaml
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
```

Each descriptor value is a [CEL expression](/docs/operations/cel).
