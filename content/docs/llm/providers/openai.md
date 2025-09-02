---
title: OpenAI
weight: 10
description: Configuration and setup for OpenAI LLM provider
---

Configure OpenAI as an LLM provider in agentgateway.

## Configuration

{{< reuse "docs/snippets/review-configuration.md" >}}

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: openai
          provider:
            openAI:
              # Optional; overrides the model in requests
              model: gpt-3.5-turbo
      policies:
        backendAuth:
          key: "$OPENAI_API_KEY"
```

{{< reuse "docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `ai.name` | The name of the LLM provider for this AI backend. |
| `ai.provider.openAI.model` | Optionally set the model to use for requests. If set, any models in the request are overwritten. If not set, the request must include the model to use. |
| `backendAuth` | OpenAI uses API keys for authentication. Optionally configure a policy to attach an API key that authenticate to the LLM provider to outgoing requests. If you do not include an API key, each request must pass in a valid API key. |
