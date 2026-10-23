---
title: Decisions
weight: 34
description: Route OpenAI Decisions and TypeSafe SystemOne requests through agentgateway and track token usage.
---

Route OpenAI Decisions API requests through {{< reuse "agw-docs/snippets/agentgateway.md" >}} to get token usage tracking and observability.

## About

The OpenAI Decisions API (`/v1/decisions`) answers a list of questions about an input. Each question is a predicate, a choice, or a score. The response returns one answer per question.

The TypeSafe SystemOne API (`/v1/systemone`) uses a different format for the same question types. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} translates requests and replies between the two formats to match the client and provider.

Review the following behavior of Decisions and SystemOne requests.

| Behavior | Detail |
| -- | -- |
| Model | The request must name a model, unless the provider sets a default model. |
| Telemetry | Both formats use the telemetry operation name `decisions`. When a response includes usage fields, telemetry records the model and token usage. |
| Policies | Request and response guardrails and the `prompts` policy do not apply to Decisions or SystemOne requests. |

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

### Custom provider requirements {#custom-providers-without-formats}

A `custom` provider must declare `decisions` or `systemOne` in `formats`. If `formats` is omitted or contains only other formats, both endpoints return `400`. The error names the request format and provider:

```console
failed to process LLM request: unsupported conversion: from Decisions to provider custom
```

In version 1.6, agentgateway forwarded both paths without conversion. After upgrading, add the format your upstream server supports to `formats` to keep serving these requests.

## Route type configuration

With the simplified `llm` configuration, no route setup is needed. Agentgateway maps `/v1/decisions` to `decisions` and `/v1/systemone` to `systemOne`.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

For a `custom` provider, declare the upstream format: `decisions` or `systemOne`. Agentgateway appends `/decisions` or `/systemone` to `baseUrl`. This example uses `decisions`.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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

For explicit routing, use the `gateways` and `routes` configuration. Map `/v1/decisions` to `decisions` in `policies.ai.routes`.

Without this map, requests default to `completions`. A Decisions request then fails with `failed to parse Completions request`.

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
        "/v1/decisions": "decisions"
        "/v1/chat/completions": "completions"
        "*": "passthrough"
    backendAuth:
      key: "$OPENAI_API_KEY"
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting | Description |
|---------|-------------|
| `policies.ai.routes."/v1/decisions"` | Processes requests on this path as Decisions requests. To accept SystemOne requests, also map `"/v1/systemone": "systemOne"`. |
| `policies.ai.routes."*"` | Passes requests on all other paths through unchanged. |

> [!NOTE]
> For detailed information about model routing and configuration modes, see [Model routing and aliases]({{< link-hextra path="/documentation/llm/about/" >}}).

## Using the API

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

The `noul` question type returns the probability that a statement is true. It corresponds to `predicate` in the Decisions API.

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
