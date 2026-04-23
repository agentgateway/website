Issue API keys to users or applications and control token usage (also known as virtual keys).

## About

Virtual key management allows you to issue API keys to users or applications, each with independent tracking and cost controls. Agentgateway achieves this by composing existing capabilities:
- **API key authentication**: Identify incoming requests by API key
- **Token-based rate limiting**: Enforce token budgets
- **Observability metrics**: Track per-key spending and usage

### How virtual keys work

```mermaid
flowchart TD
  A[Request arrives with API key] --> B[Validate API key]
  B --> C{Key valid?}
  C -->|Yes| D[Check token budget]
  D --> E{Budget available?}
  E -->|Yes| F[Forward to LLM]
  F --> G[Track token usage]
  G --> H[Deduct from budget]
  E -->|No| I[Reject with 429]
  C -->|No| J[Reject with 401]
  subgraph refill["Budget refills periodically"]
    H
  end
```

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

{{< doc-test paths="virtual-keys" >}}
# Install agentgateway binary
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/n-patch.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"
{{< /doc-test >}}

## Set up virtual keys

### Step 1: Configure API key authentication

Create a configuration with API key authentication. This example creates two virtual keys for Alice and Bob.

```yaml {paths="virtual-keys"}
cat <<'EOF' > config.yaml
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
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
EOF
```

| Setting | Description |
| -- | -- |
| `apiKey.mode` | Set to `strict` to require a valid API key for all requests. Use `optional` to allow unauthenticated requests. |
| `apiKey.keys` | List of API keys. Each key has a `key` value and optional `metadata`. |
| `key` | The API key value that users include in the `Authorization: Bearer <key>` header. |
| `metadata` | Optional metadata associated with the key, such as a user identifier or tier. |

### Step 2: Start agentgateway

```sh
agentgateway -f config.yaml
```

{{< doc-test paths="virtual-keys" >}}
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3
{{< /doc-test >}}

### Step 3: Test the virtual keys

1. Send a request with Alice's API key. Verify that the request succeeds.

   ```sh {paths="virtual-keys"}
   curl -s http://localhost:4000/v1/chat/completions \
     -H "Authorization: Bearer sk-alice-abc123def456" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [{"role": "user", "content": "Hello!"}]
     }' | jq .
   ```

   Example successful response:
   ```json
   {
     "choices": [{
       "message": {
         "role": "assistant",
         "content": "Hello! How can I help you today?"
       }
     }],
     "usage": {
       "prompt_tokens": 10,
       "completion_tokens": 9,
       "total_tokens": 19
     }
   }
   ```

2. Send a request without a valid API key. Verify that the request is rejected with a 401 status.

   ```sh {paths="virtual-keys"}
   curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/v1/chat/completions \
     -H "Authorization: Bearer invalid-key" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [{"role": "user", "content": "Hello!"}]
     }'
   ```

   Expected response:
   ```
   HTTP/1.1 401 Unauthorized
   ```

{{< doc-test paths="virtual-keys" >}}
YAMLTest -f - <<'EOF'
- name: request with valid API key succeeds
  http:
    url: "http://localhost:4000"
    path: /v1/chat/completions
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer sk-alice-abc123def456"
    body: |
      {
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": "Hello!"}]
      }
  source:
    type: local
  expect:
    statusCode: 200

- name: request with invalid API key is rejected
  http:
    url: "http://localhost:4000"
    path: /v1/chat/completions
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer invalid-key"
    body: |
      {
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": "Hello!"}]
      }
  source:
    type: local
  expect:
    statusCode: 401

- name: request with Bob's key also succeeds independently
  http:
    url: "http://localhost:4000"
    path: /v1/chat/completions
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer sk-bob-xyz789uvw012"
    body: |
      {
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": "Hello!"}]
      }
  source:
    type: local
  expect:
    statusCode: 200
EOF
{{< /doc-test >}}

## Add a global token budget

To add a token budget that limits total token usage across all keys, use the routing-based configuration format with `localRateLimit`. Local rate limits apply to the gateway as a whole, not per key.

{{< callout type="info" >}}
Rate limiting requires the `binds/listeners/routes` configuration format because `localRateLimit` is an HTTP-level policy. For more information, see the [Routing-based configuration guide]({{< link-hextra path="/llm/configuration-modes/" >}}).
{{< /callout >}}

```yaml
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

binds:
- port: 4000
  listeners:
  - routes:
    - backends:
      - ai:
          name: openai
          provider:
            openAI:
              model: gpt-3.5-turbo
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
        backendAuth:
          key: "$OPENAI_API_KEY"
        localRateLimit:
        - maxTokens: 100000
          tokensPerFill: 100000
          fillInterval: 86400s
          type: tokens
EOF
```

| Setting | Description |
| -- | -- |
| `localRateLimit` | Token-based rate limiting applied to all requests through this route. |
| `maxTokens` | The maximum number of tokens available in the budget. |
| `tokensPerFill` | The number of tokens added during each refill. |
| `fillInterval` | The interval between refills. Use `86400s` for a daily budget. |
| `type` | Set to `tokens` for token-based limits. Use `requests` for request-based limits. |

For more details on rate limiting, see [Control spend]({{< link-hextra path="/llm/spending/" >}}).

## Monitor per-key spending

Track token usage and spending for each virtual key using Prometheus metrics exposed by agentgateway.

1. Access the agentgateway metrics endpoint.
   ```sh
   curl http://localhost:15000/metrics
   ```

2. Query token usage metrics.
   ```promql
   # Total tokens consumed over the last 24 hours
   sum(
     increase(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input"}[24h]) +
     increase(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output"}[24h])
   )
   ```

3. Calculate costs by multiplying token counts by your provider's pricing. For example, with OpenAI GPT-3.5:
   ```promql
   # Estimated cost (assuming $0.50 per 1M input tokens, $1.50 per 1M output tokens)
   sum(
     ((rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input"}[24h]) / 1000000) * 0.50) +
     ((rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output"}[24h]) / 1000000) * 1.50)
   )
   ```

For more information on cost tracking, see the [Control spend guide]({{< link-hextra path="/llm/spending/" >}}).

## What's next

- [Manage API keys]({{< link-hextra path="/llm/api-keys/" >}}) for detailed authentication configuration
- [Control spend]({{< link-hextra path="/llm/spending/" >}}) for token-based rate limiting
- [Set up observability]({{< link-hextra path="/llm/observability/" >}}) to view token usage metrics and logs
