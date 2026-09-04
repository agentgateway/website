---
title: Messages
weight: 30
description: Send requests through agentgateway using the Anthropic Messages API.
test: skip
---

The Anthropic Messages API (`/v1/messages`) is the native interface for Anthropic Claude models.

## About

The [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages) is the primary endpoint for Claude models.
Agentgateway proxies these requests to your configured providers while providing token usage tracking, observability metrics, and policy enforcement.

When using the Anthropic provider, Agentgateway automatically handles additional requirements, such as the `x-api-key` and `anthropic-version` headers that the Anthropic API requires.

The related [`/v1/messages/count_tokens`]({{< link-hextra path="/llm/api-types/token-count/" >}}) endpoint estimates token usage before sending a request and is handled by the `anthropicTokenCount` route type.

## Route type configuration

In the simplified `llm` configuration, agentgateway automatically maps `/v1/messages` requests to the `messages` route type, so no explicit route configuration is required.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: anthropic
    params:
      apiKey: "$ANTHROPIC_API_KEY"
```

To configure the route type explicitly, use the `gateways` and `routes` format and set the `messages` route type in the `policies.ai.routes` map. To also support token counting, map `/v1/messages/count_tokens` to the `anthropicTokenCount` route type.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 4000
routes:
- backends:
  - ai:
      name: anthropic
      provider:
        anthropic: {}
  policies:
    ai:
      routes:
        "/v1/messages": "messages"
        "/v1/messages/count_tokens": "anthropicTokenCount"
    backendAuth:
      key: "$ANTHROPIC_API_KEY"
```

> [!NOTE]
> For detailed information about model routing and configuration modes, see [Model routing and aliases]({{< link-hextra path="/llm/about/" >}}).

## Provider format conversion

A Messages request does not need a provider that speaks the Anthropic Messages format. When the selected provider advertises a different format, agentgateway converts the request on the way out and converts the reply back into the Messages shape, so the client receives Anthropic responses either way.

Agentgateway uses the first of these formats that the provider supports.

| Order | Provider format | What happens |
|-------|-----------------|--------------|
| 1 | `messages` | The request is sent natively, with no conversion. |
| 2 | `completions` | The request is converted to the OpenAI Chat Completions format. |
| 3 | `responses` | The request is converted to the OpenAI Responses format. |
| 4 | Bedrock Converse | The request is converted to the Amazon Bedrock Converse format. |

The first three rows are values that a `custom` provider declares in its `formats` list. Bedrock Converse is not one of those values. A [`bedrock` provider]({{< link-hextra path="/llm/providers/bedrock/" >}}) supports the Converse format and nothing else, so a Messages request that is routed to a Bedrock provider always takes the Converse conversion.

Because `completions` comes before `responses`, a provider that advertises both is unaffected by the Responses conversion. That conversion applies to a provider that advertises `responses` and not `completions`.

### Converting to the Responses format

The Responses conversion covers a common agent subset:

- Text and system instructions
- Image inputs, supplied by URL, base64 data, or file ID
- Function tools, tool choice, and the parallel tool-call preference
- Assistant tool-use history, and tool results that are text
- Structured output JSON schemas
- Prompt cache breakpoints
- Streaming and usage reporting

> [!WARNING]
> The Responses format has no equivalent for `stop_sequences` or `top_k`. Agentgateway accepts both fields and drops them, with no error and no warning to the client. A request that relies on a stop sequence to end generation behaves differently against a provider that advertises only `responses`.

A Messages feature that the Responses format cannot represent at all fails before the upstream request is sent, and returns a `400` with an `unsupported conversion` message. These features fail this way:

- Thinking and redacted-thinking history
- Document, search-result, and server-tool content blocks
- Tool results that are not text

## Using the API

Send a request to the `/v1/messages` endpoint. The request is forwarded to the Anthropic API and the response is returned to the client.

{{< tabs >}}
{{% tab name="Curl" %}}

```shell
curl -X POST http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4-6",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

{{% /tab %}}
{{% tab name="Other" %}}

[View other LLM client integrations]({{< link-hextra path="/integrations/llm-clients/" >}}).

{{% /tab %}}
{{< /tabs >}}

For Anthropic-specific features such as token counting, extended thinking, and structured outputs, see the [Anthropic provider]({{< link-hextra path="/llm/providers/anthropic/" >}}) guide.
