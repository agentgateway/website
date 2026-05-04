---
title: Amazon Bedrock
weight: 40
description: Configuration and setup for Amazon Bedrock provider
---

Configure Amazon Bedrock as an LLM provider in agentgateway.

## Authentication

Before you can use Bedrock as an LLM provider, you must authenticate by using the standard [AWS authentication sources](https://docs.aws.amazon.com/sdkref/latest/guide/creds-config-files.html).

## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: bedrock
    params:
      awsRegion: us-west-2
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `bedrock` for Amazon Bedrock models. |
| `params.model` | The specific Bedrock model to use. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.awsRegion` | The AWS region where the Bedrock model is hosted. |

## Token counting

Bedrock supports token counting for Anthropic models via the `count_tokens` endpoint. Agentgateway automatically handles the required formatting for Bedrock's count-tokens endpoint, including adding the `max_tokens: 1` parameter and Base64 encoding the request body.

```bash
curl -X POST http://localhost:4000/v1/messages/count_tokens \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic.claude-3-5-sonnet-20241022-v2:0",
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

## Structured outputs

Structured outputs constrain the model to respond with a specific JSON schema. You must provide the schema definition in your request.

{{< tabs tabTotal="2" items="Bedrock default, OpenAI-compatible v1/chat/completions" >}}
{{% tab tabName="Bedrock default" %}}

Provide the JSON schema definition in the `text.format` field.

```sh
curl "localhost:3000/model/us.anthropic.claude-opus-4-20250514-v1:0/converse" \
  -H content-type:application/json -d '{
  "model": "",
  "max_output_tokens": 256,
  "input": "Is the sky blue? Respond with your answer and a confidence score between 0 and 1.",
  "text": {
    "format": {
      "type": "json_schema",
      "json_schema": {
        "name": "answer_schema",
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
    }
  }
}' | jq
```

{{% /tab %}}
{{% tab tabName="OpenAI-compatible v1/chat/completions" %}}

Provide the schema definition in the `response_format` field. Agentgateway translates this to Bedrock's native format automatically.

```sh
curl "localhost:3000/v1/chat/completions" -H content-type:application/json -d '{
  "model": "",
  "max_tokens": 256,
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "answer_schema",
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

{{% /tab %}}

{{< /tabs >}}
