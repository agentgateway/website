---
title: Providers
weight: 20
description: Configure agentgateway for first-class, OpenAI-compatible, and self-hosted LLM providers
test: skip
---

Learn how to configure agentgateway for a particular LLM {{< gloss "Provider" >}}provider{{< /gloss >}}.

## First-class providers

Prefer the dedicated provider pages when agentgateway already knows the upstream base URL and request format. This includes Anthropic, OpenAI, and many OpenAI-compatible providers.

## OpenAI-compatible fallback

Use [OpenAI-compatible]({{< link-hextra path="/llm/providers/openai-compatible/" >}}) only for providers that do not have a first-class shortcut, such as Perplexity, vLLM, LM Studio, or another service that exposes the OpenAI API format.

### Override the upstream base URL

When you need a custom upstream endpoint in standalone mode, set `params.baseUrl` on the model instead of older host or path override fields.

```yaml
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$PERPLEXITY_API_KEY"
      baseUrl: "https://api.perplexity.ai"
    backendTLS: {}
```
