---
title: Anthropic
weight: 50
description: Configuration and setup for Anthropic Claude provider
---

Configure Anthropic (Claude models) as an LLM provider in agentgateway.

## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: anthropic
    params:
      apiKey: "$ANTHROPIC_API_KEY"
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `anthropic` for Claude models. |
| `params.model` | The specific Claude model to use. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | The Anthropic API key for authentication. You can reference environment variables using the `$VAR_NAME` syntax. |

## Example request

After running agentgateway with the configuration from the previous section, you can send a request to the `v1/messages` endpoint. Agentgateway automatically adds the `x-api-key` authorization and `anthropic-version` headers to the request. The request is forwarded to the Anthropic API and the response is returned to the client.

```bash
curl -X POST http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4-6",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

Example response:

```json
{
  "model": "claude-opus-4-6",
  "usage": {
    "input_tokens": 9,
    "output_tokens": 21,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 0,
    "cache_creation": {
      "ephemeral_5m_input_tokens": 0,
      "ephemeral_1h_input_tokens": 0
    },
    "service_tier": "standard"
  },
  "content": [
    {
      "text": "Hi there! How are you doing today? Is there anything I can help you with?",
      "type": "text"
    }
  ],
  "id": "msg_01QdUEuzvXfjLh1HfMQd4UHP",
  "type": "message",
  "role": "assistant",
  "stop_reason": "end_turn",
  "stop_sequence": null
}
```

## Token counting

Anthropic's `count_tokens` API is supported for estimating token usage before making a request. Agentgateway automatically handles the required `anthropic-version` header and formats the request correctly for Anthropic's API.

```bash
curl -X POST http://localhost:4000/v1/messages/count_tokens \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4-6",
    "messages": [{"role": "user", "content": "Hello!"}],
    "system": "You are a helpful assistant."
  }'
```

Example response:

```json
{
  "input_tokens": 15
}
```

## Extended thinking and reasoing

Extended thinking and reasoning lets Claude reason through complex problems before generating a response. You can opt in to extended thinking and reasoning by adding specific parameters to your request. 

{{< callout type="info" >}}
Extended thinking and reasoning requires a Claude model that supports these, such as `claude-opus-4-6`.
{{< /callout >}}

To opt in to extended thinking, include the `thinking.type` field in your request. You can also set the `output_config.effort` field to control how much reasoning the model applies.

The following values are supported: 

**`thinking` field**
| `type` value | Additional fields | Behavior |
|---|---|---|
| `adaptive` | `output_config.effort` | The model decides whether to think and how much. Requires `output_config.effort` to be set. |
| `enabled` | `budget_tokens: <number>` | Explicitly enables thinking with a fixed token budget. Works standalone without `output_config`. |
| `disabled` | none | Explicitly disables thinking. |

**`output_config` field**

`output_config` has two independent sub-fields. You can use either or both.

| Sub-field | Description |
|---|---|
| `effort` | Controls the reasoning effort level. Accepted values: `low`, `medium`, `high`, `max`. |
| `format` | Constrains the response to a JSON schema. Set `type` to `json_schema` and provide a `schema` object. For more information, see [Structured outputs](#structured-outputs). |


The following example request uses adaptive extended thinking. Note that this setting requires the `output_config.effort` field to be set too. 

```sh
curl "localhost:3000/v1/messages" -H content-type:application/json -d '{
  "model": "",
  "max_tokens": 1024,
  "thinking": {
    "type": "adaptive"
  },
  "output_config": {
    "effort": "high"
  },
  "messages": [
    {
      "role": "user",
      "content": "Explain the trade-offs between consistency and availability in distributed systems."
    }
  ]
}' | jq
```

Example output:
```console
{
  "id": "msg_01HVEzWf4NJrsKyVeEUDnHNW",
  "type": "message",
  "role": "assistant",
  "model": "claude-opus-4-6",
  "content": [
    {
      "type": "thinking",
      "thinking": "Let me think through the trade-offs between consistency and availability..."
    },
    {
      "type": "text",
      "text": "# Consistency vs. Availability in Distributed Systems\n\n..."
    }
  ],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 21,
    "output_tokens": 1024
  }
}
```

## Structured outputs

Structured outputs constrain the model to respond with a specific JSON schema. You must provide the schema definition in your request. 

Provide the JSON schema definition in the `output_config.format` field. 

```sh
curl "localhost:3000/v1/messages" -H content-type:application/json -d '{
  "model": "",
  "max_tokens": 256,
  "output_config": {
    "format": {
      "type": "json_schema",
      "schema": {
        "type": "object",
        "properties": {
          "answer": { "type": "string" },
          "confidence": { "type": "number" }
        },
        "required": ["answer", "confidence"],
        "additionalProperties": false
      }
    }
  },
  "messages": [
    {
      "role": "user",
      "content": "Is the sky blue? Respond with your answer and a confidence score between 0 and 1."
    }
  ]
}' | jq
```

Example output:
```console
{
  "id": "msg_01PsCxtLN1vftAKZgvWXhCan",
  "type": "message",
  "role": "assistant",
  "model": "claude-opus-4-6",
  "content": [
    {
      "type": "text",
      "text": "{\"answer\":\"Yes, the sky is blue during clear daytime conditions.\",\"confidence\":0.98}"
    }
  ],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 29,
    "output_tokens": 28
  }
}
```


## Connect to Claude Code

To route Claude Code CLI traffic through agentgateway, see the [Claude Code integration guide]({{< link-hextra path="/integrations/llm-clients/claude-code" >}}).
