---
title: Virtual models
weight: 47
description: Configure virtual models with weighted, failover, and conditional routing in simplified LLM mode.
---

Virtual models let you publish one client-facing model name and route requests across one or more internal target models.

Use `llm.virtualModels[]` to define the virtual entrypoint and `llm.models[]` as the concrete upstream targets.

## Public and internal models

Use `llm.models[].visibility` to control whether a model is directly exposed to clients or kept as an internal target.

- `public`: The model can be requested directly by clients and can also be used as a virtual model target.
- `internal`: The model is intended for internal routing targets and is not exposed as a direct client model.

## Route selection modes

Each virtual model defines a `mode` and a list of `routes`.
The routes in a virtual model point to concrete `llm.models[]` entries.

### Weighted routing

Use `mode: weighted` to split traffic between targets with `weight`.

```yaml
llm:
  models:
  - name: gpt-4o-public
    visibility: public
    provider: openAI
    params:
      model: gpt-4o
      apiKey: "$OPENAI_API_KEY"
  - name: gpt-4o-primary
    visibility: internal
    provider: openAI
    params:
      model: gpt-4o
      apiKey: "$OPENAI_API_KEY"
  - name: gpt-4o-fallback
    visibility: internal
    provider: openAI
    params:
      model: gpt-4o-mini
      apiKey: "$OPENAI_API_KEY"

  virtualModels:
  - name: smart
    mode: weighted
    routes:
    - model: gpt-4o-primary
      weight: 90
    - model: gpt-4o-fallback
      weight: 10
```

### Failover routing

Use `mode: failover` and `priority` to define ordered failover targets.

```yaml
llm:
  models:
  - name: claude-public
    visibility: public
    provider: anthropic
    params:
      model: claude-sonnet-4-0
      apiKey: "$ANTHROPIC_API_KEY"
  - name: claude-primary
    visibility: internal
    provider: anthropic
    params:
      model: claude-sonnet-4-0
      apiKey: "$ANTHROPIC_API_KEY"
  - name: claude-backup
    visibility: internal
    provider: anthropic
    params:
      model: claude-3-5-haiku-20241022
      apiKey: "$ANTHROPIC_API_KEY"

  virtualModels:
  - name: resilient
    mode: failover
    routes:
    - model: claude-primary
      priority: 1
    - model: claude-backup
      priority: 2
```

### Conditional routing

Use `mode: conditional` and `when` expressions to select targets by request context.

```yaml
llm:
  models:
  - name: openai-public
    visibility: public
    provider: openAI
    params:
      model: gpt-4o-mini
      apiKey: "$OPENAI_API_KEY"
  - name: openai-fast
    visibility: internal
    provider: openAI
    params:
      model: gpt-4o-mini
      apiKey: "$OPENAI_API_KEY"
  - name: openai-smart
    visibility: internal
    provider: openAI
    params:
      model: gpt-4o
      apiKey: "$OPENAI_API_KEY"

  virtualModels:
  - name: adaptive
    mode: conditional
    routes:
    - model: openai-fast
      when: request.headers["x-tier"] == "free"
    - model: openai-smart
      when: request.headers["x-tier"] == "pro"
```

{{< callout type="info" >}}
For reusable provider defaults in simplified mode, see [Multiple LLM providers]({{< link-hextra path="/llm/providers/multiple-llms/" >}}).
{{< /callout >}}
