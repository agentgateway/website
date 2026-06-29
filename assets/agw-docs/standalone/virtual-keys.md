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

## Configure token budgets

LLMs typically charge per input and output token. Without spending control, users can quickly generate large bills by submitting long prompts, streaming or retrying requests, or running recursive agent loops. To protect against unexpected bills, scaling surprises, and abuse, use token-based rate limits to cap the number of tokens that can be used.

{{< callout type="warning" >}}
`localRateLimit` is a **gateway-wide** limit, not a per-key limit. It enforces a single shared token budget across **all** requests and API keys.
{{< /callout >}}

### How rate limiting works

Agentgateway checks token-based rate limits in two phases:

**At request time:**

{{< reuse "agw-docs/snippets/ratelimit-requesttime.md" >}}

**At response time:**

{{< reuse "agw-docs/snippets/ratelimit-responsetime.md" >}}

### Step 1: Add a token budget

Update your configuration to include a `localRateLimit` policy. The following example builds on the virtual keys configuration from the previous section and adds a token budget.

```yaml
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
    localRateLimit:
    - maxTokens: 10
      tokensPerFill: 1
      fillInterval: 60s
      type: tokens
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
EOF
```

| Setting | Description |
| -- | -- |
| `localRateLimit` | Applies a token-based rate limit to all incoming LLM requests. |
| `maxTokens` | The maximum number of tokens that are available to use. |
| `tokensPerFill` | The number of tokens that are added during a refill. |
| `fillInterval` | The number of seconds after which the token bucket is refilled. |
| `type` | The type of rate limiting to apply. Use `tokens` for token-based rate limiting, or `requests` for request-based rate limiting. |

### Step 2: Verify rate limits

1. Start agentgateway with the updated configuration.
   ```sh
   agentgateway -f config.yaml
   ```

2. Send a prompt to the LLM. At the time the prompt is sent, the number of tokens required for the completion is unknown. Because `tokenize: true` is not set on the model, the prompt count is not estimated. As a result, the prompt is allowed.

   {{< callout type="info">}}
   The LLM typically returns the number of tokens required for completion in its response. Agentgateway uses this number and counts it against the rate limit.
   {{< /callout >}}

   ```sh
   curl http://localhost:4000/v1/chat/completions \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [
         {
           "role": "user",
           "content": "Tell me a short story"
         }
       ]
     }'
   ```

   Example output:
   ```json
   {
     "choices": [
       {
         "message": {
           "content": "Once upon a time, in a small village nestled between towering mountains...",
           "role": "assistant"
         },
         "finish_reason": "stop"
       }
     ],
     "usage": {
       "prompt_tokens": 12,
       "completion_tokens": 248,
       "total_tokens": 260
     }
   }
   ```

3. Repeat the same request. This time, the request is rate limited because the tokens used in the first request exceeded the budget.
   ```sh
   curl http://localhost:4000/v1/chat/completions \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [
         {
           "role": "user",
           "content": "Tell me a short story"
         }
       ]
     }'
   ```

   Example output:
   ```
   rate limit exceeded
   ```

### Step 3: Enable request-time token estimation

By default, agentgateway does not estimate token counts at request time. To reject requests before they reach the LLM, set `tokenize: true` on your model.

```yaml
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
    localRateLimit:
    - maxTokens: 10
      tokensPerFill: 1
      fillInterval: 60s
      type: tokens
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
      tokenize: true
EOF
```

With this setting, requests are denied immediately if the estimated prompt token count exceeds the available budget.

For more information about rate limiting configuration options, see [Rate limits]({{< link-hextra path="/configuration/resiliency/rate-limits/" >}}).

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

   {{< callout type="info" >}}
   This query *estimates* cost by applying your own pricing to token counts. To have agentgateway compute the *realized* USD cost per request from a model cost catalog, see [Model costs]({{< link-hextra path="/llm/costs/" >}}).
   {{< /callout >}}

## What's next

- [Model costs]({{< link-hextra path="/llm/costs/" >}}) to price requests with a model cost catalog and expose realized USD costs
- [LLM providers]({{< link-hextra path="/llm/providers/" >}}) for provider-specific authentication configuration
- [Rate limits]({{< link-hextra path="/configuration/resiliency/rate-limits/" >}}) for advanced rate limiting configuration
- [Set up observability]({{< link-hextra path="/llm/observability/" >}}) to view token usage metrics and logs
