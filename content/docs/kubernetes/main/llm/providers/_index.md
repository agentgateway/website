---
title: Providers
weight: 15
description: Configure agentgateway for first-class provider shortcuts and OpenAI-compatible fallbacks.
test: skip
---

Learn how to configure agentgateway for a particular LLM.

## First-class providers

Prefer the dedicated provider pages when the {{< reuse "agw-docs/snippets/backend.md" >}} API has a first-class provider type for the upstream, with built-in host, path, and request-format defaults.

- [OpenAI]({{< link-hextra path="/llm/providers/openai/" >}})
- [Anthropic]({{< link-hextra path="/llm/providers/anthropic/" >}})
- [Azure OpenAI]({{< link-hextra path="/llm/providers/azure/" >}})
- [Bedrock]({{< link-hextra path="/llm/providers/bedrock/" >}})
- [Gemini]({{< link-hextra path="/llm/providers/gemini/" >}})
- [Vertex AI]({{< link-hextra path="/llm/providers/vertex/" >}})
- [Ollama]({{< link-hextra path="/llm/providers/ollama/" >}})

## OpenAI-compatible providers

Many providers, such as Cohere, DeepSeek, Groq, Mistral, Together AI, and xAI, expose the OpenAI Chat Completions API but do not have a first-class type in the {{< reuse "agw-docs/snippets/backend.md" >}} API. Configure these with the `ai.provider.openai` shape. For the list of supported hosts and paths, see [OpenAI-compatible providers]({{< link-hextra path="/llm/providers/openai-compatible/" >}}).

## Custom providers

Use [custom providers]({{< link-hextra path="/llm/providers/custom/" >}}) for unsupported, non-standard, or self-hosted targets when you need to declare formats, upstream paths, or backend targets explicitly.
