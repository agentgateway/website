---
title: Anthropic
weight: 50
description: Configuration and setup for Anthropic Claude provider
---

Configure Anthropic (Claude models) as an LLM provider in agentgateway.

## Configuration

{{< reuse "docs/snippets/review-configuration.md" >}}

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: anthropic
          provider:
            anthropic:
              model: claude-3-5-haiku-20241022
      policies:
        backendAuth:
          key: "$ANTHROPIC_API_KEY"
```
{{< reuse "docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `ai.name` | The name of the LLM provider for this AI backend. |
| `ai.provider.anthropic.model` | Optionally set the model to use for requests. If set, any models in the request are overwritten. If not set, the request must include the model to use. |
| `backendAuth` | Anthropic uses API keys for authentication. You can optionally configure a policy to attach an API key that authenticates to the LLM provider on outgoing requests. If you do not include an API key, each request must pass in a valid API key. |
