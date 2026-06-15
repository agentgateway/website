---
title: Providers
weight: 20
description: Canonical provider list and configuration guides for standalone LLM backends
test: skip
---

This is the canonical list of standalone LLM {{< gloss "Provider" >}}provider{{< /gloss >}} configuration guides.

If you arrived from `/integrations/llm-providers/`, use this section for the complete provider directory and detailed setup for each backend.

## OpenAI-compatible providers

Popular OpenAI-compatible providers include xAI (Grok), Cohere, Together AI, Groq, DeepSeek, Mistral, Perplexity, and Fireworks AI.

Additional self-hosted solutions like vLLM and LM Studio are also supported through the [OpenAI-compatible]({{< link-hextra path="/llm/providers/openai-compatible/" >}}) configuration.

### Path prefix

When using the advanced `binds/listeners/routes` configuration, you can set `pathPrefix` on an AI provider to prepend a custom path to all API requests. Use `pathPrefix` when routing through a proxy or custom API endpoint that requires a different base path.

```yaml
backends:
- ai:
    name: openai
    pathPrefix: /custom/v1
    provider:
      openAI:
        model: gpt-4o-mini
  policies:
    backendAuth:
      key: "$OPENAI_API_KEY"
```
