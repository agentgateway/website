---
title: Rate limit token budgets
weight: 20
description: Cap LLM token usage with a token bucket, per user with a rate limit server or gateway-wide.
test: skip
---

Cap LLM token usage with a token bucket, per user or gateway-wide.

## About rate limit token budgets

A rate limit token budget caps token usage with a token bucket rather than a fixed window. Each user or API key draws down its own bucket, and the bucket refills at a configured interval. While a bucket is empty, agentgateway rejects that user's requests with a `429`.

Unlike a [per-key budget]({{< link-hextra path="/llm/cost-controls/budget-limits/per-key/" >}}), a rate limit token budget needs no database, and it works in both standalone and Kubernetes mode. It counts tokens only, so it caps spend as an estimate rather than as a true dollar cap.

> [!NOTE]
> Agentgateway checks a token-based rate limit in two phases, at request time and at response time. The provider reports the completion token count only in the response. For details, see [Token-based rate limits]({{< link-hextra path="/configuration/resiliency/rate-limits/#token-based-rate-limits" >}}).
>
> The input count that a request debits includes the tokens that the provider read from or wrote to its prompt cache. Anthropic and Amazon Bedrock exclude cached tokens from the count that they report. A cache-heavy request against those providers therefore debits more than their reported input count. For more information, see [Token usage fields]({{< link-hextra path="/llm/observability/#token-usage-fields" >}}).

## Set a per-user token budget

To give every user a separate budget, use `remoteRateLimit` with a descriptor that keys on the API key identity. The rate limit server then holds the per-user counters. To deploy the server, see [Deploy a rate limit server]({{< link-hextra path="/configuration/resiliency/rate-limits/#deploy-a-rate-limit-server" >}}). The following examples assume that the server is reachable at `localhost:8081`.

1. Configure agentgateway to send a per-user descriptor to the rate limit server. The `apiKey.user` value comes from the API key `metadata`, so agentgateway counts each user independently. To count LLM tokens rather than requests, set `type: tokens`.

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

When a user reaches their daily budget, agentgateway rejects further requests with a `429` until the bucket refills.

## Set a gateway-wide token budget

For setups that do not need shared state across replicas, use `localRateLimit` instead of a remote server. A local limit is gateway-wide rather than per user, and it supports only `Seconds`, `Minutes`, and `Hours` intervals, so it cannot express a daily budget.

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

## Convert a token budget to cost

To estimate the dollar value of a token budget, multiply the budget by your provider's prices. For example, take a model that charges $30 per 1M input tokens and $60 per 1M output tokens. A 100,000-token budget with an even split between input and output costs about $4.50 per day.

```
cost = (50,000 / 1,000,000 x $30) + (50,000 / 1,000,000 x $60)
     = $1.50 + $3.00
     = $4.50 per day
```

A token budget approximates spend, but it drifts as prices or the model mix change. To cap spend in dollars directly, use a [per-key dollar budget]({{< link-hextra path="/llm/cost-controls/budget-limits/per-key/" >}}) instead.

## Monitor token usage

To track how much of each budget a user has consumed, query the Prometheus metrics that agentgateway exposes.

```sh
curl http://localhost:15020/metrics
```

Query token usage by user with the `agentgateway_gen_ai_client_token_usage_sum` metric, or realized cost with `agw.ai.usage.cost.total`. For per-key spending queries and cost tracking, see [Virtual key management]({{< link-hextra path="/llm/cost-controls/virtual-keys/#monitor-per-key-spending" >}}) and [Model costs]({{< link-hextra path="/llm/cost-controls/costs/" >}}).

> [!WARNING]
> When you sum token usage, do not add the `input_cache_read` or `input_cache_write` token types to the `input` type. The `input` series already includes the cached tokens, so adding them double counts.

## What's next

- Cap spend in dollars with [per-key dollar or token budgets]({{< link-hextra path="/llm/cost-controls/budget-limits/per-key/" >}}).
- Attribute usage to teams and keys with [Virtual key management]({{< link-hextra path="/llm/cost-controls/virtual-keys/" >}}).
- Review the rate limit policy fields in [Rate limits]({{< link-hextra path="/configuration/resiliency/rate-limits/" >}}).
