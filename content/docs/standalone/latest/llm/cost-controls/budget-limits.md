---
title: Budget and spend limits
weight: 40
description: Enforce per-key token budgets and dollar spend caps on LLM traffic with rate limiting.
test: skip
---

The [Virtual key management]({{< link-hextra path="/llm/cost-controls/virtual-keys/" >}}) guide caps usage with a gateway-wide `localRateLimit`. This guide goes further: enforce budgets per key or per user with remote rate limiting, and cap spend in dollars by rate limiting on the realized cost from your [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}).

Budget limits enforce token or cost quotas using a token bucket. Each user or API key gets a virtual budget; each request draws it down, and the bucket refills at a configured interval. When the budget is exhausted, requests are rejected with a `429` until the bucket refills.

## Before you begin

1. Complete the [Virtual key management]({{< link-hextra path="/llm/cost-controls/virtual-keys/" >}}) guide to set up API key authentication and a token budget.
2. To enforce budgets per key or user (rather than a single shared budget), [deploy a remote rate limit server]({{< link-hextra path="/configuration/resiliency/rate-limits/#deploy-a-rate-limit-server" >}}). The examples in this guide assume the server is reachable at `localhost:8081`.

## Per-key token budgets

To give each user their own budget, use `remoteRateLimit` with a descriptor keyed on the API key's identity, and let the rate limit server hold the per-user counters.

> [!NOTE]
> Token-based rate limits are checked in two phases, at request time and at response time, because the completion token count is not known until the response returns. For details, see [Token-based rate limits]({{< link-hextra path="/configuration/resiliency/rate-limits/#token-based-rate-limits" >}}).

1. Configure agentgateway to send a per-user descriptor to the rate limit server. The `apiKey.user` value comes from the API key `metadata` you set in the virtual keys guide, so each user is counted independently. Setting `type: tokens` counts LLM tokens (not requests) against the budget.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
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
       remoteRateLimit:
         host: localhost:8081
         domain: token-budgets
         descriptors:
         - entries:
           - key: user_id
             value: apiKey.user
           type: tokens
     models:
     - name: "*"
       provider: openAI
       params:
         apiKey: "$OPENAI_API_KEY"
   ```

2. Configure the rate limit server with a per-user daily token budget. The `key` matches the descriptor entry key that agentgateway sends.

   ```yaml
   # ratelimit-config/config.yaml
   domain: token-budgets
   descriptors:
     - key: user_id
       rate_limit:
         unit: day
         requests_per_unit: 100000  # 100,000 tokens per user per day
   ```

When a user reaches their daily token budget, further requests are rejected with a `429` until the budget refills.

## Local token budgets

For simpler setups that do not need shared state across replicas, use `localRateLimit` instead of a remote server. Remember that a local limit is gateway-wide, not per-key, and supports only `Seconds`, `Minutes`, and `Hours` intervals (no daily budgets).

```yaml
llm:
  policies:
    localRateLimit:
    - maxTokens: 5000
      tokensPerFill: 5000
      fillInterval: 1h
      type: tokens
```

For the full local rate limit walkthrough, see [Virtual key management]({{< link-hextra path="/llm/cost-controls/virtual-keys/#configure-token-budgets" >}}).

## Convert budget to cost

To estimate the dollar value of a token budget, multiply by your provider's pricing. For example, with OpenAI GPT-4:

- Input tokens: $30 per 1M tokens
- Output tokens: $60 per 1M tokens

A 100,000 token budget (assuming a 50/50 input/output mix):

```
cost = (50,000 / 1,000,000 × $30) + (50,000 / 1,000,000 × $60)
     = $1.50 + $3.00
     = $4.50 per day
```

Token budgets approximate spend but drift as prices or model mix change. To cap spend in dollars directly, enforce a dollar budget instead.

<!--TODO dollar budget

## Enforce a dollar budget

The budgets in the previous sections are measured in *tokens*. If you configure a [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}), agentgateway computes the realized USD cost of each request and exposes it to CEL as `llm.cost`. You can then rate limit on *dollars* directly, which enforces a true spend cap regardless of which model or input/output token mix each user hits.

> [!NOTE]
> - Cost is evaluated *after* the response completes. The request that crosses the budget still completes; the user's *next* request is rejected with a `429`. Budgets are therefore approximate at the boundary.
> - The `cost` expression must return an unsigned integer. Because USD costs are fractional (for example, `$0.0000057`), scale them to **micro-dollars** (USD × 1,000,000) with `uint()`. A budget of `1000000` micro-dollars equals `$1.00`.

Enforce a dollar budget:

1. Add a `cost` expression to the descriptor that converts the realized cost to micro-dollars.
   
   * The following example keys the budget on the `apiKey.user` that you set up in the virtual keys guide before you began.
   * The budget limits spending on the total cost (`llm.cost.total`).
   * To budget on a single cost component instead of the total, use that field in the expression. For example, `llm.cost.output` budgets only on output-token spend.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     policies:
       apiKey:
         mode: strict
         keys:
         - key: sk-alice-abc123def456
           metadata:
             user: alice
       remoteRateLimit:
         host: localhost:8081
         domain: spend-budgets
         descriptors:
         - entries:
           - key: user_id
             value: apiKey.user
           type: tokens
           # Realized USD cost scaled to integer micro-dollars (USD x 1,000,000).
           cost: 'uint(llm.cost.total * 1000000)'
     models:
     - name: "*"
       provider: openAI
       params:
         apiKey: "$OPENAI_API_KEY"
   ```

2. Configure the rate limit server with the user's daily budget expressed in micro-dollars. Reuse the same rate limit server that you deployed for token budgets. Dollar enforcement uses the identical Envoy rate limit service and protocol. Use a separate `domain` (`spend-budgets`) so it does not collide with your token-budget descriptors. This example caps each user at `$1.00` per day (`1000000` micro-dollars).

   ```yaml
   # ratelimit-config/config.yaml
   domain: spend-budgets
   descriptors:
     - key: user_id
       rate_limit:
         unit: day
         requests_per_unit: 1000000  # $1.00/day in micro-dollars
   ```

3. Send requests as a user. After each response, agentgateway computes the request's micro-dollar cost and sends it to the rate limit server as the request's cost. When the user's accumulated spend reaches the daily budget, further requests are rejected with a `429` until the budget refills.

   Example agentgateway logs for a successful request under the `$1` threshold:

   ```
   2026-07-08T21:17:12.59908Z	info	request gateway=default/default listener=llm route=internal/llm:request endpoint=api.openai.com:443 src.addr=[::1]:61586 http.method=POST http.host=localhost http.path=/v1/chat/completions http.version=HTTP/1.1 http.status=200 protocol=llm gen_ai.operation.name=chat gen_ai.provider.name=openai gen_ai.request.model=gpt-3.5-turbo gen_ai.response.model=gpt-3.5-turbo-0125 gen_ai.usage.input_tokens=12 gen_ai.usage.cache_read.input_tokens=0 gen_ai.usage.output_tokens=258 agw.ai.usage.cost.total=0.000393 gen_ai.usage.output_audio_tokens=0 duration=2603ms
   ```

   Example agentgateway logs for a rate limited request over the `$1` threshold:

   ```
   2026-07-08T21:17:12.59908Z	info	request gateway=default/default listener=llm route=internal/llm:request endpoint=api.openai.com:443 src.addr=[::1]:61586 http.method=POST http.host=localhost http.path=/v1/chat/completions http.version=HTTP/1.1 http.status=429 protocol=llm gen_ai.operation.name=chat gen_ai.provider.name=openai gen_ai.request.model=gpt-3.5-turbo gen_ai.response.model=gpt-3.5-turbo-0125 gen_ai.usage.input_tokens=12 gen_ai.usage.cache_read.input_tokens=0 gen_ai.usage.output_tokens=258 agw.ai.usage.cost.total=1.490003 gen_ai.usage.output_audio_tokens=0 duration=2603ms
   ```

-->

## Monitor budget usage

Track how much of each user's budget has been consumed with the Prometheus metrics that agentgateway exposes.

```sh
curl http://localhost:15020/metrics
```

Query token usage by user with the `agentgateway_gen_ai_client_token_usage_sum` metric, or realized cost with `agw.ai.usage.cost.total`. For per-key spending queries and cost tracking, see [Virtual key management]({{< link-hextra path="/llm/cost-controls/virtual-keys/#monitor-per-key-spending" >}}) and [Model costs]({{< link-hextra path="/llm/cost-controls/costs/" >}}).
