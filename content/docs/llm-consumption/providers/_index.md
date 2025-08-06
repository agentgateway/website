---
title: Providers
weight: 10
description: Overview of supported LLM providers and their capabilities
---

Agentgateway supports many different LLM providers.
Requests to agentgateway always use the [OpenAI Chat Completions](https://platform.openai.com/docs/api-reference/chat/create) API.
These requests and translated to upstream providers API.

| Provider                  | Chat Completions | Streaming |
|---------------------------|-------------|-----------|
| [OpenAI](openai)          | ✅           | ✅         |
| [Vertex AI](vertex)       | ✅           | ✅         |
| [Gemini](gemini)          | ✅           | ✅         |
| [Amazon Bedrock](bedrock) | ✅           | ✅         |
| [Anthropic](anthropic)    | ✅           | ✅         |
| [OpenAI compatible](openai-compatible)    | ✅           | ✅         |

* Chat Completions: support for the `/v1/chat/completions` API.
* Streaming: support for streaming (`"stream": true` in the completions request)

If your provider is not listed, it may still be compatible with agentgateway!
Many providers offer OpenAI compatible APIs, which can be used with agentgateway; check with your provider and follow the [OpenAI compatible](openai-compatible) docs to get started.

## Using the API

Usage of the completions API works exactly the same as consuming OpenAI, with a change to the base URL.
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

Note: the `api_key` parameter is required in the OpenAI library.
Depending on your agentgateway configuration, it may or may not be required, and can be set to a dummy value.

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

