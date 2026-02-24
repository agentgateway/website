---
title: Providers
weight: 20
description:
---

Learn how to configure agentgateway for a particular LLM {{< gloss "Provider" >}}provider{{< /gloss >}}.

## Native providers

{{< cards >}}
  {{< card link="openai" title="OpenAI" >}}
  {{< card link="anthropic" title="Anthropic" >}}
  {{< card link="gemini" title="Google Gemini" >}}
  {{< card link="vertex" title="Google Vertex AI" >}}
  {{< card link="bedrock" title="Amazon Bedrock" >}}
  {{< card link="azure" title="Azure OpenAI" >}}
{{< /cards >}}

## OpenAI-compatible providers

{{< cards >}}
  {{< card link="openai-compatible" title="OpenAI-compatible providers" >}}
{{< /cards >}}

Popular OpenAI-compatible providers include xAI (Grok), Cohere, Together AI, Groq, DeepSeek, Mistral, Perplexity, and Fireworks AI.

## Self-hosted solutions

{{< cards >}}
  {{< card link="ollama" title="Ollama" >}}
{{< /cards >}}

Additional self-hosted solutions like vLLM and LM Studio are also supported through the [OpenAI-compatible]({{< link-hextra path="/llm/providers/openai-compatible/" >}}) configuration.

## Advanced configurations

{{< cards >}}
  {{< card link="multiple-llms" title="Multiple LLM providers" >}}
{{< /cards >}}