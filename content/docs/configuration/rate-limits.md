---
title: Rate Limiting Policies
weight: 12
description: 
---

Agentgateway rate limiting policies allow controlling the rate of requests incoming to a route.

## Rate limit types

Agentgateway exposes two types of rate limits:

**Local rate limits** apply in memory, and counters are not shared between replicas of agentgateway, nor across restarts.
These are very low overhead, but not appropriate for usage where exact global counts are required, or for limits with long time windows (like monthly limits).

**Remote rate limits** store counters in an pluggable external data store, which enables shared state across replicas of agentgateway.
This is controlled via the [Envoy Rate Limit gRPC service](https://www.envoyproxy.io/docs/envoy/latest/api-v3/service/ratelimit/v3/rls.proto) to enable re-use with existing rate limiting services built for Envoy; the Envoy project has an example [rate limiter service](https://github.com/envoyproxy/ratelimit) that can be used.

## Rate limit modes

In additional to simple request-based rate limits, agentgateway can limit requests based on *tokens* for [LLM consumption](/docs/llm/).

For requests, the count is simple: each request consumes 1 unit of capacity.

For tokens, each token (prompt or completion) consumes 1 unit of capacity.
However, calculating this can be tricky, as the completion token usage is not known until after the request is complete.
As a result, token-based rate limits are checked in two phases:

1. At request time:
  * If `tokenize: true` is set on the AI backend, the prompt token count will be estimated, and the prompt tokens are counted against the allowed account. If the token usage exceeds to allowed amount, the request is denied.
  * Otherwise, a request will only be denied if there are no tokens allowed at all.
2. At response time, the completion tokens are counted against the rate limit. Even if the count is exceeded, the response is allowed.
  LLM responses typically will additional include the exact prompt token count; if this differs from the count recorded during the request (whether this is due to tokenization being disabled, which means the count is always `0`, or if the estimation was off) the difference between these will also be accounted for.

## Configuration

### Local

Local rate limiting uses a [Token bucket](https://en.wikipedia.org/wiki/Token_bucket) algorithm.

|Field|Meaning|
|-|-|
|`maxTokens`|Maximum, and initial, size of the bucket|
|`fillInterval`|How often to refill the bucket|
|`tokensPerFill`|How many tokens to replenish per fill|

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
