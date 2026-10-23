---
title: Amazon Bedrock
weight: 15
icon: /integrations/providers/bw/bedrock.svg
description: Route agentgateway LLM traffic to foundation models on Amazon Bedrock.
test:
  bedrock:
  - file: ${versionRoot}/integrations/llm/providers/bedrock.md
    path: bedrock
---

Configure Amazon Bedrock as an LLM provider in agentgateway.

> [!NOTE]
> Bedrock excludes cached tokens from the input count that it reports. The CEL field `llm.inputTokens` adds them back, so telemetry, metrics, and token-based limits count a cache-heavy request higher than the number that Bedrock reports. To read the Bedrock number itself, use `llm.providerInputTokens`. For more information, see [Token usage fields]({{< link-hextra path="/documentation/llm/observability/#token-usage-fields" >}}).

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
#   * "Bedrock Mantle": the `params.bedrockEndpointPreference` config is
#     accepted, which pins both the field name and the lowercase spelling of the
#     value. Standalone rejects the capitalized Kubernetes spelling, so this
#     block is what keeps the two modes from being copied into each other.
#   * With the base config loaded, agentgateway lists at least one model on
#     `/v1/models` and resolves the wildcard to the `bedrock` provider in the
#     configured AWS region. The list is not checked for a literal `*`, because
#     the default `llm.discovery: catalog` expands the wildcard into the catalog's
#     Bedrock model IDs.
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
#   * Which endpoint a given model actually resolves to under
#     `bedrockEndpointPreference` - external dependency; the resolution reads
#     `runtime`/`mantle` tags from an imported catalog, and populating that
#     catalog calls the AWS model-card pages.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

> [!NOTE]
> Agentgateway accepts requests in one of the supported [API formats]({{< link-hextra path="/documentation/llm/api-types/" >}}) (such as the `/v1/chat/completions` request body shape) and returns responses in that format.
> Agentgateway translates between these formats and Bedrock formats internally using Bedrock's [Converse API](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-call.html).
> Directly sending `Converse` or `Invoke` request shapes are not directly supported; see [passthrough](#passthrough) for more information if you need these APIs.

Bedrock conversion turns the prompt-cache markers in `/v1/messages` and `/v1/chat/completions` requests into Bedrock cache points, including markers on content that the conversion does not send. In `/v1/messages` requests, the Anthropic `cache_control.ttl` value becomes the TTL of the cache point. For where a marker on dropped content goes, see [Converting to the Bedrock Converse format]({{< link-hextra path="/documentation/llm/api-types/messages/#converting-to-the-bedrock-converse-format" >}}). In `/v1/chat/completions` requests, a text part that contains only whitespace is not sent, and the marker on that text part moves to the end of the content before the text part in the same message.

## Authentication

Before you can use Bedrock as an LLM provider, you must authenticate by using the standard [AWS authentication sources](https://docs.aws.amazon.com/sdkref/latest/guide/creds-config-files.html).
Agentgateway will automatically detect the local ambient credentials, but these can be explicitly configured with `auth.aws`.

## Configuration

You can add the model in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
To add the model in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps. The steps create the same model as the **Config file** tab.

1. Set up AWS credentials in the terminal where you run agentgateway, such as an AWS profile or environment variables.
2. {{< reuse "agw-docs/standalone/llm/providers/ui-start-empty-llm.md" >}}
3. Open **LLM** > **Models**, such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
4. From the **Provider** dropdown, select **Amazon Bedrock**.
5. Keep the default `bedrock/*` in the **Incoming model match** field.
6. Keep **Ambient** for the **AWS credentials**. To enter an access key instead, select **Static**. This option writes the key to an `auth.aws` block.
7. For the **AWS region**, enter or select `us-west-2`.
8. From the **Bedrock endpoint** dropdown, select **Prefer Runtime**. The UI preselects **Prefer Mantle** for a new Bedrock model, and saves the choice as `params.bedrockEndpointPreference`. For more information, see [Bedrock Mantle](#bedrock-mantle).
9. For **Outgoing model**, keep **Strip bedrock/**. This option removes the `bedrock/` prefix before the request is forwarded. To send every request to one model instead, select **Explicit**, and enter the model ID. This option sets `params.model`.

   {{< reuse-image src="img/ui-llm-add-model-bedrock-runtime.png" srcDark="img/ui-llm-add-model-bedrock-runtime-dark.png" alt="Add model drawer with Amazon Bedrock selected as the provider, bedrock/* as the incoming model match, Ambient as the AWS credentials, us-west-2 as the AWS region, and Prefer Runtime as the Bedrock endpoint" >}}

10. Click **Save model**.

The UI writes `bedrockEndpointPreference: runtimePreferred` in addition to the fields in the **Config file** tab. Runtime is also the default when the field is not set, so both configurations behave the same.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "bedrock/*"
    provider: bedrock
    params:
      awsRegion: us-west-2
    transformation:
      model: llmRequest.model.stripPrefix("bedrock/")
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. The `bedrock/*` pattern matches any model name that starts with `bedrock/`. |
| `provider` | The LLM provider, set to `bedrock` for Amazon Bedrock models. |
| `params.model` | The specific Bedrock model to use. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.awsRegion` | The AWS region where the Bedrock model is hosted. |
| `transformation.model` | Removes the `bedrock/` prefix from the model name before the request is forwarded, so the provider receives its own model name. |
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="bedrock" >}}
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "bedrock/*"
    provider: bedrock
    params:
      awsRegion: us-west-2
    transformation:
      model: llmRequest.model.stripPrefix("bedrock/")
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

## Passthrough

If your applications directly use the AWS `Converse` or `Invoke` APIs, Agentgateway cannot translate these APIs to other providers.
However, it can pass the request through to Bedrock itself following the [passthrough]({{< link-hextra path="/documentation/llm/api-types/passthrough/" >}}) approach.

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

Bedrock serves models on two API surfaces: the Runtime endpoint, which carries the Converse and Invoke APIs, and the [Mantle](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-responses-api.html) endpoint, which carries the native OpenAI and Anthropic APIs. Some models are served on only one of the two.

For chat requests, the endpoint is chosen per model from the `runtime` and `mantle` tags in the [model cost catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}). The built-in catalog that ships with {{< reuse "agw-docs/snippets/agentgateway.md" >}} already tags the Amazon Bedrock models. To tag models that are newer than your agentgateway version, run `agctl catalog import`. Its default sources include `aws-bedrock-mantle`, which reads the tags from the AWS model cards. A model with neither tag falls back to the preference alone.

Set `params.bedrockEndpointPreference` to choose how the tags are applied. You can set the preference in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
1. Open **LLM** > **Models**, and click the **Edit model** icon for the Bedrock model. To create a model, click **Add model**, and select **Amazon Bedrock** from the **Provider** dropdown.
2. From the **Bedrock endpoint** dropdown, select an option. **Prefer Runtime** writes `runtimePreferred`, **Prefer Mantle** writes `mantlePreferred`, **Runtime only (advanced)** writes `runtimeOnly`, and **Mantle only (advanced)** writes `mantleOnly`.
3. Click **Save model**.

The **Bedrock endpoint** dropdown is also in the **Add provider** drawer on the **LLM** > **Providers** page.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: bedrock
    params:
      awsRegion: us-west-2
      bedrockEndpointPreference: runtimePreferred
```
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="bedrock" >}}
cat <<'EOF' > config-mantle.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: bedrock
    params:
      awsRegion: us-west-2
      bedrockEndpointPreference: runtimePreferred
EOF
agentgateway -f config-mantle.yaml --validate-only
{{< /doc-test >}}

| Value | Endpoint selection |
|-------|--------------------|
| `runtimePreferred` | Use Runtime, except for a model tagged `mantle` but not `runtime`. This value is the default. |
| `mantlePreferred` | Use Mantle, except for a model tagged `runtime` but not `mantle`. |
| `runtimeOnly` | Always use Runtime, whatever the tags say. |
| `mantleOnly` | Always use Mantle, whatever the tags say. |

Inline Bedrock guardrails are available only on route and `backends` AI backends, through the `ai.provider.bedrock.guardrailIdentifier` and `guardrailVersion` fields. Those backends set the preference in `ai.provider.bedrock.endpointPreference`. `llm.models` and `llm.providers` have no inline guardrail fields, and a `params.guardrailIdentifier` setting fails to load with an unknown field error. An inline guardrail requires the Runtime endpoint:

- If either guardrail field is set together with `mantlePreferred` or `mantleOnly`, the configuration fails to load with `Bedrock guardrails cannot be used with MantlePreferred or MantleOnly`.
- With `runtimePreferred`, an inline guardrail keeps requests on Runtime even when the model tags would choose Mantle.

To apply Bedrock Guardrails with either endpoint, including on `llm.models`, use a [Bedrock Guardrails prompt guard]({{< link-hextra path="/documentation/llm/prompt-guards/bedrock-guardrails/" >}}) in `guardrails.request[].bedrockGuardrails` or `guardrails.response[].bedrockGuardrails`.

The Kubernetes API takes the same four values capitalized, such as `RuntimePreferred`, under `spec.ai.provider.bedrock.endpointPreference`. A value that you copy from one mode to the other fails to load.

In the agentgateway UI, the **LLM Models** and **LLM Providers** editors set `bedrockEndpointPreference` to `mantlePreferred` when you change an entry's provider to **Amazon Bedrock**. An existing Bedrock entry that does not set `bedrockEndpointPreference` shows **Prefer Runtime** in the **Bedrock endpoint** selector and keeps the `runtimePreferred` default. The UI writes the field only after you choose a value and save the entry.

The preference applies to four route types: chat completions, messages, responses, and Anthropic token counting. Every other route type ignores the preference and uses a fixed endpoint.

- Model listing always uses Mantle.
- Embeddings, realtime, Gemini token counting, detection, passthrough, and content generation always use Runtime.
- Reranking uses a separate Bedrock agent-runtime host rather than the Runtime or Mantle endpoint.

Whether the preference changes the request format that a model accepts depends on the endpoint that it selects. A model that resolves to Runtime accepts the Bedrock Converse format only, and its chat format tags do not apply. A model that resolves to Mantle accepts the formats in its tags, except for `anthropic.claude*` models, which always take the Anthropic Messages format. For more information, see [Chat format tags]({{< link-hextra path="/documentation/llm/cost-controls/costs/#chat-format-tags" >}}).

When a `/v1/messages` or `/v1/messages/count_tokens` request reaches Bedrock Mantle in the Anthropic Messages format, the request keeps the client `anthropic-version` header. If the client sends no version header, the request uses the default `2023-06-01` version.

> [!NOTE]
> Requests to the Mantle endpoint are signed for the `bedrock-mantle` service rather than `bedrock`. If you scope an IAM policy by service name, grant both before you switch a route to Mantle.

## Tool choice

When a chat request goes to Bedrock Runtime, the `tool_choice` value from the client request is converted to the Bedrock Converse `toolChoice` field.

| Client `tool_choice` | Bedrock `toolChoice` |
|---|---|
| `auto` | `auto` |
| `required` (Chat Completions, Responses) or `any` (Messages) | `any` |
| A named function or tool | `tool`, with that name |
| `none`, or omitted | Omitted. Bedrock Converse has no `none` option. The tools are still sent, so the model can still call them. |

The Bedrock model decides which values it accepts. If the model rejects forced tool use, such as `any` or a named tool, the client receives the Bedrock error. For example, Anthropic models reject forced tool use when [extended thinking](https://platform.claude.com/docs/en/build-with-claude/thinking#thinking-with-tool-use) is enabled. The tool choice is not changed for requests that use extended thinking.

## Service tier {#service-tier}

When a `/v1/chat/completions` or `/v1/responses` request goes to Bedrock Runtime, the OpenAI `service_tier` value from the client request is converted to the Bedrock Converse `serviceTier` field. Bedrock then serves the request at that [service tier](https://docs.aws.amazon.com/bedrock/latest/userguide/service-tiers-inference.html).

| Client `service_tier` | Bedrock `serviceTier` |
|---|---|
| `priority` | `{"type": "priority"}` |
| `default` | `{"type": "default"}` |
| `flex` | `{"type": "flex"}` |
| `auto`, or omitted | Omitted. Bedrock uses its default tier. |
| Any other value, such as `scale` or `fast` | Omitted. Bedrock uses its default tier. For a `/v1/chat/completions` request, agentgateway also logs the warning `service tier is not supported by Bedrock`. |

A `/v1/messages` request does not set a Bedrock service tier.

The Bedrock model decides which tiers it accepts. If the model does not support the requested tier, Bedrock rejects the request with a `400` error, such as `The provided service tier is not supported for this model`. In earlier versions, agentgateway did not send the tier, so the request succeeded at the standard tier. To keep that behavior for a model that does not support a tier, omit `service_tier` from the request or set it to `auto`.

Bedrock reports the tier that served the request in the `x-amzn-bedrock-service-tier` response header. Agentgateway records the tier as `llm.serviceTier` and uses it to select service-tier rates from the model catalog. For more information, see [Service tiers]({{< link-hextra path="/documentation/llm/cost-controls/costs/#service-tiers" >}}).

## Token counting

Bedrock supports token counting for Anthropic models via the `count_tokens` endpoint.
Agentgateway automatically handles the required formatting for Bedrock's count-tokens endpoint.

```bash
curl -X POST http://localhost:4000/v1/messages/count_tokens \
  -H "Content-Type: application/json" \
  -d '{
    "model": "bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0",
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

Extended thinking and reasoning lets models reason through complex problems before generating a response. To opt in, add the OpenAI `reasoning_effort` field to your request. The value is added to the `additionalModelRequestFields` of the Bedrock request, in a form that depends on the model family. The family is chosen by matching the model ID.

| Model ID contains | What the Bedrock request receives |
|---|---|
| `gpt-oss` or `deepseek` | `reasoning_effort`, with the value from your request unchanged. |
| `openai.`, other than `gpt-oss` models | `reasoning.effort`, with the value from your request unchanged. |
| `amazon.nova-2-` | `reasoningConfig` with `maxReasoningEffort` set to `low`, `medium`, or `high`. If you set `none` or omit `reasoning_effort`, no reasoning configuration is sent. Any other value is rejected. |
| Anything else | Claude thinking fields, as described in the rest of this section. |

For Claude models that support adaptive thinking, the request is sent with `thinking.type` set to `adaptive` and the effort level in `output_config.effort`, instead of a token budget. The value `minimal` is sent as `low`. Which models take this form depends on the `adaptive_thinking` tag in the [model cost catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}). The built-in catalog sets this tag for these models.

Other Claude models, such as `us.anthropic.claude-opus-4-20250514-v1:0`, receive a thinking budget.

| `reasoning_effort` value | Thinking budget |
|---|---|
| `minimal` or `low` | 1,024 tokens |
| `medium` | 2,048 tokens |
| `high` | 4,096 tokens |
| `xhigh` | 8,192 tokens |
| `max` | 16,384 tokens |

Note that `max_tokens` must be greater than the thinking budget, and the minimum thinking budget is 1,024 tokens.

```sh
curl "localhost:4000/v1/chat/completions" -H content-type:application/json -d '{
  "model": "bedrock/us.anthropic.claude-opus-4-20250514-v1:0",
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

### Encrypted reasoning

Some Bedrock models return encrypted reasoning in a `reasoningContent.redactedContent` block instead of reasoning text. How agentgateway returns encrypted reasoning in a buffered reply depends on the API that the client sends.

| Client API | Encrypted reasoning in the reply | Replay on the next turn |
|---|---|---|
| `/v1/messages` | A `redacted_thinking` block. | Send the block back in the message history. The next Bedrock request includes it as `reasoningContent.redactedContent`. |
| `/v1/responses` | A reasoning item with `encrypted_content`. | Send the reasoning item back in the input. The next Bedrock request includes it as `reasoningContent.redactedContent`. |
| `/v1/chat/completions` | Omitted, because the Chat Completions format has no field for encrypted reasoning. Signed reasoning text still arrives in `reasoning_content` and `reasoning_signature`. | Not possible. |

A streamed reply keeps the encrypted payload too, so you replay streamed encrypted reasoning the same way as buffered reasoning. The stream format depends on the client API.

| Client API | Streamed reasoning |
|---|---|
| `/v1/messages` | Reasoning text streams as `thinking_delta` events, and the signature as a `signature_delta` event. Encrypted reasoning arrives as one `redacted_thinking` content block after Bedrock finishes the block. |
| `/v1/responses` | Each reasoning block is a separate `reasoning` output item, which comes before the `message` item. Reasoning text streams as `response.reasoning_text.delta` events. The signature or the encrypted payload arrives as `encrypted_content` in the `response.output_item.done` event for that item. |
| `/v1/chat/completions` | Reasoning text streams in `reasoning_content`, and the signature in `reasoning_signature`. Encrypted reasoning is omitted. |

In a streamed `/v1/messages` reply, agentgateway holds encrypted reasoning until its block ends. If the held fragments exceed the stream buffer limit, the stream emits an `api_error` event with the message `Stream processing error`. The stream then stops.

## Structured outputs

Structured outputs constrain the model to respond with a specific JSON schema. Provide the schema definition in the OpenAI `response_format` field of your request. Agentgateway translates this to Bedrock's native format automatically.

```sh
curl "localhost:4000/v1/chat/completions" -H content-type:application/json -d '{
  "model": "bedrock/us.anthropic.claude-opus-4-20250514-v1:0",
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
# Confirm the base config serves models and that `params.awsRegion` reaches the
# resolved provider config. The default `llm.discovery: catalog` expands `*` into
# catalog model IDs, so check for a non-empty list rather than a literal `*`.
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3

SERVED=$(curl -sf --max-time 10 http://localhost:4000/v1/models | jq -r '.data | length')
if [ "${SERVED:-0}" -eq 0 ]; then
  echo "FAIL: /v1/models lists no models for the example config"
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
echo "✓ Models are served and the wildcard resolves to bedrock in us-west-2"
{{< /doc-test >}}
