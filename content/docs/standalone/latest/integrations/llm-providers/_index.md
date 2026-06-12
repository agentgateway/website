---
title: LLM providers
weight: 10
description: Connect agentgateway to LLM providers for AI-powered applications
test: skip
---

Agentgateway supports multiple LLM providers, allowing you to route requests to different AI models and manage API keys centrally.

## Quick start

To use an LLM provider with agentgateway, add a model configuration to the `llm` section.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: openAI
    params:
      model: gpt-4o-mini
      apiKey: "$OPENAI_API_KEY"
```

See [LLM Consumption]({{< link-hextra path="/llm/" >}}) for complete documentation on working with LLM providers.
