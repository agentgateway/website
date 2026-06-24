---
title: Anthropic
weight: 15
icon: /integrations/providers/bw/anthropic.svg
description: Configuration and setup for Anthropic Claude provider
---

Configure Anthropic (Claude models) as an LLM provider in agentgateway.

## Configuration

For the common API key case, use the following config. Use the AWS SigV4 section later in the page only when you need Claude Platform on AWS or custom signing behavior.

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
| `params.apiKey` | The Anthropic API key for authentication. |

## Example request

After running agentgateway with the configuration from the previous section, you can send a request to the `v1/messages` endpoint. Agentgateway automatically adds the `x-api-key` authorization and `anthropic-version` headers to the request. The request is forwarded to the Anthropic API and the response is returned to the client.

```sh
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

## Extended thinking and reasoning

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
curl "localhost:4000/v1/messages" -H content-type:application/json -d '{
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
curl "localhost:4000/v1/messages" -H content-type:application/json -d '{
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


## Use Claude Platform on AWS

[Claude Platform on AWS](https://docs.aws.amazon.com/claude-platform/latest/userguide/welcome.html) hosts Anthropic's native Messages API on AWS infrastructure at `aws-external-anthropic.{region}.api.aws`. Because the API is the same Anthropic Messages API, you point the `anthropic` provider at the AWS endpoint and choose either API-key or AWS SigV4 authentication.

{{< tabs >}}
{{% tab name="API key" %}}

Store your Claude Platform on AWS API key in an environment variable or file and reference it from the provider configuration.
Override the upstream host to point at the Claude Platform endpoint.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: anthropic
    requestHeaders:
      set:
        # Replace with your workspace ID
        anthropic-workspace-id: wrkspc_XXXXX
    params:
      apiKey: $ANTHROPIC_AWS_API_KEY
      # Replace with your region
      baseUrl: https://aws-external-anthropic.us-west-2.api.aws/v1
```

| Setting                                     | Description |
|---------------------------------------------|-------------|
| `requestHeaders.set.anthropic-workspace-id` | The Anthropic workspace ID that scopes the request. Replace `wrkspc_XXXXX` with your workspace ID. |
| `params.hostOverride`                       | The Claude Platform endpoint host and port. Use the form `aws-external-anthropic.{region}.api.aws:443`. |
| `params.pathPrefix`                         | The Anthropic API path prefix on Claude Platform, set to `/v1`. |
| `params.apiKey`                             | API key. |

{{% /tab %}}
{{% tab name="AWS SigV4" %}}

Use IAM credentials from the environment (for example IRSA, an EC2 instance profile, or an AWS SSO profile) and let agentgateway sign requests with SigV4. Set `auth.aws.serviceName` to `aws-external-anthropic`, which is the SigV4 service name that Claude Platform expects.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "claude-platform/*"
    provider: anthropic
    requestHeaders:
      set:
        anthropic-workspace-id: wrkspc_XXXXX
    params:
      awsRegion: us-west-2
      baseUrl: https://aws-external-anthropic.us-west-2.api.aws/v1
    auth:
      aws:
        serviceName: aws-external-anthropic
```

| Setting | Description |
|---------|-------------|
| `name` | Matches model names that start with `claude-platform/`, so you can route Claude Platform traffic alongside other Anthropic models. |
| `requestHeaders.set.anthropic-workspace-id` | The Anthropic workspace ID that scopes the request. Replace `wrkspc_XXXXX` with your workspace ID. |
| `params.baseUrl` | The full Claude Platform base URL, including scheme and `/v1` path prefix. |
| `auth.aws.serviceName` | The SigV4 service name. Claude Platform requires `aws-external-anthropic`. Implicit AWS credentials from the workload environment are used to sign each request. |

{{% /tab %}}
{{< /tabs >}}

## Connect to Claude Code

To route Claude Code CLI traffic through agentgateway, see the [Claude Code integration guide]({{< link-hextra path="/integrations/llm-clients/claude-code" >}}).
