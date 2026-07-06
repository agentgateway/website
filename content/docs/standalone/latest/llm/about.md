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
- [Baseten]({{< link-hextra path="/llm/providers/baseten/" >}})
- [Cerebras]({{< link-hextra path="/llm/providers/cerebras/" >}})
- [DeepInfra]({{< link-hextra path="/llm/providers/deepinfra/" >}})
- [xAI (Grok)]({{< link-hextra path="/llm/providers/xai/" >}})
- [Cohere]({{< link-hextra path="/llm/providers/cohere/" >}})
- [Together AI]({{< link-hextra path="/llm/providers/togetherai/" >}})
- [Groq]({{< link-hextra path="/llm/providers/groq/" >}})
- [DeepSeek]({{< link-hextra path="/llm/providers/deepseek/" >}})
- [Mistral]({{< link-hextra path="/llm/providers/mistral/" >}})
- [Hugging Face]({{< link-hextra path="/llm/providers/huggingface/" >}})
- [OpenRouter]({{< link-hextra path="/llm/providers/openrouter/" >}})
- [Fireworks AI]({{< link-hextra path="/llm/providers/fireworks/" >}})

### Self-hosted solutions

Run models locally or in your own infrastructure:
- [Ollama]({{< link-hextra path="/llm/providers/ollama/" >}})
- [vLLM]({{< link-hextra path="/llm/providers/custom/" >}})
- [LM Studio]({{< link-hextra path="/llm/providers/custom/" >}})

### Custom providers

Use [Custom provider]({{< link-hextra path="/llm/providers/custom/" >}}) for other providers without direct support such as Perplexity, vLLM, or LM Studio.
Agentgateway supports all of the common LLM formats and can generally integrate with any provider ([file an issue](https://github.com/agentgateway/agentgateway/issues/new) if one is missing!).

## Using the API

Agentgateway exposes multiple different API endpoints, including [OpenAI Chat Completions](https://developers.openai.com/api/reference/chat-completions/overview), [Anthropic Messages](https://platform.claude.com/docs/en/api/messages), and more.
Depending on the API used in the request, and the provider selected, agentgateway can pass the request through or translate it as needed.

This enables a unified API regardless of the provider used, allowing seamlessly connecting clients (regardless of which API they use) to any provider.

Below shows some basic examples using the Chat Completions API
{{< callout type="info" >}}
For detailed configuration of specific API endpoint types, including Chat Completions and the OpenAI Realtime API, see [API types]({{< link-hextra path="/llm/api-types/" >}}).
{{< /callout >}}

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

{{< callout type="info" >}}
The `api_key` parameter is required in the OpenAI library.
Depending on your agentgateway configuration, it may or may not be required, and can be set to a mock value.
{{< /callout >}}

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

## Model routing and aliases

Model routing is configured within the `llm` section of your agentgateway configuration file. 
The `llm` section offers a simplified, model-centric approach compared to the traditional `binds/listeners/routes` model; for more details on the two approaches, see [LLM configuration modes]({{< link-hextra path="/llm/configuration-modes/" >}}).
The model configurations shown in this section live under the `llm.models` key.

Agentgateway routes requests by matching an incoming model name, and then sending it to the configured model.
The outgoing model can be passed through from the incoming model, be transformed, or be a static model.

Some examples:

* Match `fast` and send to `gpt-mini`.
* Match `*` and forward the model as-is.
* Match `openai/*` and strip the `openai/` prefix, forwarding the remaining model as-is.

| Field | Purpose |
|-------|---------|
| `models.name` | The model name to match in incoming client requests. Agentgateway compares this value against the `model` field in the request body. Use a wildcard `*` to match any model name. |
| `params.model` | The model name sent to the upstream provider. If set, this overrides the model from the request. If not set, the model from the request is passed through. |

### Passthrough

Use `name: "*"` without setting `params.model` to accept any model name and pass it directly to the provider. This is the simplest configuration for single-provider setups.

```yaml
llm:
  models:
  - name: "*"
    provider: openai
    params:
      apiKey: "$OPENAI_API_KEY"
```

Clients specify the actual model in their requests, such as `"model": "gpt-4o-mini"`, and agentgateway forwards it to the provider as-is.

### Prefixed Passthrough

Use `name: "openai/*"` without setting `params.model` to accept model requests like `openai/gpt-4o-mini` and forward to OpenAI as `gpt-4o-mini`.
This is the recommended approach when you want to expose all models from multiple providers.

```yaml
llm:
  models:
  - name: "*"
    provider: openai
    params:
      apiKey: "$OPENAI_API_KEY"
    transformation:
      model: llmRequest.model.stripPrefix("openai/")
```

Clients specify the provider and model in their requests, such as `"model": "openai/gpt-4o-mini"`, and agentgateway forwards to `gpt-4o-mini`

### Model aliases

Set `name` to a user-friendly alias and `params.model` to the actual provider model.
This lets you decouple client-facing model names from provider-specific identifiers, making it easier to swap models without updating client code.

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

### Route priority

When multiple models match a request, the more precise match takes precedence.
For example, with the configuration below, requests with `accounts/fireworks/*` will match the `fireworks` provider first:

```yaml
llm:
  models:
  # Specific route: wins ties against the wildcard
  - name: "accounts/fireworks/*"
    provider: fireworks
    matches:
    - headers:
      - name: "x-org"
        value:
          exact: "eng"
    params:
      apiKey: "$FIREWORKS_API_KEY"
  # Catch-all route: matches anything, but lower priority
  - name: "*"
    provider: openAI
    matches:
    - headers:
      - name: "x-org"
        value:
          exact: "engineering"
    params:
      apiKey: "$OPENAI_API_KEY"
```

In this example, both routes have one header matcher, so they have equal specificity. Because the Fireworks route is listed first, it takes priority when both routes match.

{{< callout type="info" >}}
For advanced routing based on request body fields like the `model` name, see [Virtual models]({{< link-hextra path="/llm/virtual-models/" >}}).
{{< /callout >}}
