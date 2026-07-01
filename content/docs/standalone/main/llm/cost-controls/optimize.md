---
title: Optimize cost
weight: 70
description: Reduce LLM spend by routing to cheaper models and caching repeated prompt content.
---

The other cost controls help you *attribute*, *observe*, and *enforce* spend. This guide helps you *reduce* it, with two levers:

- **Route to cheaper models**: send each request to the cheapest model that meets its quality bar, without changing client code.
- **Cache repeated prompt content**: avoid paying full input-token price for the same system prompt or context on every request.

Pair both with a [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}) so that you can measure the realized savings in logs, metrics, and traces.

## Route to cheaper models

Clients call one stable model name, and agentgateway decides which upstream model actually serves the request. This guide frames the [virtual model]({{< link-hextra path="/llm/virtual-models/" >}}) routing strategies around cost. For the full routing reference, see [Virtual models]({{< link-hextra path="/llm/virtual-models/" >}}).

### Why route for cost

Model prices vary by one to two orders of magnitude. A request that a small model can answer well does not need a frontier model. With a virtual model, you publish one client-facing name (for example, `smart`) and route across internal targets so that you can:

- Send routine traffic to a cheaper model and reserve expensive models for requests that need them.
- A/B test a cheaper model against your current one before you commit.
- Fall back to a cheaper or alternate model when your primary is unavailable.

Pair routing with a [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}) so that you can measure the realized savings of each strategy in logs, metrics, and traces.

### Conditional routing: send cheaper traffic to cheaper models

Use `routing.conditional` to pick a target based on request context with a CEL `when` expression. This is the most direct cost lever: route by tier, header, or request body, sending most traffic to an inexpensive model and only premium requests to a frontier model.

```yaml
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
```

Clients always request `assistant`. Premium callers reach the frontier model; everyone else falls through to the cheaper one. The fallback target has no `when` and must be last. Because `when` is evaluated at request time, it can reference `request.headers`, `request.body` (via `json(request.body)`), `jwt`, and `apiKey` metadata—but not `llm.cost`, which is only known after the response.

### Weighted routing: A/B test cost before you commit

Use `routing.weighted` to split traffic across targets by percentage. Send a small share of traffic to a cheaper model, compare quality and realized cost in your observability stack, then shift the weights as confidence grows.

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

With a [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}) configured, filter your cost metrics by `gen_ai_response_model` to compare the realized USD cost of `current` versus `candidate` on live traffic before you raise the candidate's weight.

### Failover routing: cheaper, resilient backups

Use `routing.failover` with `priority` to define ordered backups. Beyond resilience, failover lets you keep serving—often from a cheaper alternate—when your primary provider is rate limited or down, instead of failing the request.

For the full failover example and semantics, see [Failover routing]({{< link-hextra path="/llm/virtual-models/#failover-routing" >}}).

## Cache repeated prompt content

When requests share a large, stable prefix—a long system prompt, tool definitions, or retrieved context—prompt caching lets the provider reuse that work instead of reprocessing it every time. Cached input tokens are billed at a much lower rate than fresh input tokens, so caching cuts cost for repetitive workloads such as agents and chat sessions.

{{< callout type="warning" >}}
Prompt caching is currently applied for **Amazon Bedrock** models that support it (Claude 3 and later, and Amazon Nova). It is not applied for the direct Anthropic or OpenAI providers.
{{< /callout >}}

Enable caching per model with `promptCaching`. When enabled, agentgateway automatically inserts cache markers into the request; you do not change client payloads.

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

### See caching in your costs

With a [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}) that sets `cacheRead` and `cacheWrite` rates for the model, agentgateway prices cached traffic separately and exposes it in CEL and traces:

- `llm.cachedInputTokens`: tokens read from cache (the savings).
- `llm.cacheCreationInputTokens`: tokens written to cache (a one-time cost).
- `llm.cost.cacheRead` and `llm.cost.cacheWrite`: the USD cost of each, separate from `llm.cost.input`.

A high `cachedInputTokens`-to-`inputTokens` ratio means caching is working. For the catalog rate fields, see [Model costs]({{< link-hextra path="/llm/cost-controls/costs/" >}}).

## Measure the savings

Optimization only pays off if you can see the result. After you route or enable caching, confirm the cost impact:

- **Per-request cost**: each LLM log line includes `agw.ai.usage.cost.total`; the `gen_ai.response.model` field shows which target actually served the request.
- **Compare models**: break down cost metrics by `gen_ai_response_model` to see spend per target.
- **Cache effectiveness**: compare `llm.cachedInputTokens` against `llm.inputTokens` to confirm cached prefixes are being reused.

See [Model costs]({{< link-hextra path="/llm/cost-controls/costs/" >}}) and [Observe traffic]({{< link-hextra path="/llm/observability/" >}}).

## What's next

- [Virtual models]({{< link-hextra path="/llm/virtual-models/" >}}) for the complete routing reference
- [Model costs]({{< link-hextra path="/llm/cost-controls/costs/" >}}) to price and compare model spend
- [Virtual key management]({{< link-hextra path="/llm/cost-controls/virtual-keys/" >}}) to attribute spend per consumer
