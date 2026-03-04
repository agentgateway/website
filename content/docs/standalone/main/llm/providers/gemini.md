---
title: Gemini
weight: 30
description: Configuration and setup for Google Gemini provider
---

Configure Google Gemini as an LLM provider in agentgateway.

## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: gemini-1.5-flash
    provider: gemini
    params:
      model: gemini-1.5-flash
      apiKey: "$GEMINI_API_KEY"
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The name identifier for this model configuration. |
| `provider` | The LLM provider, set to `gemini` for Google Gemini models. |
| `params.model` | The specific Gemini model to use. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | The Gemini API key for authentication. You can reference environment variables using the `$VAR_NAME` syntax. |
