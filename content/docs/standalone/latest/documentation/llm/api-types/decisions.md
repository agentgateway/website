---
title: Decisions
weight: 34
description: Route OpenAI Decisions and TypeSafe SystemOne requests through agentgateway and track token usage.
---

Route OpenAI Decisions and TypeSafe SystemOne API requests through {{< reuse "agw-docs/snippets/agentgateway.md" >}} to get token usage tracking and observability.

## About

The OpenAI Decisions API (`/v1/decisions`) answers a list of questions about an input. Each question is a predicate, a choice, or a score. The response returns one answer per question.

The TypeSafe SystemOne API (`/v1/systemone`) uses a different format for the same question types. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} translates requests and replies between the two formats to match the client and provider.

Review the following behavior of Decisions and SystemOne requests.

| Behavior | Detail |
| -- | -- |
| Model | The request must name a model, unless the provider sets a default model. |
| Telemetry | Both formats use the telemetry operation name `decisions`. When a response includes usage fields, telemetry records the model and token usage. |
| Policies | Request and response guardrails and the `prompts` policy do not apply to Decisions or SystemOne requests. Token-based rate limits apply, and count the token usage that the provider reports. |

### Supported providers {#supported-providers}

These providers accept Decisions and SystemOne requests. Other providers reject them.

| Provider | Decisions requests (`/v1/decisions`) | SystemOne requests (`/v1/systemone`) |
|----------|--------------------------------------|--------------------------------------|
| [`openAI`]({{< link-hextra path="/integrations/llm/providers/openai/" >}}) | Sent natively. | Translated to the Decisions format. |
| [`typesafe`]({{< link-hextra path="/integrations/llm/providers/typesafe/" >}}) | Translated to the SystemOne format. | Sent natively. |
| [`azure`]({{< link-hextra path="/integrations/llm/providers/azure/" >}}) with the `foundry` resource type | Translated to the SystemOne format. | Sent natively. |
| [`custom`]({{< link-hextra path="/integrations/llm/providers/custom/" >}}) with `decisions`, without `systemOne` | Sent natively. | Translated to the Decisions format. |
| [`custom`]({{< link-hextra path="/integrations/llm/providers/custom/" >}}) with `systemOne`, without `decisions` | Translated to the SystemOne format. | Sent natively. |

If a custom provider declares both formats, each request uses its original format.

### Custom provider requirements {#custom-provider-requirements}

A `custom` provider must declare `decisions` or `systemOne` in `formats`. If `formats` is omitted or contains only other formats, both endpoints return `400`. The error names the request format and provider:

```console
failed to process LLM request: unsupported conversion: from Decisions to provider custom
```

Version 1.6 had no Decisions or SystemOne route type. With the `llm` configuration, it passed both paths through to the provider unchanged. After upgrading, add the format your upstream server supports to `formats` to keep serving these requests.

## Map the Decisions route type

With the simplified `llm` configuration, no route setup is needed. Agentgateway maps `/v1/decisions` to `decisions` and `/v1/systemone` to `systemOne`.

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

For a `custom` provider, declare the upstream format as `decisions` or `systemOne`. Agentgateway appends `/decisions` or `/systemone` to `baseUrl`. This example uses `decisions`.

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
llm:
  models:
  - name: decisions-model
    provider:
      custom:
        formats:
        - type: decisions
    params:
      apiKey: "$CUSTOM_PROVIDER_API_KEY"
      baseUrl: "https://api.example.com/v1"
```

For explicit routing, use the `gateways` and `routes` configuration. Map `/v1/decisions` to `decisions` and `/v1/systemone` to `systemOne` in `policies.ai.routes`.

Without this map, requests default to `completions`. A Decisions request then fails with `failed to parse Completions request`.

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
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
        "/v1/decisions": "decisions"
        "/v1/systemone": "systemOne"
        "/v1/chat/completions": "completions"
        "*": "passthrough"
    backendAuth:
      key: "$OPENAI_API_KEY"
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting | Description |
|---------|-------------|
| `policies.ai.routes."/v1/decisions"` | Processes requests on this path as Decisions requests. |
| `policies.ai.routes."/v1/systemone"` | Processes requests on this path as SystemOne requests. The OpenAI provider receives them translated to the Decisions format. |
| `policies.ai.routes."*"` | Passes requests on all other paths through unchanged. |

> [!TIP]
> For detailed information about model routing and configuration modes, see [Model routing and aliases]({{< link-hextra path="/documentation/llm/about/" >}}).

## Send a Decisions request

Send a request with an input and a list of questions to the `/v1/decisions` endpoint. Replace `<decisions-model>` with an OpenAI model that supports the Decisions API.

```sh
curl http://localhost:4000/v1/decisions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "<decisions-model>",
    "input": [{"role": "user", "content": [{"type": "input_text", "text": "The package was left in the rain and the box is soaked through."}]}],
    "questions": [{"type": "predicate", "name": "visible_damage", "instructions": "Does the customer report visible damage to the package?"}]
  }'
```

Example output:

```json
{
  "model": "<decisions-model>",
  "answers": [
    {"type": "predicate", "name": "visible_damage", "probability": 0.64}
  ],
  "usage": {"input_tokens": 156, "output_tokens": 0, "total_tokens": 156}
}
```

To ask the same question in SystemOne, use `state` for the input and a map keyed by name for the questions.

The SystemOne `noul` question type matches the Decisions `predicate` type. Both return the probability that a statement is true.

```sh
curl http://localhost:4000/v1/systemone \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "<decisions-model>",
    "state": [{"role": "user", "content": "The package was left in the rain and the box is soaked through."}],
    "questions": {"visible_damage": {"type": "noul", "instructions": "Does the customer report visible damage to the package?"}}
  }'
```

Example output:

```json
{
  "model": "<decisions-model>",
  "answers": {"visible_damage": {"type": "noul", "noul": 0.64}},
  "usage": {"input_tokens": 156, "output_tokens": 0}
}
```

## Format conversion {#format-conversion}

When the request format differs from the provider format, {{< reuse "agw-docs/snippets/agentgateway.md" >}} translates the request, and then translates the reply back to the request format. Some fields have no match in the other format. Review the following tables to see how each field is translated.

### Decisions requests to a SystemOne provider {#decisions-to-systemone}

| Decisions request field | How the field is sent in SystemOne |
|---|---|
| `input` as a string | Sent as `state`, unchanged. |
| `input` as a list of messages | Sent as `state`, with one entry for each message and its `role`. If a message has a list of text parts, the parts are joined with newlines. |
| An image in `input` | Not supported. The request is rejected with a `400` error that contains `unsupported content`. |
| `questions` | Sent as an object keyed by question `name`. A question without a `name` is keyed by its position in the list, starting at `0`. If another question already uses that key, an underscore is appended, such as `1_`. Two questions with the same `name` are rejected with a `400` error. |
| `predicate` question | Sent as a `noul` question. |
| `choice` question | Sent as a `choice` question. Each value in `choices` becomes a key in `criteria`, with its `description` or `null`. Two choices with the same value are rejected with a `400` error. The boolean values `true` and `false` come back as booleans in the answer. |
| `score` question | Sent as a `score` question. Each level becomes an entry in `criteria`, either the label alone or an object with the label and its description. The `probabilities` in the answer include the labels from the request. |
| Other fields, such as `safety_identifier` | Dropped. |

The reply lists the answers in the order that the provider returns them, which might differ from the order of `questions`. The answer to a question without a `name` has no `name`. To match each answer to its question, give every question a `name`. The `usage` field reports the input and output tokens from the provider, and their sum as `total_tokens`.

### SystemOne requests to a Decisions provider {#systemone-to-decisions}

| SystemOne request field | How the field is sent in Decisions |
|---|---|
| `state` as a string | Sent as `input`, unchanged. |
| `state` as another value, such as a list of messages | Sent as `input` text that contains the value as JSON. |
| `questions` | Sent as a list. Each key becomes the `name` of its question. |
| `noul` question | Sent as a `predicate` question. If the question has `criteria`, the `true` and `false` descriptions are appended to `instructions`. |
| `choice` question | Sent as a `choice` question. Each key in `criteria` becomes a choice value with its description. |
| `score` question | Sent as a `score` question. Each entry in `criteria` becomes a level. A string entry becomes the label. An object entry uses its `label` and `description` fields. Any other fields of the object are added to the description as JSON. |

The reply keys each answer by question name. Score answers include a `legend` that is built from the `criteria` in the request. The `usage` field reports the input and output tokens from the provider. If the provider refuses to answer a question, the request fails, because SystemOne has no refusal answer.

## Verify token tracking

After the request completes, check that {{< reuse "agw-docs/snippets/agentgateway.md" >}} recorded the token usage in its metrics.

```sh
curl -s http://localhost:15020/metrics | grep 'agentgateway_gen_ai_client_token_usage_sum.*gen_ai_operation_name="decisions"'
```

Example output:

```console
agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input",gen_ai_operation_name="decisions",gen_ai_system="openai",gen_ai_request_model="<decisions-model>",...} 156.0
agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output",gen_ai_operation_name="decisions",gen_ai_system="openai",gen_ai_request_model="<decisions-model>",...} 0.0
```

For more information about LLM metrics, see [Observe traffic]({{< link-hextra path="/documentation/llm/observability/#view-llm-metrics" >}}).
