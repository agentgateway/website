---
title: Decisions
weight: 34
description: Route OpenAI Decisions API requests through agentgateway and track token usage.
---

Route OpenAI Decisions API requests through {{< reuse "agw-docs/snippets/agentgateway.md" >}} to get token usage tracking and observability.

## About

The OpenAI Decisions API answers a list of questions about an input. Each question is a predicate, a choice, or a score. The response returns one answer per question.

The TypeSafe SystemOne API (`/v1/systemone`) uses a different format for the same question types. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} translates requests and replies between the two formats to match the client and provider.

The following settings apply to both request formats.

| Behavior | Detail |
| -- | -- |
| Model | The request must name a model, unless the backend sets a default model. |
| Telemetry | Both formats use the telemetry operation name `decisions`. When a response includes OpenAI usage fields, telemetry records the model and token usage. |
| Policies | Request and response guardrails and the `prompts` policy do not apply to Decisions or SystemOne requests. |

### Supported providers {#supported-providers}

These providers accept Decisions and SystemOne requests. Other providers reject them.

| Provider | Decisions requests (`/v1/decisions`) | SystemOne requests (`/v1/systemone`) |
|----------|--------------------------------------|--------------------------------------|
| [OpenAI]({{< link-hextra path="/integrations/llm/providers/openai/" >}}) | Sent natively. | Translated to the Decisions format. |
| [TypeSafe]({{< link-hextra path="/integrations/llm/providers/typesafe/" >}}) | Translated to the SystemOne format. | Sent natively. |
| [Azure]({{< link-hextra path="/integrations/llm/providers/azure/" >}}) with the `Foundry` resource type | Translated to the SystemOne format. | Sent natively. |
| [Custom]({{< link-hextra path="/integrations/llm/providers/custom/" >}}) with `Decisions`, without `SystemOne` | Sent natively. | Translated to the Decisions format. |
| [Custom]({{< link-hextra path="/integrations/llm/providers/custom/" >}}) with `SystemOne`, without `Decisions` | Translated to the SystemOne format. | Sent natively. |

If a custom provider declares both formats, each request uses its original format.

A custom provider must declare `Decisions` or `SystemOne`. Otherwise, it rejects both request formats with a `400` error. The error names the request format and provider:

```console
failed to process LLM request: unsupported conversion: from Decisions to provider custom
```

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Set up access to the [OpenAI]({{< link-hextra path="/integrations/llm/providers/openai/" >}}) LLM provider.

## Map the Decisions route type

Requests default to the `Completions` route type. On your OpenAI {{< reuse "agw-docs/snippets/backend.md" >}}, map these paths:

- `/v1/decisions` to `Decisions`.
- `/v1/systemone` to `SystemOne`.

If you already set up [multiple endpoints]({{< link-hextra path="/integrations/llm/providers/multiple-endpoints/" >}}), add both paths to your existing {{< reuse "agw-docs/snippets/backend.md" >}}.

1. Update the `openai` {{< reuse "agw-docs/snippets/backend.md" >}} from the OpenAI setup guide. This command replaces that {{< reuse "agw-docs/snippets/backend.md" >}}.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: openai
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai: {}
     policies:
       auth:
         secretRef:
           name: openai-secret
       ai:
         routes:
           "/v1/decisions": "Decisions"
           "/v1/systemone": "SystemOne"
           "/v1/chat/completions": "Completions"
           "*": "Passthrough"
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API docs]({{< link-hextra path="/reference/api/#agentgatewaybackend" >}}).

   | Setting | Description |
   |---------|-------------|
   | `ai.provider.openai` | The OpenAI provider. The example sets no default `model`, so each request must name its model. |
   | `policies.ai.routes."/v1/decisions"` | Processes requests on this path as Decisions requests. Without this entry, the `"*": "Passthrough"` route forwards Decisions requests without processing them. If you omit `routes`, {{< reuse "agw-docs/snippets/agentgateway.md" >}} processes every request as a chat completion. |
   | `policies.ai.routes."/v1/systemone"` | Processes requests on this path as SystemOne requests. The OpenAI provider receives them translated to the Decisions format. |
   | `policies.ai.routes."*"` | Passes requests on all other paths through unchanged. |

## Send a Decisions request

Send a request with an input and a list of questions to the `/v1/decisions` path.

1. Send the request. Replace `<decisions-model>` with an OpenAI model that supports the Decisions API.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "http://$INGRESS_GW_ADDRESS/v1/decisions" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "<decisions-model>",
       "input": [{"role": "user", "content": [{"type": "input_text", "text": "The package was left in the rain and the box is soaked through."}]}],
       "questions": [{"type": "predicate", "name": "visible_damage", "instructions": "Does the customer report visible damage to the package?"}]
     }' | jq
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/v1/decisions" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "<decisions-model>",
       "input": [{"role": "user", "content": [{"type": "input_text", "text": "The package was left in the rain and the box is soaked through."}]}],
       "questions": [{"type": "predicate", "name": "visible_damage", "instructions": "Does the customer report visible damage to the package?"}]
     }' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}

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

2. Optional: Send the same question in SystemOne. Use `state` for the input and a map keyed by name for the questions.

   The `noul` question type returns the probability that a statement is true. It corresponds to `predicate` in the Decisions API.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "http://$INGRESS_GW_ADDRESS/v1/systemone" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "<decisions-model>",
       "state": [{"role": "user", "content": "The package was left in the rain and the box is soaked through."}],
       "questions": {"visible_damage": {"type": "noul", "instructions": "Does the customer report visible damage to the package?"}}
     }' | jq
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/v1/systemone" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "<decisions-model>",
       "state": [{"role": "user", "content": "The package was left in the rain and the box is soaked through."}],
       "questions": {"visible_damage": {"type": "noul", "instructions": "Does the customer report visible damage to the package?"}}
     }' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}

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

1. Port-forward the {{< reuse "agw-docs/snippets/agentgateway.md" >}} proxy on port 15020.

   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15020 &
   ```

2. Open the {{< reuse "agw-docs/snippets/agentgateway.md" >}} [metrics endpoint](http://localhost:15020/metrics).

3. Look for the `agentgateway_gen_ai_client_token_usage` metric. The metric includes labels for the token type (`input` or `output`) and the model.

For more information about LLM metrics, see [LLM cost tracking]({{< link-hextra path="/documentation/llm/cost-controls/cost-tracking/" >}}).

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

To restore the original {{< reuse "agw-docs/snippets/backend.md" >}}, apply the `openai` {{< reuse "agw-docs/snippets/backend.md" >}} from [OpenAI]({{< link-hextra path="/integrations/llm/providers/openai/" >}}) again.

To keep the {{< reuse "agw-docs/snippets/backend.md" >}} but stop processing Decisions and SystemOne requests, remove the `"/v1/decisions": "Decisions"` and `"/v1/systemone": "SystemOne"` entries from its `routes`.
