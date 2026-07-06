---
title: Custom
weight: 99
description: Configure agentgateway for providers without built-in support that implement the OpenAI API format.
aliases:
  - /llm/providers/openai-compatible
  - /docs/standalone/latest/llm/providers/openai-compatible
test:
  openai-compatible-validate:
  - file: ${versionRoot}/llm/providers/custom.md
    path: openai-compat-validate
---

Use this page for providers that implement the OpenAI API format but do not have a first-class `provider:` support yet. For built-in providers such as [Baseten]({{< link-hextra path="/llm/providers/baseten/" >}}), [Cerebras]({{< link-hextra path="/llm/providers/cerebras/" >}}), [Cohere]({{< link-hextra path="/llm/providers/cohere/" >}}), [DeepInfra]({{< link-hextra path="/llm/providers/deepinfra/" >}}), [DeepSeek]({{< link-hextra path="/llm/providers/deepseek/" >}}), [Fireworks AI]({{< link-hextra path="/llm/providers/fireworks/" >}}), [Groq]({{< link-hextra path="/llm/providers/groq/" >}}), [Hugging Face]({{< link-hextra path="/llm/providers/huggingface/" >}}), [Mistral]({{< link-hextra path="/llm/providers/mistral/" >}}), [OpenRouter]({{< link-hextra path="/llm/providers/openrouter/" >}}), [Together AI]({{< link-hextra path="/llm/providers/togetherai/" >}}), [xAI]({{< link-hextra path="/llm/providers/xai/" >}}), and [Ollama]({{< link-hextra path="/llm/providers/ollama/" >}}), use the dedicated provider pages instead.

{{< callout type="info" >}}
Many providers provide "OpenAI compatible" or "Anthropic compatible" endpoints.
While these _can_ be used with `provider: openai`/`provider: anthropic` and a customized `baseUrl`, prefer to use `provider: custom`.

Using a specific vendor's provider may introduce semantics specific to that provider.
{{< /callout >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

You also need the following prerequisites.

- An API key for your chosen provider, unless you are pointing to a local endpoint such as vLLM or LM Studio.

{{< doc-test paths="openai-compat-validate" >}}
# Install agentgateway binary for testing
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}

# Set placeholder API keys for validation (--validate-only still resolves env vars)
export PERPLEXITY_API_KEY="${PERPLEXITY_API_KEY:-test}"
{{< /doc-test >}}

## Configuring a custom provider

With a custom provider, you provide the API endpoint and a list of formats it supports.
Agentgateway will automatically handle mapping between the incoming format and the supported formats.

Below shows an example of connecting to [Perplexity](https://www.perplexity.ai/), which exposes an OpenAI-compatible API for search-augmented models and does not currently have a first-class provider.

```yaml {paths="openai-compat-validate"}
cat > /tmp/test-perplexity.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider:
      custom:
        formats:
          # Indicate this provider supports the completions API. With no `path` specified, this defaults to <baseUrl>/chat/completions
          - type: completions
          # Indicate this provider supports the messages API, on a custom path /messages-api
          # - type: messages
          #   path: /messages-api
          # All possible APIs:
          # - type: embeddings
          # - type: responses
          # - type: realtime
          # - type: anthropicTokenCount
          # - type: rerank
    params:
      apiKey: "$PERPLEXITY_API_KEY"
      model: llama-3.1-sonar-large-128k-online
      baseUrl: "https://api.perplexity.ai"
EOF
```
