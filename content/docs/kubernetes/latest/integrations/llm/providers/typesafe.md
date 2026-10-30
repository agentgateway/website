---
title: TypeSafe
weight: 20
icon: /integrations/providers/bw/typesafe.svg
description: Configure TypeSafe Jev as an LLM provider for agentgateway.
---

Configure TypeSafe Jev, TypeSafe's evaluation model, as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}. The `Typesafe` preset sends requests to TypeSafe in its native SystemOne format. Clients send OpenAI Decisions API requests, and {{< reuse "agw-docs/snippets/agentgateway.md" >}} translates them to SystemOne before they reach TypeSafe.

The preset accepts only Decisions and SystemOne requests. Chat Completions, Responses, and Messages requests to a TypeSafe model fail.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Allow the `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` route kind on the `http` listener of the `agentgateway-proxy` Gateway. For the steps, see [Enable LLM serving on a listener]({{< link-hextra path="/documentation/llm/models/serve/#enable-llm-serving-on-a-listener" >}}).

## Set up access to TypeSafe

Store your TypeSafe API key in a Secret, and create a model that uses the `Typesafe` preset. The model attaches directly to the Gateway listener, so you do not create an {{< reuse "agw-docs/snippets/backend.md" >}} or an HTTPRoute.

1. Get an API key from [TypeSafe](https://docs.typesafe.ai/api/system-one).

2. Save the API key in an environment variable.

   ```sh
   export TYPESAFE_API_KEY='<your-api-key>'
   ```

3. Create a Kubernetes Secret to store your API key.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: typesafe-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $TYPESAFE_API_KEY
   EOF
   ```

4. Create an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} that uses the `Typesafe` preset and references the Secret.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: AgentgatewayModel
   metadata:
     name: typesafe
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: jev-latest
     provider: Typesafe
     policies:
       auth:
         secretRef:
           name: typesafe-secret
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API docs]({{< link-hextra path="/reference/api/#agentgatewaymodelspec" >}}).

   | Setting | Description |
   |---------|-------------|
   | `spec.match.model` | The model name that clients send in requests. |
   | `spec.provider` | The `Typesafe` preset. The preset supplies the default URL, `https://api.typesafe.ai/v1`, and the SystemOne request format. |
   | `spec.policies.auth.secretRef` | The Secret that holds your TypeSafe API key. |

5. Send an OpenAI Decisions API request to the model. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} translates the request to the TypeSafe `/v1/systemone` API, and translates the response back to the Decisions format. The response answers each question in the request.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "http://$INGRESS_GW_ADDRESS/v1/decisions" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "jev-latest",
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
       "model": "jev-latest",
       "input": [{"role": "user", "content": [{"type": "input_text", "text": "The package was left in the rain and the box is soaked through."}]}],
       "questions": [{"type": "predicate", "name": "visible_damage", "instructions": "Does the customer report visible damage to the package?"}]
     }' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```json
   {
     "model": "jev-latest",
     "answers": [
       {"type": "predicate", "name": "visible_damage", "probability": 0.64}
     ],
     "usage": {"input_tokens": 156, "output_tokens": 0, "total_tokens": 156}
   }
   ```

## Next steps

For more information about Decisions requests, see [Decisions]({{< link-hextra path="/documentation/llm/api-types/decisions/" >}}). To declare the SystemOne format on a custom provider instead of the preset, see [Custom providers]({{< link-hextra path="/integrations/llm/providers/custom/" >}}).

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete AgentgatewayModel typesafe -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete secret typesafe-secret -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
