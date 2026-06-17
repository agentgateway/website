---
title: Providers
weight: 20
description: Configure agentgateway for first-class, OpenAI-compatible, and self-hosted LLM providers
test: skip
---

Learn how to configure agentgateway for a particular LLM {{< gloss "Provider" >}}provider{{< /gloss >}}.

## First-class providers

Prefer the dedicated provider pages when agentgateway already knows the upstream base URL and request format:

- [OpenAI]({{< link-hextra path="/llm/providers/openai/" >}})
- [Anthropic]({{< link-hextra path="/llm/providers/anthropic/" >}})
- [Azure OpenAI]({{< link-hextra path="/llm/providers/azure/" >}})
- [Bedrock]({{< link-hextra path="/llm/providers/bedrock/" >}})
- [Gemini]({{< link-hextra path="/llm/providers/gemini/" >}})
- [Vertex AI]({{< link-hextra path="/llm/providers/vertex/" >}})
- [Ollama]({{< link-hextra path="/llm/providers/ollama/" >}})
- [Baseten]({{< link-hextra path="/llm/providers/baseten/" >}})
- [Cerebras]({{< link-hextra path="/llm/providers/cerebras/" >}})
- [Cohere]({{< link-hextra path="/llm/providers/cohere/" >}})
- [DeepInfra]({{< link-hextra path="/llm/providers/deepinfra/" >}})
- [DeepSeek]({{< link-hextra path="/llm/providers/deepseek/" >}})
- [Fireworks AI]({{< link-hextra path="/llm/providers/fireworks/" >}})
- [Groq]({{< link-hextra path="/llm/providers/groq/" >}})
- [Hugging Face]({{< link-hextra path="/llm/providers/huggingface/" >}})
- [Mistral]({{< link-hextra path="/llm/providers/mistral/" >}})
- [OpenRouter]({{< link-hextra path="/llm/providers/openrouter/" >}})
- [Together AI]({{< link-hextra path="/llm/providers/togetherai/" >}})
- [xAI]({{< link-hextra path="/llm/providers/xai/" >}})

## OpenAI-compatible fallback

Use [OpenAI-compatible]({{< link-hextra path="/llm/providers/openai-compatible/" >}}) for providers that do not have a first-class shortcut, such as Perplexity, vLLM, LM Studio, or another service that exposes the OpenAI API format.

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
