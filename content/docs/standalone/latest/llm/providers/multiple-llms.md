---
title: Multiple LLM providers
weight: 30
description: Configure load balancing across multiple LLM providers.
---

For simplified `llm` configuration, you can define named provider defaults once in `llm.providers[]` and reference them from multiple `llm.models[]` entries with `provider.reference`.

```yaml
llm:
  providers:
  - name: openai-prod
    provider: openai
    params:
      apiKey: "$OPENAI_API_KEY"

  models:
  - name: fast
    provider:
      reference: openai-prod
    params:
      model: gpt-4o-mini
  - name: smart
    provider:
      reference: openai-prod
    params:
      model: gpt-4o
```

In this example, `smart` inherits the upstream API key from `llm.providers[]` and only changes the model name.

Named providers can hold shared upstream settings you want to reuse, such as authentication, host overrides, path overrides, or other model defaults.
Keep the shared values on `llm.providers[]` and only set per-model differences on `llm.models[]`.
