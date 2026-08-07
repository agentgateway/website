Global rate limiting requires an external rate limit server that stores the budgets and maintains the counters. Deploy Redis and the rate limit service as described in [Deploy the rate limit service]({{< link-hextra path="/security/rate-limit-global#deploy-service" >}}) in the global rate limiting guide. That example deploys a `ratelimit` Service in the `ratelimit` namespace (the target of the `backendRef` in the previous step) and configures it with the `user_id` token-budget descriptor that this guide relies on:

```yaml
# Excerpt from the rate limit server ConfigMap
domain: agentgateway
descriptors:
  - key: user_id
    rate_limit:
      unit: day
      requests_per_unit: 100   # 100 tokens per day per user
```

The `key` (`user_id`) matches the descriptor `name` in your token budget policy, and the `domain` (`agentgateway`) matches the policy's `domain`. The `requests_per_unit` value is the per-user token budget, because the policy reports token usage with `unit: Tokens`. To change the budget, edit `requests_per_unit` in the server config; to change the window, edit `unit` (`second`, `minute`, `hour`, or `day`).