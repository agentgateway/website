---
title: OpenAI-compatible providers
weight: 10
description: Configure agentgateway for providers without built-in support that implement the OpenAI API format.
test:
  openai-compatible-validate:
  - file: content/docs/standalone/main/llm/providers/openai-compatible.md
    path: openai-compat-validate
---

Use this page for providers that implement the OpenAI API format but do not have a first-class `provider:` shortcut yet. For built-in providers such as [Cohere]({{< link-hextra path="/llm/providers/cohere/" >}}), [DeepSeek]({{< link-hextra path="/llm/providers/deepseek/" >}}), [Fireworks AI]({{< link-hextra path="/llm/providers/fireworks/" >}}), [Groq]({{< link-hextra path="/llm/providers/groq/" >}}), [Hugging Face]({{< link-hextra path="/llm/providers/huggingface/" >}}), [Mistral]({{< link-hextra path="/llm/providers/mistral/" >}}), [OpenRouter]({{< link-hextra path="/llm/providers/openrouter/" >}}), [Together AI]({{< link-hextra path="/llm/providers/togetherai/" >}}), [xAI]({{< link-hextra path="/llm/providers/xai/" >}}), and [Ollama]({{< link-hextra path="/llm/providers/ollama/" >}}), use the dedicated provider pages instead.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

You also need the following prerequisites.

- An API key for your chosen provider, unless you are pointing to a local endpoint such as vLLM or LM Studio.

{{< doc-test paths="openai-compat-validate" >}}
# Install agentgateway binary for testing
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/n-patch.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"

# Set placeholder API keys for validation (--validate-only still resolves env vars)
export PERPLEXITY_API_KEY="${PERPLEXITY_API_KEY:-test}"
{{< /doc-test >}}

## Managed provider fallback

### Perplexity

[Perplexity](https://www.perplexity.ai/) exposes an OpenAI-compatible API for search-augmented models and does not currently have a first-class standalone provider shortcut.

```yaml {paths="openai-compat-validate"}
cat > /tmp/test-perplexity.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$PERPLEXITY_API_KEY"
      baseUrl: "https://api.perplexity.ai"
    backendTLS: {}
EOF
```

{{< doc-test paths="openai-compat-validate" >}}
agentgateway -f /tmp/test-perplexity.yaml --validate-only
{{< /doc-test >}}

## Self-hosted OpenAI-compatible endpoints

### vLLM

[vLLM](https://github.com/vllm-project/vllm) is a high-performance model server for self-hosted OpenAI-compatible inference.

```yaml {paths="openai-compat-validate"}
cat > /tmp/test-vllm.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      baseUrl: "http://localhost:8000/v1"
EOF
```

{{< doc-test paths="openai-compat-validate" >}}
agentgateway -f /tmp/test-vllm.yaml --validate-only
{{< /doc-test >}}

If your vLLM server uses HTTPS, set `params.baseUrl` to the HTTPS endpoint and add `backendTLS: {}` to the model configuration.

### LM Studio

[LM Studio](https://lmstudio.ai/) runs models locally and exposes an OpenAI-compatible API for desktop testing.

```yaml {paths="openai-compat-validate"}
cat > /tmp/test-lmstudio.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: llama-3.2-90b
    provider: openAI
    params:
      baseUrl: "http://localhost:1234/v1"
EOF
```

{{< doc-test paths="openai-compat-validate" >}}
agentgateway -f /tmp/test-lmstudio.yaml --validate-only
{{< /doc-test >}}

Enable the local server in LM Studio: **Settings** > **Local Server** > **Start Server**.

## Generic configuration

Use the following template for any OpenAI-compatible provider without built-in support:

```yaml
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      model: "<upstream-model-name>"
      apiKey: "$PROVIDER_API_KEY"
      baseUrl: "https://provider.example.com/v1"
    backendTLS: {}  # only for HTTPS providers
```

Set `params.baseUrl` to the provider's API root. This can include provider-specific prefixes such as `/v1`, `/openai/v1`, or another base path.

| Field | Description |
|-------|-------------|
| `provider` | Set to `openAI` for OpenAI-compatible providers without a first-class shortcut. |
| `params.model` | Optional. Override the upstream model name. Omit to pass the client-provided model through. |
| `params.apiKey` | The API key for the provider. Omit for local endpoints that do not require authentication. |
| `params.baseUrl` | The provider's API root URL, including scheme and any required base path prefix. |
| `backendTLS` | Enable TLS for the upstream connection. Required for HTTPS providers, omit for local HTTP providers. |
