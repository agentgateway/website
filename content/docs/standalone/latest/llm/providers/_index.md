---
title: Providers
weight: 20
description:
test: skip
---

Learn how to configure agentgateway for a particular LLM {{< gloss "Provider" >}}provider{{< /gloss >}}.

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
