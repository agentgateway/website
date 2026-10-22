---
title: Custom
weight: 99
description: Configure agentgateway for providers without built-in support that use an LLM API format.
aliases:
  - ../../../llm/providers/openai-compatible
  - ../../../documentation/llm/providers/openai-compatible
test:
  openai-compatible-validate:
  - file: ${versionRoot}/integrations/llm/providers/custom.md
    path: openai-compat-validate
---

Use this page for providers that use an LLM API format but do not have first-class `provider:` support. For built-in providers such as [Baseten]({{< link-hextra path="/integrations/llm/providers/baseten/" >}}), [Cerebras]({{< link-hextra path="/integrations/llm/providers/cerebras/" >}}), [Cohere]({{< link-hextra path="/integrations/llm/providers/cohere/" >}}), [DeepInfra]({{< link-hextra path="/integrations/llm/providers/deepinfra/" >}}), [DeepSeek]({{< link-hextra path="/integrations/llm/providers/deepseek/" >}}), [Fireworks AI]({{< link-hextra path="/integrations/llm/providers/fireworks/" >}}), [GitHub Copilot]({{< link-hextra path="/integrations/llm/providers/copilot/" >}}), [Groq]({{< link-hextra path="/integrations/llm/providers/groq/" >}}), [Hugging Face]({{< link-hextra path="/integrations/llm/providers/huggingface/" >}}), [Meta]({{< link-hextra path="/integrations/llm/providers/meta/" >}}), [Mistral]({{< link-hextra path="/integrations/llm/providers/mistral/" >}}), [OpenRouter]({{< link-hextra path="/integrations/llm/providers/openrouter/" >}}), [Perplexity]({{< link-hextra path="/integrations/llm/providers/perplexity/" >}}), [Together AI]({{< link-hextra path="/integrations/llm/providers/togetherai/" >}}), [xAI]({{< link-hextra path="/integrations/llm/providers/xai/" >}}), and [Ollama]({{< link-hextra path="/integrations/llm/providers/ollama/" >}}), use the dedicated provider pages instead.

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
export CUSTOM_PROVIDER_API_KEY="${CUSTOM_PROVIDER_API_KEY:-test}"
{{< /doc-test >}}

## Configuring a custom provider

With a custom provider, you provide the API endpoint and a list of formats it supports.
Agentgateway will automatically handle mapping between the incoming format and the supported formats.

The `formats` list controls how agentgateway converts incoming requests. Each conversion supports different features. For Messages requests, agentgateway prefers `responses` over `completions`. The Responses conversion drops extended-thinking history without an error. To preserve thinking history across turns, declare `completions` and omit `responses`.

Declare only the formats that the upstream server supports. For example, include `responses` only if the server supports `/v1/responses`. For details about each conversion, see [Provider format conversion]({{< link-hextra path="/documentation/llm/api-types/messages/#provider-format-conversion" >}}).

An error such as `failed to parse Messages request` names the route type that parsed the client request before provider conversion. Check that the request path maps to the expected route type and that the body matches that format.

Converted response usage follows the API format that the client called. Messages responses use Anthropic usage conventions. In that format, `usage.input_tokens` excludes prompt-cache tokens. Chat Completions and Responses replies use OpenAI usage conventions. In those formats, the main input count includes prompt-cache tokens. When a Gemini OpenAI-compatible response reports reasoning tokens separately from `usage.completion_tokens`, converted Messages and Responses replies include visible output and reasoning tokens in `usage.output_tokens`.

The `formats` list is optional. A model without it accepts only requests on paths that are forwarded to the provider without format conversion, such as `/v1/systemone`, `/v1/ocr`, `/v1/images/generations`, and `/v1/responses/compact`. A request in an LLM API format, such as a chat completions or messages request, has no format to convert to and is rejected. For an example, see the [Jev guardrail guide]({{< link-hextra path="/integrations/llm/guardrails/jev/" >}}).

The following example configures a provider that exposes a Chat Completions API at the standard path.

{{< tabs >}}
{{% tab name="UI" %}}
To add the model in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps. The steps create the same model as the **Config file** tab.

1. Set your API key in the `PERPLEXITY_API_KEY` environment variable. The UI checks that the variable exists when you save the model.

   ```sh
   export PERPLEXITY_API_KEY='<your-api-key>'
   ```

2. {{< reuse "agw-docs/standalone/llm/providers/ui-start-empty-llm.md" >}}
3. Open **LLM** > **Models**, such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
4. From the **Provider** dropdown, select **Custom**.
5. In the **Incoming model match** field, replace the default `custom/*` with `*`.
6. For the **Provider API key**, select **Env var**, and enter `PERPLEXITY_API_KEY`.
7. In the **Custom provider** section, enter `https://api.perplexity.ai` for the **Base URL**.
8. In the **Route formats** list, keep **Chat completions (/chat/completions)** selected. Select any other format that the upstream supports, and optionally enter a path override for it.
9. For the **Outgoing model**, select **Explicit**, and enter `llama-3.1-sonar-large-128k-online`.

   {{< reuse-image src="img/ui-llm-add-model-custom-perplexity.png" srcDark="img/ui-llm-add-model-custom-perplexity-dark.png" alt="Add model drawer with Custom selected as the provider, the * wildcard as the incoming model match, PERPLEXITY_API_KEY as the environment variable for the provider API key, and https://api.perplexity.ai as the base URL" >}}

10. Click **Save model**.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml {paths="openai-compat-validate"}
cat > /tmp/test-custom-provider.yaml << 'EOF'
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
      apiKey: "$CUSTOM_PROVIDER_API_KEY"
      model: example-chat-model
      baseUrl: "https://api.example.com"
EOF
```
{{% /tab %}}
{{< /tabs >}}
