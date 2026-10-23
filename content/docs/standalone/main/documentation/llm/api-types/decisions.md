---
title: Decisions
weight: 34
description: Route OpenAI Decisions and TypeSafe SystemOne requests through agentgateway and track token usage.
---

Route OpenAI Decisions API requests through {{< reuse "agw-docs/snippets/agentgateway.md" >}} to get token usage tracking and observability.

## About

The OpenAI Decisions API (`/v1/decisions`) answers a list of questions about an input. Each question is a predicate, a choice, or a score, and the response returns one answer for each question.

The TypeSafe SystemOne API (`/v1/systemone`) asks the same kinds of questions in a different shape. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} translates between the two formats in both directions. A client can send either format, and the provider receives the format that it supports.

Review the following behavior of Decisions and SystemOne requests.

| Behavior | Detail |
| -- | -- |
| Model | The request must name a model, unless the provider sets a default model. |
| Telemetry | When the response includes usage fields, LLM telemetry records the model and token usage, with the operation name `decisions`. SystemOne requests use the same operation name. |
| Policies | Request and response guardrails and the `prompts` policy do not apply to Decisions or SystemOne requests. |

### Supported providers {#supported-providers}

The following providers accept Decisions and SystemOne requests. Every other provider rejects them.

| Provider | Decisions requests (`/v1/decisions`) | SystemOne requests (`/v1/systemone`) |
|----------|--------------------------------------|--------------------------------------|
| [`openAI`]({{< link-hextra path="/integrations/llm/providers/openai/" >}}) | Sent natively. | Translated to the Decisions format. |
| [`typesafe`]({{< link-hextra path="/integrations/llm/providers/typesafe/" >}}) | Translated to the SystemOne format. | Sent natively. |
| [`azure`]({{< link-hextra path="/integrations/llm/providers/azure/" >}}) with the `foundry` resource type | Translated to the SystemOne format. | Sent natively. |
| [`custom`]({{< link-hextra path="/integrations/llm/providers/custom/" >}}) that declares the `decisions` format | Sent natively. | Translated to the Decisions format, unless the provider also declares `systemOne`. |
| [`custom`]({{< link-hextra path="/integrations/llm/providers/custom/" >}}) that declares the `systemOne` format | Translated to the SystemOne format, unless the provider also declares `decisions`. | Sent natively. |

A rejected request returns a `400` error that names the request format and the provider, such as the following.

```console
failed to process LLM request: unsupported conversion: from Decisions to provider custom
```

### Custom providers without a Decisions format {#custom-providers-without-formats}

A `custom` provider accepts Decisions and SystemOne requests only when its `formats` list declares `decisions` or `systemOne`. A `custom` provider without `formats` returns `400` on `/v1/decisions` and on `/v1/systemone`. So does a `custom` provider that declares only other formats, such as `completions`.

In version 1.6, agentgateway forwarded both paths to the provider without conversion. To keep serving these requests after you upgrade, add the format that the upstream server supports to the `formats` list.

## Route type configuration

In the simplified `llm` configuration, agentgateway automatically maps `/v1/decisions` requests to the `decisions` route type, and `/v1/systemone` requests to the `systemOne` route type. You do not need to configure routes.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

To use a `custom` provider, declare the format that the upstream server supports. The following example declares `decisions`. For a SystemOne upstream, declare `systemOne` instead. Agentgateway appends `/decisions` or `/systemone` to the `baseUrl`.

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

To configure the route type explicitly, use the `gateways` and `routes` format and set the `decisions` route type in the `policies.ai.routes` map. Without this entry, requests default to the `completions` route type, and a Decisions request fails with `failed to parse Completions request`.

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

To send the same question in the SystemOne format, send the input as `state` and the questions as a map keyed by name. In SystemOne, a `noul` question returns the probability that a statement is true. The Decisions API calls this question type `predicate`.

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
