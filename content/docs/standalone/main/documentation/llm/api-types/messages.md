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

The related [`/v1/messages/count_tokens`]({{< link-hextra path="/documentation/llm/api-types/token-count/" >}}) endpoint estimates token usage before sending a request and is handled by the `anthropicTokenCount` route type.

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
> For detailed information about model routing and configuration modes, see [Model routing and aliases]({{< link-hextra path="/documentation/llm/about/" >}}).

## Provider format conversion

A Messages request does not need a provider that speaks the Anthropic Messages format. When the selected provider advertises a different format, agentgateway converts the request on the way out and converts the reply back into the Messages shape, so the client receives Anthropic responses either way.

Agentgateway uses the first of these formats that the provider supports.

| Order | Provider format | What happens |
|-------|-----------------|--------------|
| 1 | `messages` | The request is sent natively, with no conversion. |
| 2 | `responses` | The request is converted to the OpenAI Responses format. |
| 3 | `completions` | The request is converted to the OpenAI Chat Completions format. |
| 4 | Bedrock Converse | The request is converted to the Amazon Bedrock Converse format. |

The first three rows are values that a `custom` provider declares in its `formats` list. Built-in providers support a fixed set of formats. The `openAI`, `ollama`, `groq`, `huggingface`, and `xai` providers support both `responses` and `completions`. The `azure` provider also supports both formats for models other than Claude.

Bedrock Converse is not a `formats` value. A [`bedrock` provider]({{< link-hextra path="/integrations/llm/providers/bedrock/" >}}) supports only Converse, so agentgateway always converts Messages requests to that format.

When a provider supports both `responses` and `completions`, agentgateway prefers Responses. The Responses conversion drops extended-thinking history. The Chat Completions conversion preserves it.

Use the `openAI` provider only for the OpenAI API. For other OpenAI-compatible servers, use a [`custom` provider]({{< link-hextra path="/integrations/llm/providers/custom/" >}}) with the formats that the server supports. If the server does not support `/v1/responses`, declare `completions` and omit `responses`. Use the same configuration to preserve extended-thinking history.

For providers that support both formats, the `AGENTGATEWAY_MESSAGES_PREFER_COMPLETIONS` environment variable provides a temporary workaround for Responses conversion bugs. To prefer Chat Completions, set the variable to `true` on the agentgateway process. The variable applies to every provider and is planned for removal in version 1.7.

### Converted replies and errors

These behaviors apply to both the Responses and the Chat Completions conversion.

- A reply that the provider stops for content filtering returns `stop_reason: "refusal"`, in both the buffered and the streamed form. The provider signals content filtering as `finish_reason: "content_filter"` in Chat Completions, and as a refusal or `incomplete_details.reason: "content_filter"` in Responses.
- A function call with empty arguments becomes a `tool_use` block whose `input` is `{}`. When the reply reaches the output token limit partway through the arguments, `stop_reason` is `max_tokens`, and a buffered reply returns the partial arguments in `input` as a string instead of an object. Check `stop_reason` before you parse `input`.
- When the provider rejects a prompt that is longer than the model's context window, the converted error message starts with `capability_rejected: prompt_too_long`, followed by the original message. Clients such as Claude Code use this marker to compact the prompt and retry. The marker is added only to an HTTP 400 error that has the `context_length_exceeded` code, or that has no code and a message that says the prompt exceeds the context window. An error that already contains `capability_rejected:` keeps its message. A Gemini or Vertex AI provider returns errors in the Google format, which does not get the marker.

### Converting to the Responses format

The Responses conversion covers a common agent subset:

- Text and system instructions
- Image inputs, supplied by URL, base64 data, or file ID
- Function tools, tool choice, and the parallel tool-call preference. A tool that omits `strict` is sent with `strict: false`, so that the optional properties of its input schema stay optional.
- Assistant tool-use history, and tool results that are text or images
- Structured output JSON schemas. The converted Responses request sets `text.format.strict` to `false`, so optional schema properties stay optional.
- Reasoning effort, from `output_config.effort` or from a `thinking` budget
- Prompt cache breakpoints
- Streaming and usage reporting

The reasoning effort is sent as the Responses `reasoning.effort` field. A request that sets `thinking.type` to `disabled` sends no reasoning setting, even when `output_config.effort` is set. The tools exception for models such as `gpt-5.3`, which the [Chat Completions conversion](#converting-to-the-chat-completions-format) applies, does not apply here.

> [!WARNING]
> The Responses format has no equivalent for `stop_sequences` or `top_k`. Agentgateway accepts both fields and drops them, with no error and no warning to the client. A request that relies on a stop sequence to end generation behaves differently against a provider that takes the Responses conversion.

A Messages feature that the Responses format cannot represent is dropped from the converted request, with no error and no warning to the client. These features are dropped this way:

- Thinking and redacted-thinking history, so the model loses its prior reasoning on each turn
- Citations on text blocks in the message history. The text itself is kept.
- Document, search-result, and server-tool content blocks, and content blocks of a type that agentgateway does not recognize, including these parts of a tool result
- Server tools, such as web search, in the `tools` list

The reply is converted back with these differences:

- The reasoning output of the model is dropped, so the reply has no `thinking` block.
- A buffered reply keeps each URL citation as a `web_search_result_location` citation with the source `url` and `title`. The `cited_text` and `encrypted_index` fields are empty strings, because the Responses format does not return them. File citations and `logprobs` are dropped. A streamed reply has no citations.
- If a streaming Responses reply fails, the converted Messages stream emits the content blocks that arrived before the failure, then emits an Anthropic `error` event. After the error, the failed stream does not emit `message_delta` or `message_stop`. Later Responses events are ignored.

### Converting to the Chat Completions format

Agentgateway converts a Messages request to Chat Completions when the provider declares `completions` and omits `responses`. For providers that support both formats, you can use the `AGENTGATEWAY_MESSAGES_PREFER_COMPLETIONS=true` workaround. To configure the supported formats, see [Custom providers]({{< link-hextra path="/integrations/llm/providers/custom/" >}}).

The Chat Completions conversion carries extended-thinking history in both directions, so a thinking session on a converted route keeps its prior reasoning from one turn to the next. Self-hosted engines that report reasoning as `reasoning_content` also accept it back on an assistant message, which is what makes the carryover possible.

On the way out, an assistant `thinking` block in the message history is sent as `reasoning_content`. A turn made of thinking alone is still sent.

On the way back, the `reasoning_content` in a buffered response becomes a `thinking` block ahead of the text block. In a stream, a thinking content block opens with `thinking_delta` events, adds a `signature_delta` when the engine sends a signature, and stops before the text or tool-use block that follows. Reasoning that the engine withholds arrives with an empty text and a signature that carries it, so the block is sent on the signature alone, in both the buffered and the streamed form.

Three cases do not round-trip.

| Case | What happens |
|------|--------------|
| A turn with more than one signed thinking block | The thinking text is joined, but no `reasoning_signature` is sent. The signature is carried only when the turn has exactly one signed block. |
| A `redacted_thinking` block | Dropped, because it holds nothing that an OpenAI-compatible engine can replay. |
| A request that takes the Responses conversion instead | The thinking history is dropped from the converted request, with no error and no warning, so the model loses its prior reasoning. See [Converting to the Responses format](#converting-to-the-responses-format). |

Function tools keep their `strict` setting. A tool that omits `strict` is sent without it.

The `stop_sequences` field is sent to the provider as `stop`. The reply reports which stop sequence ended generation only when the engine names it. When the Chat Completions reply has `finish_reason: "stop"` and a string in the vLLM `stop_reason` field or the SGLang `matched_stop` field, the Messages reply has `stop_reason: "stop_sequence"` and that string in `stop_sequence`. A numeric stop-token ID is ignored, so a natural end of turn still returns `stop_reason: "end_turn"`. This applies to buffered and streamed replies.

The reasoning effort comes from `output_config.effort`, or from the `thinking` budget when `output_config.effort` is not set, and is sent as `reasoning_effort`. The effort applies even when the request omits `thinking`. A request that sets `thinking.type` to `disabled` sends no `reasoning_effort`, even when `output_config.effort` is set. An adaptive `thinking` request without an effort is sent with `reasoning_effort: "high"`.

Certain models, such as `gpt-5.3`, reject a Chat Completions request that sets both a reasoning effort and tools. In the Chat Completions conversion, a request with tools to one of these models is sent with `reasoning_effort: "none"`, and any thinking that the client asked for through `thinking` or `output_config.effort` is dropped. Every other model receives the reasoning effort that the client asked for, if any.

### Converting to the Bedrock Converse format

The Bedrock Converse conversion carries extended-thinking history in both directions, including encrypted reasoning.

On the way out, a `thinking` block in the message history becomes a Bedrock `reasoningContent.reasoningText` block, with its signature. A `redacted_thinking` block becomes a Bedrock `reasoningContent.redactedContent` block, so that a client can replay encrypted reasoning that Bedrock returned on an earlier turn. Document, search-result, and server-tool content blocks are dropped.

On the way back, Bedrock reasoning text becomes a `thinking` block. In a buffered reply, Bedrock encrypted reasoning becomes a `redacted_thinking` block that keeps the encrypted payload for the next turn. A streamed reply does not keep the payload. The encrypted reasoning arrives as a `thinking` block with the text `[REDACTED]`, which cannot be replayed. For the same behavior on other Bedrock endpoints, see [Encrypted reasoning]({{< link-hextra path="/integrations/llm/providers/bedrock/#encrypted-reasoning" >}}).

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

[View other LLM client integrations]({{< link-hextra path="/integrations/llm/clients/" >}}).

{{% /tab %}}
{{< /tabs >}}

For Anthropic-specific features such as token counting, extended thinking, and structured outputs, see the [Anthropic provider]({{< link-hextra path="/integrations/llm/providers/anthropic/" >}}) guide.
