---
title: LLM providers
weight: 10
description: Connect agentgateway to LLM providers for AI-powered applications
test: skip
---

Agentgateway supports multiple LLM providers, allowing you to route requests to different AI models and manage API keys centrally.

## Quick start

To use an LLM provider with agentgateway, configure an `ai` backend.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: my-llm
          provider:
            openAI:
              model: gpt-4o-mini
      policies:
        backendAuth:
          key: "$OPENAI_API_KEY"
```

See [LLM Consumption]({{< link-hextra path="/llm/" >}}) for complete documentation on working with LLM providers.
