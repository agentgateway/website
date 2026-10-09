---
title: Custom
weight: 99
description: Configure agentgateway for providers without built-in support that implement the OpenAI API format.
aliases:
  - ../../../llm/providers/openai-compatible
  - ../../../documentation/llm/providers/openai-compatible
test:
  openai-compatible-validate:
  - file: ${versionRoot}/integrations/llm/providers/custom.md
    path: openai-compat-validate
---

Use this page for providers that implement the OpenAI API format but do not have a first-class `provider:` support yet. For built-in providers such as [Baseten]({{< link-hextra path="/integrations/llm/providers/baseten/" >}}), [Cerebras]({{< link-hextra path="/integrations/llm/providers/cerebras/" >}}), [Cohere]({{< link-hextra path="/integrations/llm/providers/cohere/" >}}), [DeepInfra]({{< link-hextra path="/integrations/llm/providers/deepinfra/" >}}), [DeepSeek]({{< link-hextra path="/integrations/llm/providers/deepseek/" >}}), [Fireworks AI]({{< link-hextra path="/integrations/llm/providers/fireworks/" >}}), [Groq]({{< link-hextra path="/integrations/llm/providers/groq/" >}}), [Hugging Face]({{< link-hextra path="/integrations/llm/providers/huggingface/" >}}), [Meta]({{< link-hextra path="/integrations/llm/providers/meta/" >}}), [Mistral]({{< link-hextra path="/integrations/llm/providers/mistral/" >}}), [OpenRouter]({{< link-hextra path="/integrations/llm/providers/openrouter/" >}}), [Together AI]({{< link-hextra path="/integrations/llm/providers/togetherai/" >}}), [xAI]({{< link-hextra path="/integrations/llm/providers/xai/" >}}), and [Ollama]({{< link-hextra path="/integrations/llm/providers/ollama/" >}}), use the dedicated provider pages instead.

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

With a custom provider, you provide the API endpoint and a list of formats it supports.
Agentgateway will automatically handle mapping between the incoming format and the supported formats.

The `formats` list controls how agentgateway converts incoming requests. Each conversion supports different features. For Messages requests, agentgateway prefers `responses` over `completions`. The Responses conversion drops extended-thinking history without an error. To preserve thinking history across turns, declare `completions` and omit `responses`.

Declare only the formats that the upstream server supports. For example, include `responses` only if the server supports `/v1/responses`. Include `decisions` only if the server supports `/v1/decisions`. For details about each conversion, see [Provider format conversion]({{< link-hextra path="/documentation/llm/api-types/messages/#provider-format-conversion" >}}).

An error such as `failed to parse Messages request` names the route type that parsed the client request before provider conversion. Check that the request path maps to the expected route type and that the body matches that format.

Converted response usage follows the API format that the client called. Messages responses use Anthropic usage conventions. In that format, `usage.input_tokens` excludes prompt-cache tokens. Chat Completions and Responses replies use OpenAI usage conventions. In those formats, the main input count includes prompt-cache tokens.

The `formats` list is optional. A model without it accepts only requests on paths that are forwarded to the provider without format conversion, such as `/v1/systemone`, `/v1/ocr`, `/v1/images/generations`, and `/v1/responses/compact`. A request in an LLM API format, such as a chat completions or messages request, has no format to convert to and is rejected. For an example, see the [Jev guardrail guide]({{< link-hextra path="/integrations/llm/guardrails/jev/" >}}).

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
          # - type: decisions
    params:
      apiKey: "$PERPLEXITY_API_KEY"
      model: llama-3.1-sonar-large-128k-online
      baseUrl: "https://api.perplexity.ai"
EOF
```
