---
title: OpenAI-compatible providers
weight: 10
description: Configuration and setup for arbitrary OpenAI compatible LLM providers
---

Configure any LLM provider that provides OpenAI-compatible endpoints with agentgateway. This includes providers like xAI (Grok), Cohere, Ollama, Together AI, Groq, and many others.

## xAI (Grok)

[xAI](https://x.ai/) provides OpenAI-compatible endpoints for their Grok models.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: grok-2-latest
    provider: openAI
    params:
      model: grok-2-latest
      apiKey: "$XAI_API_KEY"
      baseUrl: "https://api.x.ai"
```

## Cohere

[Cohere](https://cohere.com/) provides an OpenAI-compatible endpoint for their models.

{{< callout type="info" >}}
Cohere uses a custom API path. For providers with custom paths, use the traditional `binds/listeners/routes` configuration with URL rewriting. See the [Advanced configuration](#advanced-configuration) section below.
{{< /callout >}}

## Ollama (Local)

[Ollama](https://ollama.ai/) runs models locally and provides an OpenAI-compatible API.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: llama3.2
    provider: openAI
    params:
      model: llama3.2
      baseUrl: "http://localhost:11434"
```

## Together AI

[Together AI](https://together.ai/) provides access to open-source models via OpenAI-compatible endpoints.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: llama-3.2-90b
    provider: openAI
    params:
      model: meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo
      apiKey: "$TOGETHER_API_KEY"
      baseUrl: "https://api.together.xyz"
```

## Groq

[Groq](https://groq.com/) provides fast inference via OpenAI-compatible endpoints.

{{< callout type="info" >}}
Groq uses a custom API path. For providers with custom paths, use the traditional `binds/listeners/routes` configuration with URL rewriting. See the [Advanced configuration](#advanced-configuration) section below.
{{< /callout >}}

## Generic configuration

For any OpenAI-compatible provider that uses standard paths (`/v1/chat/completions`), use this template:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: <model-identifier>
    provider: openAI
    params:
      model: <model-name>
      apiKey: "$PROVIDER_API_KEY"
      baseUrl: "<provider-base-url>"
```

| Setting | Description |
|---------|-------------|
| `name` | The name identifier for this model configuration. |
| `provider` | Set to `openai` for OpenAI-compatible providers. |
| `params.model` | The model name as expected by the provider. |
| `params.apiKey` | The provider's API key. You can reference environment variables using the `$VAR_NAME` syntax. |
| `params.baseUrl` | The provider's base URL (e.g., `https://api.provider.com`). |

## Advanced configuration

For providers that require URL path rewriting (like Cohere or Groq) or other advanced HTTP policies, use the traditional `binds/listeners/routes` configuration format.

### Cohere with URL rewriting

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: api.cohere.ai
          path:
            full: "/compatibility/v1/chat/completions"
        backendTLS: {}
        backendAuth:
          key: $COHERE_API_KEY
      backends:
      - ai:
          name: cohere
          hostOverride: api.cohere.ai:443
          provider:
            openAI:
              model: command-r-plus
```

### Groq with URL rewriting

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: api.groq.com
          path:
            full: "/openai/v1/chat/completions"
        backendTLS: {}
        backendAuth:
          key: $GROQ_API_KEY
      backends:
      - ai:
          name: groq
          hostOverride: api.groq.com:443
          provider:
            openAI:
              model: llama-3.3-70b-versatile
```

For more information about choosing between configuration modes, see the [Configuration modes guide](../configuration-modes/).
