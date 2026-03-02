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
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: api.x.ai
        backendTLS: {}
        backendAuth:
          key: $XAI_API_KEY
      backends:
      - ai:
          name: xai
          hostOverride: api.x.ai:443
          provider:
            openAI:
              model: grok-2-latest
```

## Cohere

[Cohere](https://cohere.com/) provides an OpenAI-compatible endpoint for their models.

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

## Ollama (Local)

[Ollama](https://ollama.ai/) runs models locally and provides an OpenAI-compatible API.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: localhost:11434
      backends:
      - ai:
          name: ollama
          hostOverride: localhost:11434
          provider:
            openAI:
              model: llama3.2
```

## Together AI

[Together AI](https://together.ai/) provides access to open-source models via OpenAI-compatible endpoints.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: api.together.xyz
        backendTLS: {}
        backendAuth:
          key: $TOGETHER_API_KEY
      backends:
      - ai:
          name: together
          hostOverride: api.together.xyz:443
          provider:
            openAI:
              model: meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo
```

## Groq

[Groq](https://groq.com/) provides fast inference via OpenAI-compatible endpoints.

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

## Fireworks AI

[Fireworks AI](https://fireworks.ai/) offers fast inference for open-source models via OpenAI-compatible API.

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
              model: accounts/fireworks/models/llama-v3p1-70b-instruct
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

## Generic configuration

For any OpenAI-compatible provider, use this template:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: <provider-api-host>
          path:
            full: "<provider-chat-endpoint>"  # Often /v1/chat/completions
        backendTLS: {}  # Include if provider uses HTTPS
        backendAuth:
          key: $PROVIDER_API_KEY
      backends:
      - ai:
          name: <provider-name>
          hostOverride: <provider-api-host>:443
          provider:
            openAI:
              model: <model-name>
```

## Configuration reference

| Setting | Description |
|---------|-------------|
| `urlRewrite` | Configure a policy to rewrite the URL of the upstream requests to match your LLM provider. |
| `authority` | Set the default hostname authority to forward incoming requests. |
| `path` | Rewrite the path to the appropriate LLM provider endpoint. This setting is optional if requests on the provider hostname are already sent on this path. |
| `backendTLS` | Optionally configure a policy to use TLS when connecting to the LLM provider. |
| `backendAuth` | You can optionally configure a policy to attach an API key that authenticates to the LLM provider on outgoing requests. If you do not include an API key, each request must authenticate per the LLM provider requirements. |
| `ai.name` | The name of the LLM provider for this AI backend. |
| `ai.hostOverride` | Override the hostname. If not set, the hostname defaults to OpenAI (`api.openai.com`). This setting is optional if the hostname is already set in the URL rewrite policy's `authority` setting. |
| `ai.provider.openAI.model` | Optionally set the model to use for requests. If not set, the request must include the model to use. |
