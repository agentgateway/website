---
title: About
weight: 1
description: Overview of supported LLM providers and their capabilities
next: /llm/providers
prev: /llm
test: skip
---

Agentgateway provides seamless integration with various Large Language Model (LLM) providers. This way, you can consume AI services through a unified interface while still maintaining flexibility in the providers that you use.

{{< reuse "agw-docs/snippets/about-llm.md" >}}

## Supported providers

Agentgateway supports native, OpenAI-compatible, and self-hosted LLM providers.

### Native providers

{{< reuse "agw-docs/snippets/llm-comparison.md" >}}

### First-class providers

Many providers now have dedicated integrations with preconfigured base URLs and request formats:
- [Baseten]({{< link-hextra path="/integrations/llm/providers/baseten/" >}})
- [Cerebras]({{< link-hextra path="/integrations/llm/providers/cerebras/" >}})
- [DeepInfra]({{< link-hextra path="/integrations/llm/providers/deepinfra/" >}})
- [xAI (Grok)]({{< link-hextra path="/integrations/llm/providers/xai/" >}})
- [Cohere]({{< link-hextra path="/integrations/llm/providers/cohere/" >}})
- [Together AI]({{< link-hextra path="/integrations/llm/providers/togetherai/" >}})
- [Groq]({{< link-hextra path="/integrations/llm/providers/groq/" >}})
- [DeepSeek]({{< link-hextra path="/integrations/llm/providers/deepseek/" >}})
- [Mistral]({{< link-hextra path="/integrations/llm/providers/mistral/" >}})
- [Hugging Face]({{< link-hextra path="/integrations/llm/providers/huggingface/" >}})
- [OpenRouter]({{< link-hextra path="/integrations/llm/providers/openrouter/" >}})
- [Fireworks AI]({{< link-hextra path="/integrations/llm/providers/fireworks/" >}})
- [Meta]({{< link-hextra path="/integrations/llm/providers/meta/" >}})

### Self-hosted solutions

Run models locally or in your own infrastructure:
- [Ollama]({{< link-hextra path="/integrations/llm/providers/ollama/" >}})
- [vLLM]({{< link-hextra path="/integrations/llm/providers/custom/" >}})
- [LM Studio]({{< link-hextra path="/integrations/llm/providers/custom/" >}})

### Custom providers

Use [Custom provider]({{< link-hextra path="/integrations/llm/providers/custom/" >}}) for other providers without direct support such as Perplexity, vLLM, or LM Studio.
Agentgateway supports all of the common LLM formats and can generally integrate with any provider ([file an issue](https://github.com/agentgateway/agentgateway/issues/new) if one is missing!).

## Using the API

Agentgateway exposes multiple different API endpoints, including [OpenAI Chat Completions](https://developers.openai.com/api/reference/chat-completions/overview), [Anthropic Messages](https://platform.claude.com/docs/en/api/messages), and more.
Depending on the API used in the request, and the provider selected, agentgateway can pass the request through or translate it as needed.

This enables a unified API regardless of the provider used, allowing seamlessly connecting clients (regardless of which API they use) to any provider.

Below shows some basic examples using the Chat Completions API
> [!NOTE]
> For detailed configuration of specific API endpoint types, including Chat Completions and the OpenAI Realtime API, see [API types]({{< link-hextra path="/documentation/llm/api-types/" >}}).

{{< tabs >}}
{{% tab name="Curl" %}}

```shell
curl 'http://localhost:4000/v1/chat/completions' \
--header 'Content-Type: application/json' \
--data ' {
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "user",
      "content": "Tell me a story"
    }
  ]
}
'
```

{{% /tab %}}
{{% tab name="Python" %}}

> [!NOTE]
> The `api_key` parameter is required in the OpenAI library.
> Depending on your agentgateway configuration, it may or may not be required, and can be set to a mock value.

```python
import openai

client = openai.OpenAI(
    api_key="anything",
    base_url="http://localhost:4000/v1"
)

response = client.chat.completions.create(model="gpt-4o-mini", messages = [
    {
        "role": "user",
        "content": "this is a test request, write a short poem"
    }
])

print(response)
```

{{% /tab %}}
{{% tab name="JavaScript" %}}

```javascript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: "anything",
  baseURL: "http://localhost:4000/v1",
});
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "this is a test request, write a short poem" }]
});

console.log(response);
```

{{% /tab %}}
{{< /tabs >}}

### Query strings on converted requests

A client query string belongs to the API format that the client called. For the Chat Completions, Messages, Responses, and Gemini formats, the client query string is kept when the provider receives the same format, and is dropped when the request is converted to another format. For example, a Messages request to `/v1/messages?beta=true` that is converted to Chat Completions for a Gemini provider reaches the provider without `?beta=true`.

These cases differ:

- An Amazon Bedrock request on the Runtime endpoint always drops the client query string, because Runtime serves only the Bedrock APIs.
- A built-in provider that sets `params.hostOverride` without `params.pathPrefix` receives the client path and query string unchanged. This provider path prefix is a different setting from `llm.pathPrefix`, which sets the base path that clients call.
- A request on a path that is forwarded without format conversion keeps the client query string.

## Model routing and aliases

Model routing is configured within the `llm` section of your agentgateway configuration file. 
The `llm` section offers a simplified, model-centric approach compared to the `gateways` and `routes` model; for more details on the two approaches, see [LLM configuration modes]({{< link-hextra path="/documentation/llm/configuration-modes/" >}}).
The model configurations shown in this section live under the `llm.models` key.

Agentgateway routes requests by matching an incoming model name, and then sending it to the configured model.
The outgoing model can be passed through from the incoming model, be transformed, or be a static model.

To compare matching patterns, see [Choose how to expose models](#choose-how-to-expose-models).

| Field | Purpose |
|-------|---------|
| `models.name` | The model name to match in incoming client requests. Agentgateway compares this value against the `model` field in the request body. Use a wildcard `*` to match any model name. |
| `params.model` | The model name sent to the upstream provider. If set, this overrides the model from the request. If not set, the model from the request is passed through. |
| `transformation.model` | CEL expression for the upstream model name, such as `llmRequest.model.stripPrefix("openai/")`. Runs after `params.model` and overrides its value. |

Agentgateway recognizes the standard LLM serving paths, such as `/v1/chat/completions`, `/v1/messages`, `/v1/responses`, `/v1/audio/transcriptions`, and `/v1/models`, only when the request path matches exactly. Provider-specific paths that carry the model in the path, such as the Gemini and Vertex AI `:generateContent` paths, match by their pattern instead. A request to any other path, such as `/other/v1/messages` or `/v1/messages/extra`, is not rejected. Agentgateway still selects the model from the request body, but forwards the request to the provider as passthrough, without format conversion and without the `params.model` override.

To serve the standard LLM paths under a base path, set `llm.pathPrefix`. For example, `pathPrefix: /tenant-a` lets clients call `/tenant-a/v1/chat/completions`. The gateway removes `/tenant-a` before model routing and before forwarding the request to the provider, and returns a `404` error for requests outside the prefix. The prefix must start with `/`, and cannot include a query or a fragment. You can set only one prefix, and a trailing slash is ignored.

When the selected model changes the upstream model name, the gateway rewrites the model before forwarding the request. The rewrite applies to JSON request bodies and multipart form data, such as `/v1/audio/transcriptions`. For multipart requests, file fields and non-model fields are preserved while each `model` form field is rewritten.

{{< reuse "agw-docs/pages/agentgateway/llm/model-exposure-patterns.md" >}}
