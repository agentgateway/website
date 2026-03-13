Issue API keys with per-key token budgets and cost tracking (also known as virtual keys).

## About

Virtual key management is a common feature in AI gateway solutions that allows you to issue API keys to users or applications, each with independent token budgets and cost tracking. Competitors like LiteLLM and Portkey offer this as a single "virtual keys" abstraction.

{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} achieves the same outcome by composing three existing capabilities:
- **API key authentication**: Identify incoming requests by API key
- **Token-based rate limiting**: Enforce per-key token budgets
- **Observability metrics**: Track per-key spending and usage

This composable approach gives you more flexibility in how you configure and apply virtual key management policies, while maintaining compatibility with standard Kubernetes patterns.

### How virtual keys work

Virtual keys combine authentication, rate limiting, and observability to create isolated token budgets for each API key:

```mermaid
flowchart TD
  A[Request arrives with API key] --> B[Validate API key]
  B --> C[Extract user ID]
  C --> D[Check user's token budget]
  D --> E{Budget available?}
  E -->|Yes| F[Forward to LLM]
  F --> G[Track token usage]
  G --> H[Deduct from budget]
  E -->|No| I[Reject with 429]
  subgraph refill["Budget refills periodically"]
    H
  end
```

When a request arrives:
1. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} validates the API key
2. The user ID is extracted from a request header
3. The request is checked against the user's token budget
4. If budget is available, the request proceeds to the LLM
5. Token usage is tracked and deducted from the user's budget
6. If budget is exhausted, the request is rejected with a 429 status code
7. Budgets refill at the configured interval (daily, hourly, etc.)

### More considerations

**Evaluation order**: Rate limiting is evaluated *before* prompt guards (content safety checks). This means that requests rejected by guardrails (403 Forbidden) still consume quota from the user's token budget. In contrast, authentication (JWT/OPA) is evaluated before rate limiting, so unauthenticated requests do not consume quota.

**Multiple policies**: When multiple {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resources target the same Gateway or HTTPRoute with overlapping `backend.ai` fields, one policy silently overwrites the other based on creation order. Both policies will show `ACCEPTED/ATTACHED` status. To avoid conflicts, use separate policies for different configuration areas (such as one for authentication, one for rate limiting, one for prompt guards).

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

## Set up virtual keys

This example creates two virtual keys (for Alice and Bob) with independent 100,000 token daily budgets.

### Create API keys for users

Create API key secrets for each user. Each secret includes a label that references the key group for authentication.

```yaml,paths="virtual-keys"
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

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting     | Description |
|-------------|-------------|
| `type` | Set to `extauth.solo.io/apikey` to create API key secrets. |
| `labels.api-key-group` | Label to group API keys together for authentication policy selection. |
| `stringData.api-key` | The API key value that users include in their requests. |

### Configure API key authentication

Create a {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that requires API key authentication for all requests to the gateway. The policy extracts the user ID from the `X-User-ID` header for use in rate limiting.

```yaml,paths="virtual-keys"
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
EOF
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting     | Description |
|-------------|-------------|
| `targetRefs` | Apply the policy to the entire Gateway so all routes require API keys. |
| `apiKeyAuthentication.mode` | Set to `Strict` to require a valid API key for all requests. |
| `secretSelector` | Use label selectors to reference all API key secrets with the `api-key-group: llm-users` label. |

### Configure per-key token budgets

Create a {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that enforces a daily token budget of 100,000 tokens per user.

```yaml,paths="virtual-keys-with-ratelimit"
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
        backendRef:
          kind: Service
          name: rate-limit-server
          namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
          port: 8081
        descriptors:
          - entries:
              - name: user_id
                expression: 'request.headers["x-user-id"]'
            unit: Tokens
EOF
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting     | Description |
|-------------|-------------|
| `rateLimit.global` | Use global rate limiting to enforce limits across all {{< reuse "agw-docs/snippets/agentgateway.md" >}} instances. |
| `domain` | A namespace for rate limit configurations. Use `token-budgets` to organize your budget policies. |
| `backendRef` | References the rate limit server Service. Must include `kind`, `name`, `namespace`, and `port`. |
| `descriptors[].entries[].name` | The name of the descriptor entry. Set to `user_id` to rate limit per user. |
| `descriptors[].entries[].expression` | CEL expression to extract the user ID from the `X-User-ID` request header. |
| `descriptors[].unit` | Set to `Tokens` to enforce token-based limits instead of request-based limits. |

### Configure the rate limit server

Deploy a rate limit server and configure it with your budget limits. This guide uses global rate limiting to enforce per-key token budgets across multiple gateway instances. For more information, see the [global rate limiting section]({{< link-hextra path="/llm/rate-limit/#global" >}}) in the LLM rate limiting guide.

1. Deploy the rate limit server. For setup instructions, see the [global rate limiting section]({{< link-hextra path="/llm/rate-limit/#global" >}}) in the LLM rate limiting guide.

2. Create a ConfigMap with your budget configuration.

   ```yaml,paths="virtual-keys-with-ratelimit"
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

### Set up an LLM backend

Create an {{< reuse "agw-docs/snippets/backend.md" >}} that connects to your LLM provider.

```yaml,paths="virtual-keys"
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: openai
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      openai:
        model: gpt-3.5-turbo
  policies:
    auth:
      secretRef:
        name: openai-secret
EOF
```

For detailed instructions on creating backends and storing provider API keys, see the [API keys guide]({{< link-hextra path="/llm/api-keys/" >}}).

### Create a route to the backend

Create an HTTPRoute that routes requests to your LLM backend.

```yaml,paths="virtual-keys"
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: openai
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /openai
      backendRefs:
        - name: openai
          namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
          group: agentgateway.dev
          kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
```

### Test the virtual keys

{{< callout type="info" >}}
The following tests verify API key authentication and routing. For full end-to-end testing of per-key token budget enforcement, deploy a rate limit server as described in the [global rate limiting section]({{< link-hextra path="/llm/rate-limit/#global" >}}).
{{< /callout >}}

{{< doc-test paths="virtual-keys" >}}
# Test virtual key authentication and routing (rate limit server deployment required for full budget enforcement tests)
YAMLTest -f - <<'EOF'
- name: wait for HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        name: openai
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 2

- name: verify request with Alice's virtual key succeeds
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions"
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer sk-alice-abc123def456"
      X-User-ID: alice
    body: |
      {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Hello"}]
      }
  source:
    type: local
  expect:
    statusCode: 200

- name: verify request with Bob's virtual key succeeds independently
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions"
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer sk-bob-xyz789uvw012"
      X-User-ID: bob
    body: |
      {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Hello"}]
      }
  source:
    type: local
  expect:
    statusCode: 200

- name: verify request without valid API key is rejected
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions"
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer invalid-key"
      X-User-ID: charlie
    body: |
      {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Hello"}]
      }
  source:
    type: local
  expect:
    statusCode: 401
EOF
{{< /doc-test >}}

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

   Example successful response:
   ```json
   {
     "id": "chatcmpl-abc123",
     "object": "chat.completion",
     "created": 1234567890,
     "model": "gpt-3.5-turbo",
     "choices": [{
       "index": 0,
       "message": {
         "role": "assistant",
         "content": "Hello! How can I help you today?"
       },
       "finish_reason": "stop"
     }],
     "usage": {
       "prompt_tokens": 10,
       "completion_tokens": 9,
       "total_tokens": 19
     }
   }
   ```

2. Send multiple requests until Alice's 100,000 token budget is exhausted. Verify that subsequent requests are rejected with a 429 status code.

   Example 429 response:
   ```
   HTTP/1.1 429 Too Many Requests
   x-ratelimit-limit: 100000
   x-ratelimit-remaining: 0
   x-ratelimit-reset: 43200

   rate limit exceeded
   ```

3. Verify that Bob can still send requests with his own budget, independent of Alice's usage.

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

   Bob's requests succeed because he has his own independent budget.

## Monitor per-key spending

Track token usage and spending for each virtual key using Prometheus metrics.

1. Port-forward the agentgateway proxy metrics endpoint.
   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15020
   ```

2. Query token usage metrics filtered by user ID.
   ```promql
   # Total tokens consumed by user over the last 24 hours
   sum by (user_id) (
     increase(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input"}[24h]) +
     increase(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output"}[24h])
   )

   # Percentage of daily budget used
   (sum by (user_id) (
     increase(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input"}[24h]) +
     increase(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output"}[24h])
   ) / 100000) * 100
   ```

3. Calculate costs per user by multiplying token counts by your provider's pricing. For example, with OpenAI GPT-3.5:
   ```promql
   # Cost per user (assuming $0.50 per 1M input tokens, $1.50 per 1M output tokens)
   sum by (user_id) (
     ((rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input"}[24h]) / 1000000) * 0.50) +
     ((rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output"}[24h]) / 1000000) * 1.50)
   )
   ```

For more information on cost tracking, see the [cost tracking guide]({{< link-hextra path="/llm/cost-tracking/" >}}).

## Advanced configuration

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

2. Configure rate limiting to use the tier from a header.

   ```yaml
   traffic:
     rateLimit:
       global:
         domain: token-budgets
         backendRef:
           kind: Service
           name: rate-limit-server
           namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
           port: 8081
         descriptors:
           - entries:
               - name: tier
                 expression: 'request.headers["x-user-tier"]'
               - name: user_id
                 expression: 'request.headers["x-user-id"]'
             unit: Tokens
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

### Multi-tenant virtual keys

Create virtual keys scoped to both user and tenant for multi-tenant applications.

```yaml
# In TrafficPolicy
descriptors:
  - entries:
      - name: tenant_id
        expression: 'request.headers["x-tenant-id"]'
      - name: user_id
        expression: 'request.headers["x-user-id"]'
    unit: Tokens
```

```yaml
# In rate-limit-config ConfigMap
domain: token-budgets
descriptors:
  - key: tenant_id
    descriptors:
      - key: user_id
        rate_limit:
          unit: day
          requests_per_unit: 50000
```

For more advanced rate limiting patterns, see the [budget and spend limits guide]({{< link-hextra path="/llm/budget-limits/" >}}).

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} api-key-auth daily-token-budget -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete secret user-alice-key user-bob-key -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete configmap rate-limit-config -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete httproute openai -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} openai -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

## What's next

- [Manage API keys]({{< link-hextra path="/llm/api-keys/" >}}) for detailed authentication configuration
- [Budget and spend limits]({{< link-hextra path="/llm/budget-limits/" >}}) for advanced rate limiting patterns
- [Track costs per request]({{< link-hextra path="/llm/cost-tracking/" >}}) for cost calculation and monitoring
- [Set up observability]({{< link-hextra path="/llm/observability/" >}}) to view token usage metrics and logs
