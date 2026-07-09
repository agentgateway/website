---
title: Optimize cost
weight: 70
description: Reduce LLM spend by routing to cheaper models and caching repeated prompt content.
test:
  optimize:
  - file: content/docs/standalone/main/llm/cost-controls/optimize.md
    path: optimize
---

The other cost controls help you *attribute*, *observe*, and *enforce* spend. This guide helps you *reduce* it, with two levers:

- **Route to cheaper models**: send each request to the cheapest model that meets its quality bar, without changing client code.
- **Cache repeated prompt content**: avoid paying full input-token price for the same system prompt or context on every request.

Pair both with a [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}) so that you can measure the realized savings in logs, metrics, and traces.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

This guide sends live requests to OpenAI, so set your API key as an environment variable.

```sh
export OPENAI_API_KEY=<your-api-key>
```

{{< doc-test paths="optimize" >}}
# Install agentgateway binary
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/n-patch.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"
export OPENAI_API_KEY="${OPENAI_API_KEY:-test}"
{{< /doc-test >}}

## Route to cheaper models

Model prices vary by one to two orders of magnitude, and a request that a small model can answer well does not need a frontier model. With a [virtual model]({{< link-hextra path="/llm/virtual-models/" >}}), clients call one stable model name and agentgateway decides which upstream model actually serves each request. You can:

- Send routine traffic to a cheaper model and reserve expensive models for requests that need them.
- A/B test a cheaper model against your current one before you commit.
- Fall back to a cheaper or alternate model when your primary is unavailable.

The following walkthrough uses conditional routing, the most direct cost lever. For the full routing reference, see [Virtual models]({{< link-hextra path="/llm/virtual-models/" >}}).

### Route by request tier with conditional routing

In this walkthrough, you publish one client-facing model named `assistant` and route premium callers to a frontier model (`gpt-4o`) while everyone else falls through to a cheaper model (`gpt-4o-mini`). Because most traffic takes the cheap path, this cuts spend without changing what clients request.

1. Create a configuration with two internal models and a virtual model that routes between them. The `visibility: internal` setting means clients cannot call `cheap` or `frontier` directly; they request only `assistant`. The `frontier` target uses a `when` expression, and the `cheap` target is the fallback, so it has no `when` and must be listed last.

   ```yaml {paths="optimize"}
   cat <<'EOF' > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: cheap
       visibility: internal
       provider: openAI
       params:
         model: gpt-4o-mini
         apiKey: "$OPENAI_API_KEY"
     - name: frontier
       visibility: internal
       provider: openAI
       params:
         model: gpt-4o
         apiKey: "$OPENAI_API_KEY"

     virtualModels:
     - name: assistant
       routing:
         conditional:
           targets:
           - model: frontier
             when: request.headers["x-tier"] == "premium"
           - model: cheap   # fallback: no "when", and must be listed last
   EOF
   ```

2. Start agentgateway with the configuration.

   ```sh
   agentgateway -f config.yaml
   ```

   {{< doc-test paths="optimize" >}}
   agentgateway -f config.yaml &
   AGW_PID=$!
   trap 'kill $AGW_PID 2>/dev/null' EXIT
   sleep 4
   {{< /doc-test >}}

3. Send a request as a premium caller by including the `x-tier: premium` header. In the response, the `model` field shows that the frontier model served the request.

   ```sh {paths="optimize"}
   curl -s http://localhost:4000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "x-tier: premium" \
     -d '{
       "model": "assistant",
       "messages": [{"role": "user", "content": "Hello!"}]
     }' | jq '.model'
   ```

   Example output:

   ```console
   "gpt-4o-2024-08-06"
   ```

4. Send the same request without the `x-tier` header. This time the response is served by the cheaper model. This is the savings: routine traffic never reaches the pricier model, and clients did not change what they requested.

   ```sh {paths="optimize"}
   curl -s http://localhost:4000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "assistant",
       "messages": [{"role": "user", "content": "Hello!"}]
     }' | jq '.model'
   ```

   Example output:

   ```console
   "gpt-4o-mini-2024-07-18"
   ```

{{< doc-test paths="optimize" >}}
premium=$(curl -s http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" -H "x-tier: premium" \
  -d '{"model":"assistant","messages":[{"role":"user","content":"Hello!"}]}' \
  | jq -r '.model')
routine=$(curl -s http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"assistant","messages":[{"role":"user","content":"Hello!"}]}' \
  | jq -r '.model')
echo "premium=$premium routine=$routine"
if echo "$premium" | grep -q "gpt-4o" && ! echo "$premium" | grep -q "mini" && echo "$routine" | grep -q "mini"; then
  echo "PASS: premium routed to frontier, routine routed to the cheaper model"
else
  echo "FAIL: routing did not match expectations"
  exit 1
fi
{{< /doc-test >}}

Because `when` is evaluated at request time, it can reference `request.headers`, `request.body` (via `json(request.body)`), `jwt`, and `apiKey` metadata. It cannot reference `llm.cost`, which is only known after the response.

### A/B test a cheaper model with weighted routing

Use `routing.weighted` to split traffic across targets by percentage. Send a small share of traffic to a cheaper model, compare quality and realized cost, then shift the weights as confidence grows.

```yaml
llm:
  models:
  - name: current
    visibility: internal
    provider: openAI
    params:
      model: gpt-4o
      apiKey: "$OPENAI_API_KEY"
  - name: candidate
    visibility: internal
    provider: openAI
    params:
      model: gpt-4o-mini
      apiKey: "$OPENAI_API_KEY"

  virtualModels:
  - name: assistant
    routing:
      weighted:
        targets:
        - model: current
          weight: 90
        - model: candidate
          weight: 10
```

Weighted routing splits traffic probabilistically, so you verify it over volume rather than per request. Send a batch of requests to `assistant`, then, with a [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}) configured, group your cost metrics by `gen_ai_response_model` to compare the realized USD cost and quality of `current` versus `candidate` before you raise the candidate's weight.

### Keep serving during outages with failover routing

Use `routing.failover` with `priority` to define ordered backups. Beyond resilience, failover lets you keep serving, often from a cheaper alternate, when your primary provider is rate limited or down, instead of failing the request. For the full failover example and how to verify it, see [Failover routing]({{< link-hextra path="/llm/virtual-models/#failover-routing" >}}).

## Cache repeated prompt content

When requests share a large, stable prefix (a long system prompt, tool definitions, or retrieved context), prompt caching lets the provider reuse that work instead of reprocessing it every time. Cached input tokens are billed at a much lower rate than fresh input tokens, so caching cuts cost for repetitive workloads such as agents and chat sessions.

{{< callout type="warning" >}}
Prompt caching is currently applied for **Amazon Bedrock** models that support it (Claude 3 and later, and Amazon Nova). It is not applied for the direct Anthropic or OpenAI providers.
{{< /callout >}}

Enable caching per model with `promptCaching`. When enabled, agentgateway automatically inserts cache markers into the request, so you do not change client payloads.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: claude-bedrock
    provider: bedrock
    params:
      model: anthropic.claude-3-5-haiku-20241022-v1:0
      awsRegion: us-east-1
    promptCaching:
      cacheSystem: true     # cache the system prompt (default true)
      cacheMessages: true   # cache chat messages (default true)
      cacheTools: false     # cache tool definitions (default false)
      minTokens: 1024       # only cache prompts at least this large (default 1024)
```

| Field | Description |
|-------|-------------|
| `cacheSystem` | Add cache markers to the system prompt. Default `true`. |
| `cacheMessages` | Add cache markers to chat messages. Default `true`. |
| `cacheTools` | Add cache markers to tool definitions. Default `false`. |
| `minTokens` | Minimum prompt size, in tokens, before caching is applied. Default `1024`. |

Because caching applies to Bedrock, the end-to-end walkthrough with verification lives in the provider guide. To send cached traffic and confirm the cache hits, see [Prompt caching]({{< link-hextra path="/llm/providers/bedrock/#prompt-caching" >}}).

### See caching in your costs

With a [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}) that sets `cacheRead` and `cacheWrite` rates for the model, agentgateway prices cached traffic separately and exposes it in CEL and traces:

- `llm.cachedInputTokens`: tokens read from cache (the savings).
- `llm.cacheCreationInputTokens`: tokens written to cache (a one-time cost).
- `llm.cost.cacheRead` and `llm.cost.cacheWrite`: the USD cost of each, separate from `llm.cost.input`.

A high `cachedInputTokens`-to-`inputTokens` ratio means caching is working. For the catalog rate fields, see [Model costs]({{< link-hextra path="/llm/cost-controls/costs/" >}}).

## Measure the savings in dollars

In the routing walkthrough, you saw the served model change in the response `model` field. To translate that into dollars, add a [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}) and inspect the realized cost of each request:

- **Per-request cost**: each LLM log line includes `agw.ai.usage.cost.total`, and the `gen_ai.response.model` field shows which target actually served the request.
- **Compare models**: break down cost metrics by `gen_ai_response_model` to see spend per target.
- **Cache effectiveness**: compare `llm.cachedInputTokens` against `llm.inputTokens` to confirm cached prefixes are being reused.

See [Model costs]({{< link-hextra path="/llm/cost-controls/costs/" >}}) and [Observe traffic]({{< link-hextra path="/llm/observability/" >}}).

## What's next

- [Virtual models]({{< link-hextra path="/llm/virtual-models/" >}}) for the complete routing reference
- [Model costs]({{< link-hextra path="/llm/cost-controls/costs/" >}}) to price and compare model spend
- [Virtual key management]({{< link-hextra path="/llm/cost-controls/virtual-keys/" >}}) to attribute spend per consumer
