---
title: OpenAI-compatible providers
weight: 10
description: Configure agentgateway to route traffic to any LLM provider that implements the OpenAI API format.
test:
  openai-compatible-validate:
  - file: content/docs/standalone/latest/llm/providers/openai-compatible.md
    path: openai-compat-validate
---

Configure any LLM provider that implements the OpenAI API format with agentgateway. Use the `openAI` provider type with `hostOverride` to point to the provider's API host, and `pathOverride` if the provider uses a non-standard chat completions path.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

You also need the following prerequisites.

- An API key for your chosen provider (except for local providers like Ollama).

{{< doc-test paths="openai-compat-validate" >}}
# Install agentgateway binary for testing
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/n-patch.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"

# Set placeholder API keys for validation (--validate-only still resolves env vars)
export XAI_API_KEY="${XAI_API_KEY:-test}"
export COHERE_API_KEY="${COHERE_API_KEY:-test}"
export TOGETHER_API_KEY="${TOGETHER_API_KEY:-test}"
export GROQ_API_KEY="${GROQ_API_KEY:-test}"
export FIREWORKS_API_KEY="${FIREWORKS_API_KEY:-test}"
export DEEPSEEK_API_KEY="${DEEPSEEK_API_KEY:-test}"
export MISTRAL_API_KEY="${MISTRAL_API_KEY:-test}"
export PERPLEXITY_API_KEY="${PERPLEXITY_API_KEY:-test}"
{{< /doc-test >}}

## Cloud providers

### xAI (Grok)

[xAI](https://x.ai/) provides OpenAI-compatible endpoints for their Grok models.

```yaml {paths="openai-compat-validate"}
cat > /tmp/test-xai.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$XAI_API_KEY"
      hostOverride: "api.x.ai:443"
    backendTLS: {}
EOF
```

{{< doc-test paths="openai-compat-validate" >}}
agentgateway -f /tmp/test-xai.yaml --validate-only
{{< /doc-test >}}

### Cohere

[Cohere](https://cohere.com/) provides an OpenAI-compatible endpoint for their models. Cohere uses a custom API path, so `pathOverride` is required.

```yaml {paths="openai-compat-validate"}
cat > /tmp/test-cohere.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      model: command-r-plus
      apiKey: "$COHERE_API_KEY"
      hostOverride: "api.cohere.ai:443"
      pathOverride: "/compatibility/v1/chat/completions"
    backendTLS: {}
EOF
```

{{< doc-test paths="openai-compat-validate" >}}
agentgateway -f /tmp/test-cohere.yaml --validate-only
{{< /doc-test >}}

### Together AI

[Together AI](https://www.together.ai/) provides access to open-source models via OpenAI-compatible endpoints.

```yaml {paths="openai-compat-validate"}
cat > /tmp/test-together.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: llama-3.2-90b
    provider: openAI
    params:
      model: meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo
      apiKey: "$TOGETHER_API_KEY"
      hostOverride: "api.together.xyz:443"
    backendTLS: {}
EOF
```

{{< doc-test paths="openai-compat-validate" >}}
agentgateway -f /tmp/test-together.yaml --validate-only
{{< /doc-test >}}

### Groq

[Groq](https://groq.com/) provides fast inference via OpenAI-compatible endpoints. Groq uses a custom API path, so `pathOverride` is required.

```yaml {paths="openai-compat-validate"}
cat > /tmp/test-groq.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      model: llama-3.3-70b-versatile
      apiKey: "$GROQ_API_KEY"
      hostOverride: "api.groq.com:443"
      pathOverride: "/openai/v1/chat/completions"
    backendTLS: {}
EOF
```

{{< doc-test paths="openai-compat-validate" >}}
agentgateway -f /tmp/test-groq.yaml --validate-only
{{< /doc-test >}}

### Fireworks AI

[Fireworks AI](https://fireworks.ai/) offers fast inference for open-source models via OpenAI-compatible API. Fireworks uses a custom API path, so `pathOverride` is required.

```yaml {paths="openai-compat-validate"}
cat > /tmp/test-fireworks.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      model: accounts/fireworks/models/llama-v3p1-70b-instruct
      apiKey: "$FIREWORKS_API_KEY"
      hostOverride: "api.fireworks.ai:443"
      pathOverride: "/inference/v1/chat/completions"
    backendTLS: {}
EOF
```

{{< doc-test paths="openai-compat-validate" >}}
agentgateway -f /tmp/test-fireworks.yaml --validate-only
{{< /doc-test >}}

### DeepSeek

[DeepSeek](https://www.deepseek.com/) provides access to their reasoning and chat models via OpenAI-compatible API.

```yaml {paths="openai-compat-validate"}
cat > /tmp/test-deepseek.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      model: deepseek-chat
      apiKey: "$DEEPSEEK_API_KEY"
      hostOverride: "api.deepseek.com:443"
    backendTLS: {}
EOF
```

{{< doc-test paths="openai-compat-validate" >}}
agentgateway -f /tmp/test-deepseek.yaml --validate-only
{{< /doc-test >}}

### Mistral

[Mistral La Plateforme](https://mistral.ai/) provides access to Mistral models via OpenAI-compatible endpoints.

```yaml {paths="openai-compat-validate"}
cat > /tmp/test-mistral.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      model: mistral-large-latest
      apiKey: "$MISTRAL_API_KEY"
      hostOverride: "api.mistral.ai:443"
    backendTLS: {}
EOF
```

{{< doc-test paths="openai-compat-validate" >}}
agentgateway -f /tmp/test-mistral.yaml --validate-only
{{< /doc-test >}}

### Perplexity

[Perplexity](https://www.perplexity.ai/) provides OpenAI-compatible chat completion endpoints with built-in web search.

```yaml {paths="openai-compat-validate"}
cat > /tmp/test-perplexity.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      model: llama-3.1-sonar-large-128k-online
      apiKey: "$PERPLEXITY_API_KEY"
      hostOverride: "api.perplexity.ai:443"
    backendTLS: {}
EOF
```

{{< doc-test paths="openai-compat-validate" >}}
agentgateway -f /tmp/test-perplexity.yaml --validate-only
{{< /doc-test >}}

## Self-hosted solutions

### Ollama

[Ollama](https://ollama.com/) runs models locally and provides an OpenAI-compatible API. For a dedicated setup guide, see [Ollama]({{< link-hextra path="/llm/providers/ollama/" >}}).

```yaml {paths="openai-compat-validate"}
cat > /tmp/test-ollama.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      hostOverride: "localhost:11434"
EOF
```

{{< doc-test paths="openai-compat-validate" >}}
agentgateway -f /tmp/test-ollama.yaml --validate-only
{{< /doc-test >}}

### vLLM

[vLLM](https://github.com/vllm-project/vllm) is a high-performance LLM serving engine for self-hosted deployments.

```yaml {paths="openai-compat-validate"}
cat > /tmp/test-vllm.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      model: meta-llama/Llama-3.1-8B-Instruct
      hostOverride: "localhost:8000"
EOF
```

{{< callout type="info" >}}
If your vLLM server uses HTTPS, add `backendTLS: {}` to the model configuration and include the port `443` in `hostOverride`.
{{< /callout >}}

{{< doc-test paths="openai-compat-validate" >}}
agentgateway -f /tmp/test-vllm.yaml --validate-only
{{< /doc-test >}}

### LM Studio

[LM Studio](https://lmstudio.ai/) provides a desktop application for running models locally with an OpenAI-compatible API.

```yaml {paths="openai-compat-validate"}
cat > /tmp/test-lmstudio.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      hostOverride: "localhost:1234"
EOF
```

{{< callout type="note" >}}
Enable the local server in LM Studio: **Settings** > **Local Server** > **Start Server**.
{{< /callout >}}

{{< doc-test paths="openai-compat-validate" >}}
agentgateway -f /tmp/test-lmstudio.yaml --validate-only
{{< /doc-test >}}

## Generic configuration

For any OpenAI-compatible provider, use this template:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$PROVIDER_API_KEY"
      hostOverride: "<provider-host>:<port>"
      pathOverride: "<custom-path>"  # only if non-standard
    backendTLS: {}  # only for HTTPS providers
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. Use `*` to match any model name. |
| `provider` | Set to `openAI` for OpenAI-compatible providers. |
| `params.model` | The model name as expected by the provider. If omitted, the model from the client request is passed through. |
| `params.apiKey` | The provider's API key. Reference environment variables with the `$VAR_NAME` syntax. |
| `params.hostOverride` | The provider's API host and port (e.g., `api.example.com:443`). |
| `params.pathOverride` | Override the request path for providers that use non-standard endpoints (e.g., `/openai/v1/chat/completions`). Omit for providers that use the standard `/v1/chat/completions` path. |
| `backendTLS` | Enable TLS for the upstream connection. Required for HTTPS providers, omit for local HTTP providers. |
