---
title: Providers
weight: 15
description: Configure agentgateway for first-class LLM providers and fallback compatibility options.
test: skip
---

Learn how to configure agentgateway for a particular LLM.

## First-class providers

Prefer the dedicated provider pages when agentgateway already knows the upstream host, path defaults, and request format. This includes the `cohere`, `baseten`, `cerebras`, `deepinfra`, `deepseek`, `groq`, `huggingface`, `mistral`, `openrouter`, `togetherai`, `xai`, `fireworks`, and `ollama` provider types:

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

## Fallback options

Use [OpenAI-compatible providers]({{< link-hextra path="/llm/providers/openai-compatible/" >}}) for providers without built-in support that still expose the OpenAI API format, such as Perplexity.

Use custom providers only for unsupported, non-standard, or self-hosted targets when you need to declare formats, upstream paths, or backend targets explicitly.
