---
title: About
weight: 1
description: Overview of supported LLM providers and their capabilities
next: /docs/llm/providers
prev: /docs/llm
---

Agentgateway provides seamless integration with various Large Language Model (LLM) providers. This way, you can consume AI services through a unified interface while still maintaining flexibility in the providers that you use.

{{< reuse "agw-docs/snippets/about-llm.md" >}}

## Supported providers

Review the following table for a list of supported LLM providers.

{{< callout type="info" >}}
Don't see your provider? You might still be able to use it with agentgateway! Many LLM providers offer OpenAI-compatible APIs. To get started, follow the [OpenAI compatible](providers/openai-compatible) docs.
{{< /callout >}}

| Provider                  | Chat Completions | Streaming |
|---------------------------|:---------------:|:---------:|
| [OpenAI](../providers/openai)          | ✅           | ✅         |
| [Vertex AI](../providers/vertex)       | ✅           | ✅         |
| [Gemini](../providers/gemini)          | ✅           | ✅         |
| [Amazon Bedrock](../providers/bedrock) | ✅           | ✅         |
| [Anthropic](../providers/anthropic)    | ✅           | ✅         |
| [OpenAI compatible](../providers/openai-compatible)    | ✅           | ✅         |

* Chat Completions: support for the `/v1/chat/completions` API.
* Streaming: support for streaming (`"stream": true`) in the completions request)

## Using the API

Requests to agentgateway always use the [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/create) API.
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
Depending on your agentgateway configuration, it may or may not be required, and can be set to a dummy value.
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

