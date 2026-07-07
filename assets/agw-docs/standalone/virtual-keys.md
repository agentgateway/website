Issue API keys to users or applications and control token usage (also known as virtual keys).

## About

Virtual key management allows you to issue API keys to users or applications, each with independent tracking and cost controls. Agentgateway composes existing capabilities to do this:
- API key authentication identifies incoming requests by API key.
- Token-based rate limiting enforces token budgets.
- Observability metrics track per-key spending and usage.

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

{{< version exclude-if="1.2.x,1.1.x,1.0.x" >}}

{{< callout type="info" >}}
You can manage virtual keys two ways: interactively in the built-in [Admin UI]({{< link-hextra path="/operations/ui/" >}}), or declaratively in your config file. The UI is convenient for exploring and one-off changes. The config file is the source of truth for GitOps workflows.
{{< /callout >}}

## Set up virtual keys (Admin UI)

Set up virtual keys interactively through the Admin UI.

1. Open [http://localhost:15000/ui/llm/keys](http://localhost:15000/ui/llm/keys) (**LLM > Virtual API Keys**). Configured keys and their metadata are listed here, where you can show, copy, edit, or delete each one.

   {{< reuse-image-light src="img/ui-virtual-keys-list.png" alt="Admin UI Virtual API Keys page listing configured keys and metadata" >}}
   {{< reuse-image-dark srcDark="img/ui-virtual-keys-list-dark.png" alt="Admin UI Virtual API Keys page listing configured keys and metadata" >}}

2. Click **New key**. Give the key a name, let {{< reuse "agw-docs/snippets/agentgateway.md" >}} auto-generate the key value (or paste your own), and add metadata such as a `user` entry to attribute usage. Click **Save key**.

   {{< reuse-image-light src="img/ui-virtual-keys-new.png" alt="Create virtual key drawer with name, auto-generated key value, and metadata" >}}
   {{< reuse-image-dark srcDark="img/ui-virtual-keys-new-dark.png" alt="Create virtual key drawer with name, auto-generated key value, and metadata" >}}
3. **Copy** the virtual key value. Give this key to your users to use in an `Authorization: Bearer $VIRTUAL_KEY` header in subsequent requests through agentgateway.

The rest of this guide uses the equivalent config-file settings, which apply the same `apiKey` policy shown in the UI.
{{< /version >}}

## Set up virtual keys (config file)

Set up virtual keys in a declarative config file, particularly useful in GitOps settings.

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

2. Send a prompt to the LLM. At the time the prompt is sent, the number of tokens required for the completion is unknown. Make sure to include a virtual key in the authorization header. Because `tokenize: true` is not set on the model, the prompt count is not estimated. As a result, the prompt is allowed.

   {{< callout type="info">}}
   The LLM typically returns the number of tokens required for completion in its response. Agentgateway uses this number and counts it against the rate limit.
   {{< /callout >}}

   ```sh
   curl http://localhost:4000/v1/chat/completions \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer sk-alice-abc123def456' \
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
     -H 'Authorization: Bearer sk-alice-abc123def456' \
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

For more information about rate limiting configuration options, see [Rate limits]({{< link-hextra path="/configuration/resiliency/rate-limits/" >}}).

1. Update your configuration with `tokenize: true` for your model. With this setting, requests are denied immediately if the estimated prompt token count exceeds the available budget.
   
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

2. Send a request. Use Bob's virtual key because Alice's virtual key already reached the rate limit in the previous step. This time, the request is rate limited because the estimated tokens exceed the budget.
   
   ```sh
   curl http://localhost:4000/v1/chat/completions \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer sk-bob-xyz789uvw012' \
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

## Monitor per-key spending

Agentgateway exposes token usage as Prometheus metrics on its stats endpoint, which listens on port `15020` by default (not the `15000` admin port). The `agentgateway_gen_ai_client_token_usage` metric is a histogram that records the tokens used per request.

By default, this metric is broken down by dimensions such as the model (`gen_ai_request_model`) and token type (`gen_ai_token_type`), but *not* by key. To attribute usage to each virtual key, add a `user_id` label that reads the `user` metadata from the authenticated key, then query Prometheus.

{{< callout type="info" >}}
The token usage metric only appears after a request *succeeds* and the LLM returns a usage count. Requests that are rejected (for example, a `401` from an invalid key or a `429` from the rate limit) never reach the LLM, so they do not produce token usage metrics.
{{< /callout >}}

### Add a per-key metric label

1. Update your configuration to add a `user_id` metric label. The `add` field maps a label name to a CEL expression that is evaluated per request. Use `apiKey.user` to read the `user` metadata from the authenticated key. This example builds on the previous configuration.

   ```yaml
   cat <<'EOF' > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config

   config:
     metrics:
       fields:
         add:
           user_id: apiKey.user

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
   | `config.metrics.fields.add` | A map of metric label names to CEL expressions. Each expression is evaluated per request and its result is attached as a Prometheus label on the metrics. |
   | `user_id: apiKey.user` | Adds a `user_id` label whose value is the `user` metadata from the authenticated API key. If the expression cannot be evaluated (for example, on an unauthenticated request), the label value is `unknown`. |

   {{< callout type="warning" >}}
   The `user_id` label is high cardinality: every unique value creates a new metric series, which increases Prometheus memory and storage. This is acceptable for tens or hundreds of keys, but avoid attaching unbounded identifiers at large scale. Prefer lower-cardinality dimensions like tier or team when possible.
   {{< /callout >}}

2. Restart agentgateway with the updated configuration, then send successful requests with each key so the metrics have per-key data to report. Because the earlier rate-limit budget is small, raise `maxTokens` or wait for the bucket to refill so the requests are not rejected.

3. Verify that the `user_id` label is attached to the token usage metric. Read the metrics endpoint and filter for the token usage sum.

   ```sh
   curl -s http://localhost:15020/metrics | grep gen_ai_client_token_usage_sum
   ```

   Each series now carries a `user_id` label that matches the `user` metadata of the key that made the request. For example, after sending requests with Alice's and Bob's keys:

   ```
   agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input",gen_ai_request_model="gpt-3.5-turbo",...,user_id="alice"} 21.0
   agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output",gen_ai_request_model="gpt-3.5-turbo",...,user_id="alice"} 14.0
   agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input",gen_ai_request_model="gpt-3.5-turbo",...,user_id="bob"} 9.0
   agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output",gen_ai_request_model="gpt-3.5-turbo",...,user_id="bob"} 9.0
   ```

### Query with Prometheus

The raw curl output in the previous step is a quick sanity check, but it returns only Prometheus exposition text. To run aggregations such as totals over time or estimated cost, use PromQL. PromQL runs inside a Prometheus server that scrapes the agentgateway metrics endpoint. You cannot send PromQL to the `/metrics` endpoint directly, so in standalone mode you run your own Prometheus.

1. Create a Prometheus scrape configuration that targets the agentgateway stats endpoint.

   ```yaml
   cat <<'EOF' > prometheus.yml
   global:
     scrape_interval: 5s

   scrape_configs:
   - job_name: agentgateway
     static_configs:
     - targets: ["host.docker.internal:15020"]
   EOF
   ```

   {{< callout type="info" >}}
   Use `host.docker.internal:15020` when you run Prometheus in Docker, as in the next step. If you run the Prometheus binary directly on your machine, use `localhost:15020` instead.
   {{< /callout >}}

2. Start Prometheus with this configuration.

   ```sh
   docker run --rm -p 9090:9090 \
     -v "$(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml" \
     prom/prometheus
   ```

3. Verify that Prometheus is scraping agentgateway. Open [http://localhost:9090/targets](http://localhost:9090/targets) and confirm that the `agentgateway` target is **UP**.

4. Query token usage per key. Open the [Prometheus expression browser](http://localhost:9090/graph) and run a PromQL query, or send the query to the Prometheus HTTP API with curl.

   ```sh
   curl -s http://localhost:9090/api/v1/query \
     --data-urlencode 'query=sum by (user_id) (agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input"} + agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output"})' \
     | jq .
   ```

   This returns the total tokens consumed by each virtual key.

5. Estimate costs by multiplying token counts by your provider's pricing. For example, with OpenAI GPT-3.5:

   ```promql
   # Estimated cost per key (assuming $0.50 per 1M input tokens, $1.50 per 1M output tokens)
   sum by (user_id) (
     ((agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input"} / 1000000) * 0.50) +
     ((agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output"} / 1000000) * 1.50)
   )
   ```

   {{< callout type="info" >}}
   Queries that use `rate()` or `increase()` over a range such as `[24h]` need that much scrape history to return meaningful values. While testing locally, query the raw `_sum` counters or use a shorter range such as `[5m]`.

   This query *estimates* cost by applying your own pricing to token counts. To have agentgateway compute the *realized* USD cost per request from a model cost catalog, see [Model costs]({{< link-hextra path="/llm/cost-controls/costs/" >}}).
   {{< /callout >}}

## What's next

- [Model costs]({{< link-hextra path="/llm/cost-controls/costs/" >}}) to price requests with a model cost catalog and expose realized USD costs
- [LLM providers]({{< link-hextra path="/llm/providers/" >}}) for provider-specific authentication configuration
- [Rate limits]({{< link-hextra path="/configuration/resiliency/rate-limits/" >}}) for advanced rate limiting configuration
- [Set up observability]({{< link-hextra path="/llm/observability/" >}}) to view token usage metrics and logs
