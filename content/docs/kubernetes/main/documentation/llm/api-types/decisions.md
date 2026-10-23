---
title: Decisions
weight: 34
description: Route OpenAI Decisions API requests through agentgateway and track token usage.
---

Route OpenAI Decisions API requests through {{< reuse "agw-docs/snippets/agentgateway.md" >}} to get token usage tracking and observability.

## About

The OpenAI Decisions API answers a list of questions about an input. Each question is a predicate, a choice, or a score, and the response returns one answer for each question.

The TypeSafe SystemOne API (`/v1/systemone`) asks the same kinds of questions in a different shape. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} translates between the two formats in both directions. A client can send either format, and the provider receives the format that it supports.

{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} processes a request as a Decisions request only when the request path maps to the `Decisions` route type, and as a SystemOne request only when the path maps to the `SystemOne` route type. Review the following behavior of Decisions requests.

| Behavior | Detail |
| -- | -- |
| Model | The request must name a model, unless the backend sets a default model. |
| Telemetry | When the response includes OpenAI usage fields, LLM telemetry records the model and token usage, with the operation name `decisions`. SystemOne requests use the same operation name. |
| Policies | Request and response guardrails and the `prompts` policy do not apply to Decisions or SystemOne requests. |

### Supported providers {#supported-providers}

The following providers accept Decisions and SystemOne requests. Every other provider rejects them.

| Provider | Decisions requests (`/v1/decisions`) | SystemOne requests (`/v1/systemone`) |
|----------|--------------------------------------|--------------------------------------|
| [OpenAI]({{< link-hextra path="/integrations/llm/providers/openai/" >}}) | Sent natively. | Translated to the Decisions format. |
| [TypeSafe]({{< link-hextra path="/integrations/llm/providers/typesafe/" >}}) | Translated to the SystemOne format. | Sent natively. |
| [Azure]({{< link-hextra path="/integrations/llm/providers/azure/" >}}) with the `Foundry` resource type | Translated to the SystemOne format. | Sent natively. |
| [Custom]({{< link-hextra path="/integrations/llm/providers/custom/" >}}) that declares the `Decisions` format | Sent natively. | Translated to the Decisions format, unless the provider also declares `SystemOne`. |
| [Custom]({{< link-hextra path="/integrations/llm/providers/custom/" >}}) that declares the `SystemOne` format | Translated to the SystemOne format, unless the provider also declares `Decisions`. | Sent natively. |

A custom provider that declares neither `Decisions` nor `SystemOne`, such as one that declares only `Completions`, rejects both request formats. A rejected request returns a `400` error that names the request format and the provider, such as the following.

```console
failed to process LLM request: unsupported conversion: from Decisions to provider custom
```

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Set up access to the [OpenAI]({{< link-hextra path="/integrations/llm/providers/openai/" >}}) LLM provider.

## Map the Decisions route type

Requests default to the `Completions` route type, so map the `/v1/decisions` path to the `Decisions` route type, and the `/v1/systemone` path to the `SystemOne` route type, on your OpenAI {{< reuse "agw-docs/snippets/backend.md" >}}. If you already set up [multiple endpoints]({{< link-hextra path="/integrations/llm/providers/multiple-endpoints/" >}}), add the `/v1/decisions` path to your existing {{< reuse "agw-docs/snippets/backend.md" >}} instead.

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

2. Optional: Send the same question in the SystemOne format. SystemOne takes the input as `state` and the questions as a map keyed by name. In SystemOne, a `noul` question returns the probability that a statement is true. The Decisions API calls this question type `predicate`.

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

To restore the original {{< reuse "agw-docs/snippets/backend.md" >}}, apply the `openai` {{< reuse "agw-docs/snippets/backend.md" >}} from [OpenAI]({{< link-hextra path="/integrations/llm/providers/openai/" >}}) again. To keep the {{< reuse "agw-docs/snippets/backend.md" >}} but stop processing Decisions and SystemOne requests, remove the `"/v1/decisions": "Decisions"` and `"/v1/systemone": "SystemOne"` entries from its `routes`.
