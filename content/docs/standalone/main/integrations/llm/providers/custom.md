---
title: Custom
weight: 99
description: Configure agentgateway for providers without built-in support that implement the OpenAI API format.
aliases:
  - /docs/standalone/main/llm/providers/openai-compatible
  - /docs/standalone/main/documentation/llm/providers/openai-compatible
test:
  openai-compatible-validate:
  - file: ${versionRoot}/integrations/llm/providers/custom.md
    path: openai-compat-validate
---

Use this page for providers that implement the OpenAI API format but do not have a first-class `provider:` support yet. For built-in providers such as [Baseten]({{< link-hextra path="/integrations/llm/providers/baseten/" >}}), [Cerebras]({{< link-hextra path="/integrations/llm/providers/cerebras/" >}}), [Cohere]({{< link-hextra path="/integrations/llm/providers/cohere/" >}}), [DeepInfra]({{< link-hextra path="/integrations/llm/providers/deepinfra/" >}}), [DeepSeek]({{< link-hextra path="/integrations/llm/providers/deepseek/" >}}), [Fireworks AI]({{< link-hextra path="/integrations/llm/providers/fireworks/" >}}), [Groq]({{< link-hextra path="/integrations/llm/providers/groq/" >}}), [Hugging Face]({{< link-hextra path="/integrations/llm/providers/huggingface/" >}}), [Mistral]({{< link-hextra path="/integrations/llm/providers/mistral/" >}}), [OpenRouter]({{< link-hextra path="/integrations/llm/providers/openrouter/" >}}), [Together AI]({{< link-hextra path="/integrations/llm/providers/togetherai/" >}}), [xAI]({{< link-hextra path="/integrations/llm/providers/xai/" >}}), and [Ollama]({{< link-hextra path="/integrations/llm/providers/ollama/" >}}), use the dedicated provider pages instead.

> [!NOTE]
> Many providers provide "OpenAI compatible" or "Anthropic compatible" endpoints.
> While these _can_ be used with `provider: openai`/`provider: anthropic` and a customized `baseUrl`, prefer to use `provider: custom`.
>
> Using a specific vendor's provider may introduce semantics specific to that provider.

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

With a custom provider, you provide the API endpoint. You can also provide a
list of formats that the provider supports. Agentgateway maps the incoming
format to one of the supported formats when the list is present.

The `formats` list decides which conversion an incoming request takes, and the conversions do not all carry the same feature set. A provider that declares `completions` carries extended-thinking history across turns, while one that declares `responses` and not `completions` drops it without an error. For what each conversion keeps and drops, see [Provider format conversion]({{< link-hextra path="/documentation/llm/api-types/messages/#provider-format-conversion" >}}).

Omit `formats` when the provider uses request paths that agentgateway detects
directly, such as `/v1/systemone`, or when the provider should receive only
paths that it already understands. A provider with no `formats` list is not a
conversion target for other client request formats.

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
          # - type: generateContent
          # - type: geminiCountTokens
          # - type: rerank
    params:
      apiKey: "$PERPLEXITY_API_KEY"
      model: llama-3.1-sonar-large-128k-online
      baseUrl: "https://api.perplexity.ai"
EOF
```
