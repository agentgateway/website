Configure [Perplexity](https://www.perplexity.ai/) as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}. Perplexity serves search-augmented models through an OpenAI-compatible API.

You can connect to Perplexity with an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} or an {{< reuse "agw-docs/snippets/backend.md" >}}. The two approaches accept different request formats. Choose the approach that matches the requests that your clients send.

| Approach | Requests that clients can send | Requests that fail |
|----------|--------------------------------|--------------------|
| {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} with `provider: Perplexity` | `/v1/responses`, sent to Perplexity unchanged. `/v1/messages`, converted to the Responses format. | `/v1/chat/completions`, embeddings, and rerank. Perplexity receives only Responses requests from this model. |
| {{< reuse "agw-docs/snippets/backend.md" >}} with the `openai` provider | Chat Completions requests on the route path, such as `/perplexity`. | Requests in other formats. Perplexity receives Chat Completions requests at `https://api.perplexity.ai/chat/completions`. |

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. To use the {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} approach, allow the `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` route kind on the `http` listener of the `agentgateway-proxy` Gateway. For the steps, see [Enable LLM serving on a listener]({{< link-hextra path="/documentation/llm/models/serve/#enable-llm-serving-on-a-listener" >}}).

## Set up provider credentials

Store your Perplexity API key in a Secret. The model and backend examples both reference this Secret.

1. Get an API key from [Perplexity](https://www.perplexity.ai/).

2. Save the API key in an environment variable.

   ```sh
   export PERPLEXITY_API_KEY='<your-api-key>'
   ```

3. Create a Kubernetes Secret to store your API key.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: perplexity-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $PERPLEXITY_API_KEY
   EOF
   ```

## Responses requests with an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} {#perplexity-model}

The model attaches directly to the Gateway listener, so you do not create an {{< reuse "agw-docs/snippets/backend.md" >}} or an HTTPRoute.

1. Create an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} that uses the `Perplexity` preset and references the Secret.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: AgentgatewayModel
   metadata:
     name: perplexity
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: perplexity/sonar
     provider: Perplexity
     policies:
       auth:
         secretRef:
           name: perplexity-secret
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API docs]({{< link-hextra path="/reference/api/#agentgatewaymodelspec" >}}).

   | Setting | Description |
   |---------|-------------|
   | `spec.match.model` | The model name that clients send in requests. Perplexity's Responses API uses model names with a vendor prefix, such as `perplexity/sonar`. |
   | `spec.provider` | The `Perplexity` preset. The preset supplies the default URL, `https://api.perplexity.ai/v1`, and the Responses request format. |
   | `spec.policies.auth.secretRef` | The Secret that holds your Perplexity API key. |

2. Send a Responses request to the model. Chat Completions requests to this model fail.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "http://$INGRESS_GW_ADDRESS/v1/responses" \
     -H 'Content-Type: application/json' \
     -d '{"model": "perplexity/sonar", "input": "Explain retrieval-augmented generation in one sentence."}' | jq
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/v1/responses" \
     -H 'Content-Type: application/json' \
     -d '{"model": "perplexity/sonar", "input": "Explain retrieval-augmented generation in one sentence."}' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}

## Chat Completions requests with an {{< reuse "agw-docs/snippets/backend.md" >}} {#perplexity-backend}

Use this approach to select the backend with an HTTPRoute.

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} that points the `openai` provider at Perplexity. Perplexity's chat completions path is `/chat/completions`, without the `/v1` prefix that most providers use. The Chat Completions API uses model names without the vendor prefix, such as `sonar` instead of the `perplexity/sonar` name that the Responses API uses.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: perplexity
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: sonar
         host: api.perplexity.ai
         port: 443
         path: /chat/completions
     policies:
       auth:
         secretRef:
           name: perplexity-secret
       tls:
         sni: api.perplexity.ai
   EOF
   ```

2. Create an HTTPRoute that routes requests on the `/perplexity` path to the {{< reuse "agw-docs/snippets/backend.md" >}}.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: perplexity
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /perplexity
       backendRefs:
       - name: perplexity
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: {{< reuse "agw-docs/snippets/group.md" >}}
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

3. Send a Chat Completions request to the route.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "http://$INGRESS_GW_ADDRESS/perplexity" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "sonar",
       "messages": [{"role": "user", "content": "Explain retrieval-augmented generation in one sentence."}]
     }' | jq
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/perplexity" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "sonar",
       "messages": [{"role": "user", "content": "Explain retrieval-augmented generation in one sentence."}]
     }' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}

## Next steps

To connect other providers that expose an OpenAI-compatible API, see [OpenAI-compatible providers]({{< link-hextra path="/integrations/llm/providers/openai-compatible/" >}}).

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete AgentgatewayModel perplexity -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete HTTPRoute perplexity -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} perplexity -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete secret perplexity-secret -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
