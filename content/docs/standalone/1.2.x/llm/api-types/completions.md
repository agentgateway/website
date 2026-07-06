---
title: Chat completions
weight: 10
description: Send chat completion requests through agentgateway using the OpenAI Chat Completions API.
test: skip
---

The OpenAI Chat Completions API (`/v1/chat/completions`) is the primary interface for text generation and chat applications in agentgateway.

## About

The [OpenAI Chat Completions API](https://developers.openai.com/api/docs/guides/text) is the most widely used LLM endpoint. Agentgateway proxies these requests to your configured providers while providing token usage tracking, observability metrics, and policy enforcement.

By default, requests to agentgateway use the Chat Completions API. These requests are translated to the upstream provider's native API format when necessary.

## Route type configuration

In the simplified `llm` configuration, agentgateway automatically maps `/v1/chat/completions` requests to the `completions` route type, so no explicit route configuration is required.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

To configure the route type explicitly, use the `binds/listeners/routes` format and set the `completions` route type in the `policies.ai.routes` map.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 4000
  listeners:
  - routes:
    - backends:
      - ai:
          name: openai
          provider:
            openAI: {}
      policies:
        ai:
          routes:
            "/v1/chat/completions": "completions"
        backendAuth:
          key: "$OPENAI_API_KEY"
```

{{< callout type="info" >}}
For detailed information about model routing and configuration modes, see [Model routing and aliases]({{< link-hextra path="/llm/about/" >}}).
{{< /callout >}}

## Using the API

Using the Chat Completions API works exactly the same as consuming OpenAI directly, with only a change to the base URL. This allows you to continue using existing code and SDKs.

{{< tabs >}}
{{% tab name="Curl" %}}

```shell
curl 'http://localhost:4000/v1/chat/completions' \
--header 'Content-Type: application/json' \
--data '{
  "model": "gpt-4o-mini",
  "messages": [
    {
      "role": "user",
      "content": "Tell me a story"
    }
  ]
}'
```

{{% /tab %}}
{{% tab name="Python" %}}

{{< callout type="info" >}}
The `api_key` parameter is required in the OpenAI library. Depending on your agentgateway configuration, it may or may not be required, and can be set to a mock value.
{{< /callout >}}

```python
import openai

client = openai.OpenAI(
    api_key="anything",
    base_url="http://localhost:4000"
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {
            "role": "user",
            "content": "this is a test request, write a short poem"
        }
    ]
)

print(response)
```

{{% /tab %}}
{{% tab name="JavaScript" %}}

```javascript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: "anything",
  baseURL: "http://localhost:4000",
});

const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "this is a test request, write a short poem" }]
});

console.log(response);
```

{{% /tab %}}
{{< /tabs >}}

## Token usage tracking

After sending Chat Completions requests, verify that agentgateway recorded token usage metrics.

1. Open the agentgateway [metrics endpoint](http://localhost:15020/metrics).
2. Look for the `agentgateway_gen_ai_client_token_usage` metric. The metric includes labels for the token type (`input` or `output`) and the model used.

For more information about LLM metrics and observability, see [Observe traffic]({{< link-hextra path="/llm/observability/" >}}).
