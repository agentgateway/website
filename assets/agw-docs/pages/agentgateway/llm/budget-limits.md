Control LLM spending by enforcing token budget limits per API key or user.

## About

Budget limits (also known as spend limits or quota management) help you control LLM costs by restricting how many tokens each user or API key can consume within a time window. This prevents runaway spending and ensures fair resource allocation across teams and applications.

{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} implements budget limits by combining three capabilities:
- **API key authentication**: Identify incoming requests by API key
- **Token-based rate limiting**: Enforce token consumption limits per user or key
- **Token usage metrics**: Track actual spending for visibility and chargeback

Other AI gateways often call this feature "virtual keys" or "virtual key management." {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} achieves the same outcome through composable policies rather than a single abstraction, giving you more flexibility in how you apply limits.

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

## How budget limits work

Budget limits enforce token consumption quotas using token bucket rate limiting. Each user or API key gets a virtual "budget" measured in tokens rather than requests.

Key concepts:
- **Token bucket**: A virtual bucket that holds a certain number of tokens (your budget)
- **Token consumption**: Each LLM request consumes tokens based on the input + output token count
- **Refill interval**: How often the bucket refills (e.g., daily, hourly)
- **Keying**: How to identify users (by header, JWT claim, or remote address)

When a request arrives:

```mermaid
flowchart TD
  A[Request arrives] --> B[Validate API key]
  B --> C[Count against token budget]
  C --> D{Budget available?}
  subgraph refill["Budget refills periodically"]
    D
  end
  D -->|Yes| E[Request proceeds]
  D -->|No| F[Reject with 429]
```

1. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} validates the API key (if required)
2. The request is counted against the user's token budget
3. If the budget has tokens available, the request proceeds
4. If the budget is exhausted, the request is rejected with a 429 status code
5. The bucket refills at the configured interval

## Set up daily budget limits per API key

This example shows how to set up a daily token budget of 100,000 tokens per API key.

### Create API keys for users

1. Create API key secrets for each user. Each secret includes a label that you can use to reference the keys in the authentication policy.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: user-alice-key
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       api-key-group: llm-users
   type: extauth.solo.io/apikey
   stringData:
     api-key: sk-alice-abc123def456
   ---
   apiVersion: v1
   kind: Secret
   metadata:
     name: user-bob-key
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       api-key-group: llm-users
   type: extauth.solo.io/apikey
   stringData:
     api-key: sk-bob-xyz789uvw012
   EOF
   ```

2. Verify that the secrets are created.
   ```sh
   kubectl get secrets -n {{< reuse "agw-docs/snippets/namespace.md" >}} -l api-key-group=llm-users
   ```

### Configure API key authentication

Create a {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that requires API key authentication for all requests to the gateway.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: api-key-auth
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: agentgateway-proxy
  traffic:
    apiKeyAuthentication:
      mode: Strict
      secretSelector:
        matchLabels:
          api-key-group: llm-users
      extractFrom:
        headers:
          - name: "X-User-ID"
EOF
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting     | Description |
|-------------|-------------|
| `targetRefs` | Apply the policy to the entire Gateway, so all routes require API keys. |
| `apiKeyAuthentication.mode` | Set to `Strict` to require a valid API key for all requests. |
| `secretSelector` | Use label selectors to reference all API key secrets with the `api-key-group: llm-users` label. |
| `extractFrom.headers` | Extract the user ID from the `X-User-ID` header. This header value is used for rate limiting. |

### Configure token-based budget limits

Create a {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that enforces a daily token budget of 100,000 tokens per user.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: daily-token-budget
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: agentgateway-proxy
  traffic:
    rateLimit:
      global:
        domain: token-budgets
        rateLimitServerRef:
          name: rate-limit-server
          namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        descriptors:
          - entries:
              - key: user_id
                header: "X-User-ID"
            type: tokens
EOF
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting     | Description |
|-------------|-------------|
| `rateLimit.global` | Use global rate limiting to enforce limits across all {{< reuse "agw-docs/snippets/agentgateway.md" >}} instances. |
| `domain` | A namespace for rate limit configurations. Use `token-budgets` to organize your budget policies. |
| `descriptors[].entries[].key` | The key to use for rate limiting. Set to `user_id` to rate limit per user. |
| `descriptors[].entries[].header` | Extract the user ID from the `X-User-ID` header. |
| `descriptors[].type` | Set to `tokens` to enforce token-based limits instead of request-based limits. |

### Configure the rate limit server

Deploy a rate limit server and configure it with your budget limits.

1. Deploy the rate limit server. For setup instructions, see the [global rate limiting guide]({{< link-hextra path="/configuration/resiliency/rate-limits/" >}}).

2. Create a ConfigMap with your budget configuration.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: rate-limit-config
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   data:
     config.yaml: |
       domain: token-budgets
       descriptors:
         - key: user_id
           rate_limit:
             unit: day
             requests_per_unit: 100000
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting     | Description |
   |-------------|-------------|
   | `domain` | Must match the domain in your {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} (`token-budgets`). |
   | `descriptors[].key` | Must match the descriptor key (`user_id`). |
   | `rate_limit.unit` | The time window for the budget. Use `day` for daily budgets. Other options: `second`, `minute`, `hour`. |
   | `rate_limit.requests_per_unit` | The token budget. Set to 100,000 tokens per day. Since `type: tokens` is set, this counts tokens rather than requests. |

### Test the budget limits

1. Send a request with Alice's API key. Verify that the request succeeds.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "$INGRESS_GW_ADDRESS/openai" \
     -H "Authorization: Bearer sk-alice-abc123def456" \
     -H "X-User-ID: alice" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [{"role": "user", "content": "Hello!"}]
     }'
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/openai" \
     -H "Authorization: Bearer sk-alice-abc123def456" \
     -H "X-User-ID: alice" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [{"role": "user", "content": "Hello!"}]
     }'
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Check Alice's remaining token budget in the rate limit server logs or metrics.

3. Send requests that exceed the 100,000 token budget. Verify that subsequent requests are rejected with a 429 status code.

   Example 429 response:
   ```
   HTTP/1.1 429 Too Many Requests
   x-ratelimit-limit: 100000
   x-ratelimit-remaining: 0
   x-ratelimit-reset: 43200

   rate limit exceeded
   ```

4. Verify that Bob can still send requests with his own budget, independent of Alice's usage.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "$INGRESS_GW_ADDRESS/openai" \
     -H "Authorization: Bearer sk-bob-xyz789uvw012" \
     -H "X-User-ID: bob" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [{"role": "user", "content": "Hello!"}]
     }'
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/openai" \
     -H "Authorization: Bearer sk-bob-xyz789uvw012" \
     -H "X-User-ID: bob" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [{"role": "user", "content": "Hello!"}]
     }'
   ```
   {{% /tab %}}
   {{< /tabs >}}

## Other configuration examples

### Hourly budget limits

Set a smaller budget that refreshes every hour for tighter cost control.

```yaml
# In rate-limit-config ConfigMap
domain: token-budgets
descriptors:
  - key: user_id
    rate_limit:
      unit: hour
      requests_per_unit: 10000  # 10,000 tokens per hour
```

### Per-route budget limits

Apply different budgets to different routes, such as higher limits for production and lower limits for development.

1. Create separate {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resources for each HTTPRoute instead of targeting the Gateway.

   ```yaml
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: prod-token-budget
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: openai-prod
     traffic:
       rateLimit:
         global:
           domain: token-budgets
           rateLimitServerRef:
             name: rate-limit-server
             namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
           descriptors:
             - entries:
                 - key: route
                   value: "prod"
                 - key: user_id
                   header: "X-User-ID"
               type: tokens
   ```

2. Configure the rate limit server with nested descriptors for route-specific budgets.

   ```yaml
   domain: token-budgets
   descriptors:
     - key: route
       value: "prod"
       descriptors:
         - key: user_id
           rate_limit:
             unit: day
             requests_per_unit: 200000  # Higher limit for prod
     - key: route
       value: "dev"
       descriptors:
         - key: user_id
           rate_limit:
             unit: day
             requests_per_unit: 50000  # Lower limit for dev
   ```

### Tiered budgets based on user type

Provide different budget tiers for free, standard, and premium users.

1. Add a tier label to each API key secret.

   ```yaml
   apiVersion: v1
   kind: Secret
   metadata:
     name: user-alice-key
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       api-key-group: llm-users
       tier: premium
   type: extauth.solo.io/apikey
   stringData:
     api-key: sk-alice-abc123def456
   ---
   apiVersion: v1
   kind: Secret
   metadata:
     name: user-charlie-key
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       api-key-group: llm-users
       tier: free
   type: extauth.solo.io/apikey
   stringData:
     api-key: sk-charlie-ghi345jkl678
   ```

2. Configure rate limiting to use the tier from a header that's set based on the API key.

   ```yaml
   traffic:
     rateLimit:
       global:
         domain: token-budgets
         rateLimitServerRef:
           name: rate-limit-server
           namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         descriptors:
           - entries:
               - key: tier
                 header: "X-User-Tier"
               - key: user_id
                 header: "X-User-ID"
             type: tokens
   ```

3. Configure the rate limit server with tier-based budgets.

   ```yaml
   domain: token-budgets
   descriptors:
     - key: tier
       value: "free"
       descriptors:
         - key: user_id
           rate_limit:
             unit: day
             requests_per_unit: 10000  # 10K tokens/day for free tier
     - key: tier
       value: "standard"
       descriptors:
         - key: user_id
           rate_limit:
             unit: day
             requests_per_unit: 100000  # 100K tokens/day for standard tier
     - key: tier
       value: "premium"
       descriptors:
         - key: user_id
           rate_limit:
             unit: day
             requests_per_unit: 500000  # 500K tokens/day for premium tier
   ```

### Local token budget limits

Use local rate limiting instead of global for simpler setups that don't require shared state across {{< reuse "agw-docs/snippets/agentgateway.md" >}} instances.

{{< callout type="warning" >}}
Local rate limiting applies limits per {{< reuse "agw-docs/snippets/agentgateway.md" >}} instance. If you have 3 instances and set a 100,000 token limit, each instance enforces 100,000 tokens, for a total of 300,000 tokens across all instances.
{{< /callout >}}

```yaml
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: local-token-budget
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: agentgateway-proxy
  traffic:
    rateLimit:
      local:
        tokenBucket:
          maxTokens: 100000
          tokensPerFill: 100000
          fillInterval: 24h
```

## Monitor budget usage

Track how much of each user's budget has been consumed using Prometheus metrics.

1. Port-forward the agentgateway proxy metrics endpoint.
   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15020
   ```

2. Query the token usage metric filtered by user.
   ```promql
   # Total tokens consumed by user over the last 24 hours
   sum by (user_id) (
     agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input"}[24h] +
     agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output"}[24h]
   )

   # Percentage of daily budget used
   (sum by (user_id) (
     agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input"}[24h] +
     agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output"}[24h]
   ) / 100000) * 100
   ```

3. Set up alerts when users approach their budget limits.

   ```yaml
   groups:
   - name: budget_alerts
     rules:
     - alert: BudgetNearlyExhausted
       expr: |
         (sum by (user_id) (
           rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input"}[24h]) * 86400 +
           rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output"}[24h]) * 86400
         ) / 100000) > 0.8
       for: 5m
       labels:
         severity: warning
       annotations:
         summary: "User {{ $labels.user_id }} has used over 80% of their daily token budget"
   ```

## Convert budget to cost

To convert token budgets to dollar amounts, multiply by your provider's pricing.

For example, with OpenAI GPT-4:
- Input tokens: $30 per 1M tokens
- Output tokens: $60 per 1M tokens

A 100,000 token budget (assuming 50/50 input/output mix):
```
cost = (50,000 / 1,000,000 × $30) + (50,000 / 1,000,000 × $60)
     = $1.50 + $3.00
     = $4.50 per day
```

For more information on cost calculation, see the [cost tracking guide]({{< link-hextra path="/llm/cost-tracking/" >}}).

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} api-key-auth -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} daily-token-budget -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete secret user-alice-key user-bob-key -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete configmap rate-limit-config -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

## What's next

- [Track costs per request]({{< link-hextra path="/llm/cost-tracking/" >}}) to monitor actual spending
- [Manage API keys]({{< link-hextra path="/llm/api-keys/" >}}) for user authentication
- [Set up observability]({{< link-hextra path="/llm/observability/" >}}) to view token usage metrics
<!--TODO rate limiting 
[Configure rate limiting]({{< link-hextra path="/configuration/resiliency/rate-limits/" >}}) for advanced rate limit patterns
-->