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

This example creates two virtual keys (for Alice and Bob) with independent daily token budgets. The budget is deliberately small (100 tokens per day) so that you can exhaust it in a few requests and see the enforcement in action. For production-sized budgets, see [Advanced configuration](#advanced-configuration).

### Create API keys for users

Create an API key secret that stores keys and metadata for each user.

```yaml,paths="virtual-keys"
kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: llm-api-keys
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
type: Opaque
stringData:
  alice: |
    {
      "key": "sk-alice-abc123def456",
      "metadata": {
        "user_id": "alice"
      }
    }
  bob: |
    {
      "key": "sk-bob-xyz789uvw012",
      "metadata": {
        "user_id": "bob"
      }
    }
EOF
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting     | Description |
|-------------|-------------|
| `stringData.<name>` | Each key in `stringData` represents a user. The value is a JSON object containing the API key and metadata. |
| `key` | The API key value that users include in their `Authorization: Bearer` header. |
| `metadata.user_id` | The user identifier extracted by rate limiting policies to enforce per-user budgets. |

### Configure API key authentication

Create a {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that requires API key authentication for all requests to the gateway.

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
      secretRef:
        name: llm-api-keys
EOF
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting     | Description |
|-------------|-------------|
| `targetRefs` | Apply the policy to the entire Gateway so all routes require API keys. |
| `apiKeyAuthentication.mode` | Set to `Strict` to require a valid API key for all requests. |
| `secretRef.name` | References the Secret containing API keys and user metadata. |

### Configure per-key token budgets

Create a {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that sends a per-user token cost to the rate limit server. The policy extracts the `user_id` from each API key and reports the token usage of each response under that descriptor. The rate limit server holds the actual budget (100 tokens per day per user, which you deploy in the next step).

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
        domain: agentgateway
        backendRef:
          kind: Service
          name: ratelimit
          namespace: ratelimit
          port: 8081
        descriptors:
          - entries:
              - name: user_id
                expression: 'apiKey.user_id'
            unit: Tokens
EOF
```

{{< doc-test paths="virtual-keys-with-ratelimit" >}}
YAMLTest -f - <<'EOF'
- name: wait for daily-token-budget policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: agentgateway-system
        name: daily-token-budget
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
EOF
{{< /doc-test >}}

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting     | Description |
|-------------|-------------|
| `rateLimit.global` | Use global rate limiting to enforce limits across all {{< reuse "agw-docs/snippets/agentgateway.md" >}} instances. |
| `domain` | The rate limit domain. Must match the `domain` in the rate limit server configuration (`agentgateway`). |
| `backendRef` | References the rate limit server Service. Must include `kind`, `name`, `namespace`, and `port`. This example points at the `ratelimit` Service in the `ratelimit` namespace that you deploy in the next step. |
| `descriptors[].entries[].name` | The name of the descriptor entry. Must match a `key` in the rate limit server config. Set to `user_id` to rate limit per user. |
| `descriptors[].entries[].expression` | CEL expression to extract the user ID from the API key's metadata. |
| `descriptors[].unit` | Set to `Tokens` so the gateway reports each response's token count as the cost. The rate limit server subtracts that cost from the user's budget. |

### Deploy the rate limit server

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
The following steps verify API key authentication, routing, and per-key token budget enforcement. Budget enforcement requires the rate limit server from the [previous step](#deploy-the-rate-limit-server).
{{< /callout >}}

{{< doc-test paths="virtual-keys-openai-test" >}}
# Test virtual key authentication and routing against the OpenAI route
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
    url: "http://${INGRESS_GW_ADDRESS}:80/openai"
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer sk-alice-abc123def456"
    body: |
      {
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": "Hello"}]
      }
  source:
    type: local
  expect:
    statusCode: 200

- name: verify request with Bob's virtual key succeeds independently
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/openai"
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer sk-bob-xyz789uvw012"
    body: |
      {
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": "Hello"}]
      }
  source:
    type: local
  expect:
    statusCode: 200

- name: verify request without valid API key is rejected
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/openai"
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer invalid-key"
    body: |
      {
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": "Hello"}]
      }
  source:
    type: local
  expect:
    statusCode: 401
EOF
{{< /doc-test >}}

{{< doc-test paths="virtual-keys-httpbun-test" >}}
# Test virtual key authentication and routing against the httpbun route
YAMLTest -f - <<'EOF'
- name: wait for HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        name: httpbun-llm
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
    body: |
      {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Hello"}],
        "httpbun": {"content": "Hello from httpbun"}
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
    body: |
      {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Hello"}],
        "httpbun": {"content": "Hello from httpbun"}
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

{{< doc-test paths="virtual-keys-ratelimit-test" >}}
# Drain Alice's 100-token daily budget. httpbun returns ~20-30 tokens per response,
# so a handful of requests pushes Alice over the budget.
for i in $(seq 1 10); do
  curl -s -o /dev/null \
    "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer sk-alice-abc123def456" \
    -d '{"model":"gpt-4","messages":[{"role":"user","content":"Say hello"}]}'
  sleep 0.3
done

YAMLTest -f - <<'EOF'
- name: Alice is rejected with 429 after exhausting her token budget
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions"
    method: POST
    headers:
      Content-Type: application/json
      Authorization: "Bearer sk-alice-abc123def456"
    body: |
      {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Say hello"}]
      }
  source:
    type: local
  retries: 3
  expect:
    statusCode: 429
- name: Bob still succeeds because he has an independent budget
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions"
    method: POST
    headers:
      Content-Type: application/json
      Authorization: "Bearer sk-bob-xyz789uvw012"
    body: |
      {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Say hello"}]
      }
  source:
    type: local
  expect:
    statusCode: 200
EOF
{{< /doc-test >}}

1. Send a request with Alice's API key. Verify that the request succeeds.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "$INGRESS_GW_ADDRESS/openai" \
     -H "Authorization: Bearer sk-alice-abc123def456" \
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

2. Send several more requests with Alice's API key until her 100-token daily budget is exhausted. Because httpbun returns roughly 20-30 tokens per response, a handful of requests pushes Alice over the budget. The request that crosses the budget still completes; subsequent requests are rejected with a 429 status code.

   ```sh
   for i in $(seq 1 10); do
     STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
       "$INGRESS_GW_ADDRESS/openai" \
       -H "Authorization: Bearer sk-alice-abc123def456" \
       -H "Content-Type: application/json" \
       -d '{"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "Hello!"}]}')
     echo "Request $i: HTTP $STATUS"
   done
   ```

   Example 429 response:
   ```
   HTTP/1.1 429 Too Many Requests
   x-ratelimit-limit: 100
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

1. Add tier metadata to each API key in the Secret.

   ```yaml
   apiVersion: v1
   kind: Secret
   metadata:
     name: llm-api-keys
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     alice: |
       {
         "key": "sk-alice-abc123def456",
         "metadata": {
           "user_id": "alice",
           "tier": "premium"
         }
       }
     charlie: |
       {
         "key": "sk-charlie-ghi345jkl678",
         "metadata": {
           "user_id": "charlie",
           "tier": "free"
         }
       }
   ```

2. Configure rate limiting to use the tier and user_id from API key metadata.

   ```yaml
   traffic:
     rateLimit:
       global:
         domain: agentgateway
         backendRef:
           kind: Service
           name: ratelimit
           namespace: ratelimit
           port: 8081
         descriptors:
           - entries:
               - name: tier
                 expression: 'apiKey.tier'
               - name: user_id
                 expression: 'apiKey.user_id'
             unit: Tokens
   ```

3. Configure the rate limit server with tier-based budgets.

   ```yaml
   domain: agentgateway
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
# In the ratelimit-config ConfigMap
domain: agentgateway
descriptors:
  - key: user_id
    rate_limit:
      unit: hour
      requests_per_unit: 10000  # 10,000 tokens per hour
```

### Multi-tenant virtual keys

Create virtual keys scoped to both user and tenant for multi-tenant applications. Add tenant_id to the API key metadata.

```yaml
# In TrafficPolicy
descriptors:
  - entries:
      - name: tenant_id
        expression: 'apiKey.tenant_id'
      - name: user_id
        expression: 'apiKey.user_id'
    unit: Tokens
```

```yaml
# In the ratelimit-config ConfigMap
domain: agentgateway
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
kubectl delete secret llm-api-keys -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete httproute openai -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} openai -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

To remove the rate limit server, follow the [cleanup steps]({{< link-hextra path="/security/rate-limit-global#cleanup" >}}) in the global rate limiting guide.

## What's next

- [Manage API keys]({{< link-hextra path="/llm/api-keys/" >}}) for detailed authentication configuration
- [Budget and spend limits]({{< link-hextra path="/llm/budget-limits/" >}}) for advanced rate limiting patterns
- [Track costs per request]({{< link-hextra path="/llm/cost-tracking/" >}}) for cost calculation and monitoring
- [Set up observability]({{< link-hextra path="/llm/observability/" >}}) to view token usage metrics and logs
