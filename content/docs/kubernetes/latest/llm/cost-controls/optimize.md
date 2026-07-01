---
title: Optimize cost
weight: 70
description: Reduce LLM spend by aliasing to cheaper models and caching repeated prompt content.
---

The other cost controls help you *attribute*, *observe*, and *enforce* spend. This guide helps you *reduce* it, with two levers you can apply without changing client code:

- **Point a friendly model name at a cheaper model** with model aliases.
- **Cache repeated prompt content** so you do not pay full input-token price for the same context on every request.

Pair both with a [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}) so that you can measure the realized savings in logs, metrics, and traces.

## Alias to a cheaper model

Model aliasing maps a stable, client-facing name to a specific upstream model. Clients call the alias (for example, `fast` or `smart`); you decide which real model serves it, and you can repoint the alias to a cheaper model without touching client code. Configure aliases with `policies.ai.modelAliases` on the {{< reuse "agw-docs/snippets/backend.md" >}}.

```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: openai
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      openai: {}
  policies:
    auth:
      secretRef:
        name: openai-secret
    ai:
      modelAliases:
        fast: gpt-3.5-turbo
        smart: gpt-4-turbo
```

For the full walkthrough, see [Model aliasing]({{< link-hextra path="/llm/alias/" >}}).

{{< callout type="info" >}}
In Kubernetes mode, cost-aware routing is limited to model aliases (a one-to-one name mapping). The weighted, conditional, and failover [virtual model]({{< link-hextra path="/llm/virtual-models/" >}}) strategies—for example, splitting traffic across models to A/B test cost, or routing premium users to a frontier model—are available in standalone mode.
{{< /callout >}}

## Cache repeated prompt content

When requests share a large, stable prefix—a long system prompt, tool definitions, or retrieved context—prompt caching lets the model reuse that work instead of reprocessing it on every request. Cached input tokens are billed at a much lower rate than fresh input tokens, so caching cuts cost for repetitive workloads such as agents and chat sessions.

Configure caching with the `backend.ai.promptCaching` fields on an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource.

{{< callout type="warning" >}}
Prompt caching is supported for **Amazon Bedrock** Claude 3+ and Nova models. It is not applied for the direct Anthropic or OpenAI providers.
{{< /callout >}}

```yaml
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: bedrock-caching-policy
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      name: bedrock
  backend:
    ai:
      promptCaching:
        cacheSystem: true     # cache the system prompt
        cacheMessages: true   # cache chat messages
        cacheTools: false     # cache tool definitions
        minTokens: 1024       # only cache prompts at least this large
```

For the full walkthrough and verification steps, see [Prompt caching]({{< link-hextra path="/llm/providers/bedrock/#prompt-caching" >}}) in the Bedrock provider guide.

### See caching in your costs

With a [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}) that sets `cacheRead` and `cacheWrite` rates for the model, agentgateway prices cached traffic separately and exposes it in CEL and traces:

- `llm.cachedInputTokens`: tokens read from cache (the savings).
- `llm.cacheCreationInputTokens`: tokens written to cache (a one-time cost).
- `llm.cost.cacheRead` and `llm.cost.cacheWrite`: the USD cost of each, separate from `llm.cost.input`.

A high `cachedInputTokens`-to-`inputTokens` ratio means caching is working.

## Measure the savings

Optimization only pays off if you can see the result. After you alias or enable caching, confirm the cost impact:

- **Per-request cost**: each LLM log line includes `agw.ai.usage.cost.total`; the `gen_ai.response.model` field shows which model actually served the request.
- **Compare models**: break down cost metrics by `gen_ai_response_model` to see spend per model.
- **Cache effectiveness**: compare `llm.cachedInputTokens` against `llm.inputTokens` to confirm cached prefixes are being reused.

See [Model costs]({{< link-hextra path="/llm/cost-controls/costs/" >}}) and [LLM cost tracking]({{< link-hextra path="/llm/cost-controls/cost-tracking/" >}}).

## What's next

- [Model aliasing]({{< link-hextra path="/llm/alias/" >}}) for the full aliasing walkthrough
- [Prompt caching]({{< link-hextra path="/llm/providers/bedrock/#prompt-caching" >}}) for Bedrock caching setup
- [Model costs]({{< link-hextra path="/llm/cost-controls/costs/" >}}) to price and compare model spend
- [Virtual key management]({{< link-hextra path="/llm/cost-controls/virtual-keys/" >}}) to attribute spend per consumer
