---
title: Decisions
weight: 34
description: Route OpenAI Decisions API requests through agentgateway and track token usage.
---

Route OpenAI Decisions API requests through {{< reuse "agw-docs/snippets/agentgateway.md" >}} to get token usage tracking and observability.

## About

The OpenAI Decisions API answers a list of questions about an input. Each question is a predicate, a choice, or a score, and the response returns one answer for each question.

The following providers accept Decisions requests. Other providers reject them.

* [OpenAI]({{< link-hextra path="/integrations/llm/providers/openai/" >}}) accepts Decisions requests natively.
* [TypeSafe]({{< link-hextra path="/integrations/llm/providers/typesafe/" >}}) accepts them after {{< reuse "agw-docs/snippets/agentgateway.md" >}} translates them to the SystemOne format.
* [Azure]({{< link-hextra path="/integrations/llm/providers/azure/" >}}) accepts them for Azure AI Foundry resources, after {{< reuse "agw-docs/snippets/agentgateway.md" >}} translates them to the SystemOne format.
* [Custom providers]({{< link-hextra path="/integrations/llm/providers/custom/" >}}) accept them when they declare the `Decisions` or `SystemOne` format.

{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} processes a request as a Decisions request only when the request path maps to the `Decisions` route type. Review the following behavior of Decisions requests.

| Behavior | Detail |
| -- | -- |
| Model | The request must name a model, unless the backend sets a default model. |
| Telemetry | When the response includes OpenAI usage fields, LLM telemetry records the model and token usage, with the operation name `decisions`. |
| Policies | Request and response guardrails and the `prompts` policy do not apply to Decisions requests. |

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Set up access to the [OpenAI]({{< link-hextra path="/integrations/llm/providers/openai/" >}}) LLM provider.

## Map the Decisions route type

Requests default to the `Completions` route type, so map the `/v1/decisions` path to the `Decisions` route type on your OpenAI {{< reuse "agw-docs/snippets/backend.md" >}}. If you already set up [multiple endpoints]({{< link-hextra path="/integrations/llm/providers/multiple-endpoints/" >}}), add the `/v1/decisions` path to your existing {{< reuse "agw-docs/snippets/backend.md" >}} instead.

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
           "/v1/chat/completions": "Completions"
           "*": "Passthrough"
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API docs]({{< link-hextra path="/reference/api/#agentgatewaybackend" >}}).

   | Setting | Description |
   |---------|-------------|
   | `ai.provider.openai` | The OpenAI provider. The example sets no default `model`, so each request must name its model. |
   | `policies.ai.routes."/v1/decisions"` | Processes requests on this path as Decisions requests. Without this entry, the `"*": "Passthrough"` route forwards Decisions requests without processing them. If you omit `routes`, {{< reuse "agw-docs/snippets/agentgateway.md" >}} processes every request as a chat completion. |
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

To restore the original {{< reuse "agw-docs/snippets/backend.md" >}}, apply the `openai` {{< reuse "agw-docs/snippets/backend.md" >}} from [OpenAI]({{< link-hextra path="/integrations/llm/providers/openai/" >}}) again. To keep the {{< reuse "agw-docs/snippets/backend.md" >}} but stop processing Decisions requests, remove the `"/v1/decisions": "Decisions"` entry from its `routes`.
