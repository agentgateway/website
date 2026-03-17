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
  - name: "*"
    provider: openAI
    params:
      apiKey: "$XAI_API_KEY"
      baseUrl: "https://api.x.ai"
```

## Cohere

[Cohere](https://cohere.com/) provides an OpenAI-compatible endpoint for their models.

{{< callout type="info" >}}
Cohere uses a custom API path. For providers with custom paths, use the traditional `binds/listeners/routes` configuration with URL rewriting. See the following [Advanced configuration](#advanced-configuration) section.
{{< /callout >}}

## Ollama (Local)

[Ollama](https://ollama.ai/) runs models locally and provides an OpenAI-compatible API.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: openAI
    params:
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
Groq uses a custom API path. For providers with custom paths, use the traditional `binds/listeners/routes` configuration with URL rewriting. See the following [Advanced configuration](#advanced-configuration) section.
{{< /callout >}}

## Fireworks AI

Fireworks AI provides access to open-source models via OpenAI-compatible endpoints.

{{< callout type="info" >}}
Fireworks AI uses a custom API path. For providers with custom paths, use the traditional `binds/listeners/routes` configuration with URL rewriting. See the following [Advanced configuration](#advanced-configuration) section.
{{< /callout >}}

## DeepSeek

[DeepSeek](https://www.deepseek.com/) provides access to their reasoning and chat models via OpenAI-compatible API.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: api.deepseek.com
        backendTLS: {}
        backendAuth:
          key: $DEEPSEEK_API_KEY
      backends:
      - ai:
          name: deepseek
          hostOverride: api.deepseek.com:443
          provider:
            openAI:
              model: deepseek-chat
```

## Mistral

[Mistral La Plateforme](https://mistral.ai/) provides access to Mistral models via OpenAI-compatible endpoints.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: api.mistral.ai
        backendTLS: {}
        backendAuth:
          key: $MISTRAL_API_KEY
      backends:
      - ai:
          name: mistral
          hostOverride: api.mistral.ai:443
          provider:
            openAI:
              model: mistral-large-latest
```

## Perplexity

[Perplexity](https://www.perplexity.ai/) provides OpenAI-compatible chat completion endpoints.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: api.perplexity.ai
        backendTLS: {}
        backendAuth:
          key: $PERPLEXITY_API_KEY
      backends:
      - ai:
          name: perplexity
          hostOverride: api.perplexity.ai:443
          provider:
            openAI:
              model: llama-3.1-sonar-large-128k-online
```


## Generic configuration

For any OpenAI-compatible provider that uses standard paths (`/v1/chat/completions`), use this template:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$PROVIDER_API_KEY"
      baseUrl: "<provider-base-url>"
```

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. Use `*` to match any model name. |
| `provider` | Set to `openai` for OpenAI-compatible providers. |
| `params.model` | The model name as expected by the provider. If set, this model is used for all requests. If not set, the model from the request is passed through. |
| `params.apiKey` | The provider's API key. You can reference environment variables using the `$VAR_NAME` syntax. |
| `params.baseUrl` | The provider's base URL (e.g., `https://api.provider.com`). |

## Advanced configuration

For providers that require URL path rewriting (like Cohere or Groq) or other advanced HTTP policies, use the traditional `binds/listeners/routes` configuration format.

For more information about choosing between configuration modes, see the [Routing-based configuration guide]({{< link-hextra path="/llm/configuration-modes/" >}}).

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

### Fireworks AI with URL rewriting

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
  - port: 3000
    listeners:
      - routes:
          - policies:
              urlRewrite:
                authority:
                  full: api.fireworks.ai
                path:
                  full: "/inference/v1/chat/completions"
              backendTLS: {}
              backendAuth:
                key: $FIREWORKS_API_KEY
            backends:
              - ai:
                  name: fireworks
                  hostOverride: api.fireworks.ai:443
                  provider:
                    openAI:
                      model: accounts/fireworks/models/kimi-k2p5

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

## Self-Hosted Solutions

### vLLM

[vLLM](https://github.com/vllm-project/vllm) is a high-performance LLM serving engine for self-hosted deployments.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: vllm-server.example.com:8000  # Your vLLM server
        backendTLS: {}  # Include if vLLM uses HTTPS
      backends:
      - ai:
          name: vllm
          hostOverride: vllm-server.example.com:8000
          provider:
            openAI:
              model: meta-llama/Llama-3.1-8B-Instruct  # Model loaded in vLLM
```

{{< callout type="info" >}}
For local vLLM instances without TLS, use `http://localhost:8000` and omit the `backendTLS` policy.
{{< /callout >}}

**Starting vLLM server**:
```bash
vllm serve meta-llama/Llama-3.1-8B-Instruct \
  --host 0.0.0.0 \
  --port 8000
```

### LM Studio

[LM Studio](https://lmstudio.ai/) provides a desktop UI for running models locally with OpenAI-compatible API.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: localhost:1234  # LM Studio default port
      backends:
      - ai:
          name: lmstudio
          hostOverride: localhost:1234
          provider:
            openAI:
              model: llama-3.2-3b-instruct  # Model loaded in LM Studio
```

{{< callout type="note" >}}
Enable the local server in LM Studio: **Settings → Local Server → Start Server**.
{{< /callout >}}
