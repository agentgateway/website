---
title: Responses
weight: 20
description: Send requests through agentgateway using the OpenAI Responses API.
test: skip
---

The OpenAI Responses API (`/v1/responses`) is OpenAI's interface for stateful, multi-step model interactions.

## About

The [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses) is a unified interface that supports text and multimodal generation, built-in tools, and multi-turn conversation state. Agentgateway proxies these requests to your configured providers while providing token usage tracking, observability metrics, and policy enforcement.

A provider that advertises the `responses` format also serves clients that send the [Anthropic Messages]({{< link-hextra path="/documentation/llm/api-types/messages/" >}}) format. Agentgateway converts a Messages request into a Responses request, and converts the buffered or streamed reply back. For the conversion order and its limits, see [Provider format conversion]({{< link-hextra path="/documentation/llm/api-types/messages/#provider-format-conversion" >}}).

## Namespaced tools {#responses-namespaced-tools}

Responses requests can include namespace tools. When the selected provider takes Chat Completions or Bedrock Converse requests, the conversion flattens each namespace member into a function name in the `namespace__function` format. The conversion restores buffered and streamed replies to the Responses shape. Function calls keep the original `namespace` and `name` fields.

A function tool choice can use the bare member name only when that name is unique across the namespace tools. When more than one namespace has a function with the same name, set the tool choice function name to `namespace__function`. Chat Completions and Bedrock conversions cannot enforce `allowed_tools` choices or convert custom namespace members. Requests that use those features fail before they reach the provider.

## Route type configuration

In the simplified `llm` configuration, agentgateway automatically maps `/v1/responses` requests to the `responses` route type, so no explicit route configuration is required.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

To configure the route type explicitly, use the `gateways` and `routes` format and set the `responses` route type in the `policies.ai.routes` map.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 4000
routes:
- backends:
  - ai:
      name: openai
      provider:
        openAI: {}
  policies:
    ai:
      routes:
        "/v1/responses": "responses"
    backendAuth:
      key: "$OPENAI_API_KEY"
```

> [!NOTE]
> For detailed information about model routing and configuration modes, see [Model routing and aliases]({{< link-hextra path="/documentation/llm/about/" >}}).

## Using the API

Using the Responses API works exactly the same as consuming OpenAI directly, with only a change to the base URL. This allows you to continue using existing code and SDKs.

Use HTTP POST for Responses requests through agentgateway, because the Responses WebSocket transport is not supported. With the simplified `llm` configuration, a WebSocket upgrade request to `/v1/responses` returns a `405 Method Not Allowed` error with the `websocket_not_supported` code. With the `routes` format, when `policies.ai.routes` maps `/v1/responses` to `responses`, the upgrade request fails with a `400` error instead.

{{< tabs >}}
{{% tab name="Curl" %}}

```shell
curl 'http://localhost:4000/v1/responses' \
--header 'Content-Type: application/json' \
--data '{
  "model": "gpt-4o-mini",
  "input": "Tell me a story"
}'
```

{{% /tab %}}
{{% tab name="Python" %}}

> [!NOTE]
> The `api_key` parameter is required in the OpenAI library. Depending on your agentgateway configuration, it may or may not be required, and can be set to a mock value.

```python
import openai

client = openai.OpenAI(
    api_key="anything",
    base_url="http://localhost:4000/v1"
)

response = client.responses.create(
    model="gpt-4o-mini",
    input="this is a test request, write a short poem"
)

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

const response = await openai.responses.create({
  model: "gpt-4o-mini",
  input: "this is a test request, write a short poem"
});

console.log(response);
```

{{% /tab %}}
{{% tab name="Other" %}}

[View other LLM client integrations]({{< link-hextra path="/integrations/llm/clients/" >}}).

{{% /tab %}}
{{< /tabs >}}
