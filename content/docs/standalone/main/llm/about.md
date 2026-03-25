---
title: About
weight: 1
description: Overview of supported LLM providers and their capabilities
next: /llm/providers
prev: /llm
---

Agentgateway provides seamless integration with various Large Language Model (LLM) providers. This way, you can consume AI services through a unified interface while still maintaining flexibility in the providers that you use.

{{< reuse "agw-docs/snippets/about-llm.md" >}}

## Supported providers

Agentgateway supports three categories of LLM providers:

### Native providers

These providers have first-class support with dedicated configuration:
- [OpenAI]({{< link-hextra path="/llm/providers/openai/" >}})
- [Anthropic]({{< link-hextra path="/llm/providers/anthropic/" >}})
- [Google Gemini]({{< link-hextra path="/llm/providers/gemini/" >}})
- [Google Vertex AI]({{< link-hextra path="/llm/providers/vertex/" >}})
- [Amazon Bedrock]({{< link-hextra path="/llm/providers/bedrock/" >}})
- [Azure OpenAI]({{< link-hextra path="/llm/providers/azure/" >}})

### OpenAI-compatible providers

Many providers offer OpenAI-compatible endpoints that work seamlessly with agentgateway:
- [xAI (Grok)]({{< link-hextra path="/llm/providers/openai-compatible/#xai-grok" >}})
- [Cohere]({{< link-hextra path="/llm/providers/openai-compatible/#cohere" >}})
- [Together AI]({{< link-hextra path="/llm/providers/openai-compatible/#together-ai" >}})
- [Groq]({{< link-hextra path="/llm/providers/openai-compatible/#groq" >}})
- [DeepSeek]({{< link-hextra path="/llm/providers/openai-compatible/#deepseek" >}})
- [Mistral]({{< link-hextra path="/llm/providers/openai-compatible/#mistral" >}})
- [Perplexity]({{< link-hextra path="/llm/providers/openai-compatible/#perplexity" >}})
- [Fireworks AI]({{< link-hextra path="/llm/providers/openai-compatible/#fireworks-ai" >}})

### Self-hosted solutions

Run models locally or in your own infrastructure:
- [Ollama]({{< link-hextra path="/llm/providers/ollama/" >}})
- [vLLM]({{< link-hextra path="/llm/providers/openai-compatible/#vllm" >}})
- [LM Studio]({{< link-hextra path="/llm/providers/openai-compatible/#lm-studio" >}})

{{< callout type="info" >}}
Don't see your provider? You might still be able to use it with agentgateway! Many LLM providers offer OpenAI-compatible APIs. To get started, follow the [OpenAI compatible]({{< link-hextra path="/llm/providers/openai-compatible/" >}}) docs.
{{< /callout >}}

{{< reuse "agw-docs/snippets/llm-comparison.md" >}}

## Using the API

By default, requests to agentgateway use the [OpenAI Chat Completions](https://developers.openai.com/api/reference/chat-completions/overview) API.
These requests are translated to the upstream provider's API.

Using the Chat Completions API works exactly the same as consuming OpenAI, with a change to the base URL.
This allows you to continue using existing code and SDKs.

{{< tabs items="Curl,Python,JavaScript" >}}
{{% tab %}}

```shell
curl 'http://0.0.0.0:3000/' \
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
{{% tab %}}

{{< callout type="info" >}}
The `api_key` parameter is required in the OpenAI library.
Depending on your agentgateway configuration, it may or may not be required, and can be set to a mock value.
{{< /callout >}}

```python
import openai

client = openai.OpenAI(
    api_key="anything",
    base_url="http://0.0.0.0:3000"
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
{{% tab %}}

```javascript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: "anything",
  baseURL: "http://0.0.0.0:3000",
});
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "this is a test request, write a short poem" }]
});

console.log(response);
```

{{% /tab %}}
{{< /tabs >}}

## Model routing and aliases

When you configure a model in the `llm` section, two fields control how requests are routed, as shown in the following table.

| Field | Purpose |
|-------|---------|
| `models.name` | The model name to match in incoming client requests. Agentgateway compares this value against the `model` field in the request body. Use a wildcard `*` to match any model name. |
| `params.model` | The model name sent to the upstream provider. If set, this overrides the model from the request. If not set, the model from the request is passed through. |

### Pass-through mode

Use `name: "*"` without setting `params.model` to accept any model name and pass it directly to the provider. This is the simplest configuration for single-provider setups.

```yaml
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

Clients specify the actual model in their requests, such as `"model": "gpt-4o-mini"`, and agentgateway forwards it to the provider as-is.

### Model aliases

Set `name` to a user-friendly alias and `params.model` to the actual provider model. This lets you decouple client-facing model names from provider-specific identifiers, making it easier to swap models without updating client code.

```yaml
llm:
  models:
  - name: fast
    provider: openAI
    params:
      model: gpt-4o-mini
      apiKey: "$OPENAI_API_KEY"
  - name: smart
    provider: openAI
    params:
      model: gpt-4o
      apiKey: "$OPENAI_API_KEY"
```

Clients send `"model": "fast"` or `"model": "smart"`, and agentgateway translates these to the corresponding provider models.

