---
title: LLM Providers
weight: 10
description: Connect Agent Gateway to LLM providers for AI-powered applications
---

Agent Gateway supports multiple LLM providers, allowing you to route requests to different AI models and manage API keys centrally.

{{< cards >}}
  {{< card link="/docs/llm/providers/openai" title="OpenAI" subtitle="GPT-4, GPT-4o, and more" >}}
  {{< card link="/docs/llm/providers/anthropic" title="Anthropic" subtitle="Claude models" >}}
  {{< card link="/docs/llm/providers/azure" title="Azure OpenAI" subtitle="Azure-hosted OpenAI models" >}}
  {{< card link="/docs/llm/providers/bedrock" title="Amazon Bedrock" subtitle="AWS foundation models" >}}
  {{< card link="/docs/llm/providers/gemini" title="Google Gemini" subtitle="Gemini models" >}}
  {{< card link="/docs/llm/providers/vertex" title="Vertex AI" subtitle="Google Cloud AI platform" >}}
  {{< card link="/docs/llm/providers/openai-compatible" title="OpenAI-Compatible" subtitle="xAI, Cohere, and other compatible APIs" >}}
  {{< card link="/docs/llm/providers/multiple-llms" title="Multiple Providers" subtitle="Route to multiple LLMs" >}}
{{< /cards >}}

## Quick start

To use an LLM provider with Agent Gateway, configure an `ai` backend:

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: my-llm
          provider:
            openAI:
              model: gpt-4o-mini
      policies:
        backendAuth:
          key: "$OPENAI_API_KEY"
```

See [LLM Consumption]({{< link-hextra path="/llm/" >}}) for complete documentation on working with LLM providers.
