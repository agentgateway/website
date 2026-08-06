---
title: Amazon Bedrock
weight: 15
icon: /integrations/providers/bw/bedrock.svg
description: Route agentgateway LLM traffic to foundation models on Amazon Bedrock.
test:
  bedrock:
  - file: ${versionRoot}/llm/providers/bedrock.md
    path: bedrock
---

Configure Amazon Bedrock as an LLM provider in agentgateway.

{{< doc-test paths="bedrock" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Configuration": the example config is accepted by agentgateway
#     (--validate-only), so `provider: bedrock` is recognized and
#     `params.awsRegion` is correct.
#   * "Passthrough": the `passthrough: detect` config is accepted, including the
#     `name: us.anthropic*` prefix match.
#   * With the base config loaded, agentgateway serves the wildcard model and
#     resolves it to the `bedrock` provider in the configured AWS region.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * "Authentication" - external dependency; AWS credentials are resolved per
#     request from the ambient environment, which the test cannot provide.
#   * The Converse and Invoke boto3 examples - display-only Python snippets that
#     need real AWS credentials and a Bedrock model grant.
#   * "Token counting", "Extended thinking and reasoning", and "Structured
#     outputs" - external dependency; each bills a live Bedrock completion. Their
#     example responses and the `reasoning_effort` budget table are display-only.
#   * That format translation to Bedrock's Converse API is correct - a different
#     layer; verifying the translation needs a live Bedrock upstream.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

> [!NOTE]
> Agentgateway accepts requests in one of the supported [API formats](../../api-types) (such as the `/v1/chat/completions` request body shape) and returns responses in that format.
> Agentgateway translates between these formats and Bedrock formats internally using Bedrock's [Converse API](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-call.html).
> Directly sending `Converse` or `Invoke` request shapes are not directly supported; see [passthrough](#passthrough) for more information if you need these APIs.

## Authentication

Before you can use Bedrock as an LLM provider, you must authenticate by using the standard [AWS authentication sources](https://docs.aws.amazon.com/sdkref/latest/guide/creds-config-files.html).
Agentgateway will automatically detect the local ambient credentials, but these can be explicitly configured with `auth.aws`.

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

{{< doc-test paths="bedrock" >}}
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: bedrock
    params:
      awsRegion: us-west-2
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `bedrock` for Amazon Bedrock models. |
| `params.model` | The specific Bedrock model to use. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.awsRegion` | The AWS region where the Bedrock model is hosted. |

## Passthrough

If your applications directly use the AWS `Converse` or `Invoke` APIs, Agentgateway cannot translate these APIs to other providers.
However, it can pass the request through to Bedrock itself following the [passthrough](../../api-types/passthrough) approach.

This can provide telemetry data for these requests.

First, setup passthrough mode:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: us.anthropic*
    provider: bedrock
    params:
      awsRegion: us-west-2
    passthrough: detect
```

{{< doc-test paths="bedrock" >}}
cat <<'EOF' > config-passthrough.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: us.anthropic*
    provider: bedrock
    params:
      awsRegion: us-west-2
    passthrough: detect
EOF
agentgateway -f config-passthrough.yaml --validate-only
{{< /doc-test >}}

Then, you can send native Converse and Invoke requests:

{{< tabs >}}
{{% tab name="Converse" %}}

```python
import json

import boto3

client = boto3.client(
    'bedrock-runtime',
    region_name='us-west-2',
    endpoint_url='http://localhost:4000',
)
response = client.converse(
    modelId='us.anthropic.claude-sonnet-4-6',
    messages=[
        {
            'role': 'user',
            'content': [{'text': 'give 1 word answer'}]
        }
    ]
)
print('converse response:')
print(response)
```

{{% /tab %}}
{{% tab name="Invoke" %}}

```python
import json

import boto3

client = boto3.client(
    'bedrock-runtime',
    region_name='us-west-2',
    endpoint_url='http://localhost:4000',
)
response = client.invoke_model(
    modelId='us.anthropic.claude-sonnet-4-6',
    body=json.dumps({
        'anthropic_version': 'bedrock-2023-05-31',
        'max_tokens': 10,
        'messages': [
            {
                'role': 'user',
                'content': [{'type': 'text', 'text': 'give 1 word answer'}],
            }
        ],
    }),
)
body = json.loads(response['body'].read())

print('invoke response:')
print(body)
```

{{% /tab %}}
{{< /tabs >}}


> [!NOTE]
> Model translations are not supported with passthrough, so avoid using a model match like `aws/*`, as it cannot be transformed.

## Claude Platform on AWS

See [here](../anthropic/#use-claude-platform-on-aws) for connect to [Claude Platform on AWS](https://docs.aws.amazon.com/claude-platform/latest/userguide/welcome.html).

## Bedrock Mantle

The [Bedrock Mantle](https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-mantle.html) endpoint is not currently supported.
Follow the [GitHub issue](https://github.com/agentgateway/agentgateway/issues/2041) if you are interested!

## Token counting

Bedrock supports token counting for Anthropic models via the `count_tokens` endpoint.
Agentgateway automatically handles the required formatting for Bedrock's count-tokens endpoint.

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

## Extended thinking and reasoning

Extended thinking and reasoning lets models reason through complex problems before generating a response. You can opt in to extended thinking and reasoning by adding specific parameters to your request. Agentgateway maps these parameters to Bedrock's native format automatically.

> [!NOTE]
> Extended thinking and reasoning requires a Claude model that supports it, such as `us.anthropic.claude-opus-4-20250514-v1:0`.

Use the `reasoning_effort` field to control how much reasoning the model applies. The value is automatically mapped to a thinking budget.

| `reasoning_effort` value | Thinking budget |
|---|---|
| `minimal` or `low` | 1,024 tokens |
| `medium` | 2,048 tokens |
| `high` or `xhigh` | 4,096 tokens |

Note that `max_tokens` must be greater than the thinking budget, and the minimum thinking budget is 1,024 tokens.

```sh
curl "localhost:4000/v1/chat/completions" -H content-type:application/json -d '{
  "model": "",
  "max_tokens": 6000,
  "reasoning_effort": "high",
  "messages": [
    {
      "role": "user",
      "content": "Explain the trade-offs between consistency and availability in distributed systems."
    }
  ]
}' | jq
```

## Structured outputs

Structured outputs constrain the model to respond with a specific JSON schema. Provide the schema definition in the OpenAI `response_format` field of your request. Agentgateway translates this to Bedrock's native format automatically.

```sh
curl "localhost:4000/v1/chat/completions" -H content-type:application/json -d '{
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

{{< doc-test paths="bedrock" >}}
# Confirm the base config serves the wildcard model and that `params.awsRegion`
# reaches the resolved provider config.
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3

SERVED=$(curl -sf --max-time 10 http://localhost:4000/v1/models | jq -r '[.data[].id] | index("*") // "missing"')
if [ "$SERVED" = "missing" ]; then
  echo "FAIL: the wildcard model from the example config is not served"
  exit 1
fi
RESOLVED=$(curl -sf --max-time 10 http://localhost:15000/config_dump | jq -r '
  [ .backends[].backend.ai
    | select(. != null)
    | .target.providers[].active[].endpoint
    | "\(.provider | keys[0])|\(.provider.bedrock.region)"
  ] | first')
if [ "$RESOLVED" != "bedrock|us-west-2" ]; then
  echo "FAIL: expected bedrock|us-west-2 but agentgateway resolved $RESOLVED"
  exit 1
fi
echo "✓ Wildcard model is served and resolves to bedrock in us-west-2"
{{< /doc-test >}}
