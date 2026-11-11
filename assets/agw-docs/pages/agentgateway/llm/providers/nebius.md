Configure [Nebius Token Factory](https://tokenfactory.nebius.com/) as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}. Nebius Token Factory serves open models through an OpenAI-compatible API.

You can connect to Nebius with an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} or an {{< reuse "agw-docs/snippets/backend.md" >}}. The `Nebius` model preset sends Chat Completions and Embeddings requests to Nebius. The {{< reuse "agw-docs/snippets/backend.md" >}} approach sends Chat Completions requests only. Nebius model names include the vendor prefix, such as `openai/gpt-oss-120b`.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. To use the {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} approach, allow the `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` route kind on the `http` listener of the `agentgateway-proxy` Gateway. For the steps, see [Enable LLM serving on a listener]({{< link-hextra path="/documentation/llm/models/serve/#enable-llm-serving-on-a-listener" >}}).

## Set up provider credentials

Store your Nebius API key in a Secret. The model and backend examples both reference this Secret.

1. Get an API key from [Nebius Token Factory](https://tokenfactory.nebius.com/).

2. Save the API key in an environment variable.

   ```sh
   export NEBIUS_API_KEY='<your-api-key>'
   ```

3. Create a Kubernetes Secret to store your API key.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: nebius-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $NEBIUS_API_KEY
   EOF
   ```

## Chat Completions and Embeddings requests with an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} {#nebius-model}

The models attach directly to the Gateway listener, so you do not create an {{< reuse "agw-docs/snippets/backend.md" >}} or an HTTPRoute.

1. Create the following {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} resources. The `nebius-chat` model serves `openai/gpt-oss-120b`, and the `nebius-embeddings` model serves `Qwen/Qwen3-Embedding-8B`.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: AgentgatewayModel
   metadata:
     name: nebius-chat
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: openai/gpt-oss-120b
     provider: Nebius
     policies:
       auth:
         secretRef:
           name: nebius-secret
   ---
   apiVersion: agentgateway.dev/v1alpha1
   kind: AgentgatewayModel
   metadata:
     name: nebius-embeddings
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: Qwen/Qwen3-Embedding-8B
     provider: Nebius
     policies:
       auth:
         secretRef:
           name: nebius-secret
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API docs]({{< link-hextra path="/reference/api/#agentgatewaymodelspec" >}}).

   | Setting | Description |
   |---------|-------------|
   | `spec.match.model` | The model name that clients send in requests. The model forwards the same name to Nebius. |
   | `spec.provider` | The `Nebius` preset. The preset supplies the default URL, `https://api.tokenfactory.nebius.com/v1`, and the Chat Completions and Embeddings request formats. |
   | `spec.policies.auth.secretRef` | The Secret that holds your Nebius API key. |

2. Send a Chat Completions request to the `openai/gpt-oss-120b` model.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "http://$INGRESS_GW_ADDRESS/v1/chat/completions" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "openai/gpt-oss-120b",
       "messages": [{"role": "user", "content": "Explain retrieval-augmented generation in one sentence."}]
     }' | jq
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/v1/chat/completions" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "openai/gpt-oss-120b",
       "messages": [{"role": "user", "content": "Explain retrieval-augmented generation in one sentence."}]
     }' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}

3. Send an Embeddings request to the `Qwen/Qwen3-Embedding-8B` model.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "http://$INGRESS_GW_ADDRESS/v1/embeddings" \
     -H 'Content-Type: application/json' \
     -d '{"model": "Qwen/Qwen3-Embedding-8B", "input": "Retrieval-augmented generation"}' | jq
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/v1/embeddings" \
     -H 'Content-Type: application/json' \
     -d '{"model": "Qwen/Qwen3-Embedding-8B", "input": "Retrieval-augmented generation"}' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}

## Chat Completions requests with an {{< reuse "agw-docs/snippets/backend.md" >}} {#nebius-backend}

Use this approach to select the backend with an HTTPRoute.

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} that points the `openai` provider at Nebius.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: nebius
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: openai/gpt-oss-120b
         host: api.tokenfactory.nebius.com
         port: 443
         path: /v1/chat/completions
     policies:
       auth:
         secretRef:
           name: nebius-secret
       tls:
         sni: api.tokenfactory.nebius.com
   EOF
   ```

2. Create an HTTPRoute that routes requests on the `/nebius` path to the {{< reuse "agw-docs/snippets/backend.md" >}}.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: nebius
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /nebius
       backendRefs:
       - name: nebius
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: {{< reuse "agw-docs/snippets/group.md" >}}
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

3. Send a Chat Completions request to the route.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "http://$INGRESS_GW_ADDRESS/nebius" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "openai/gpt-oss-120b",
       "messages": [{"role": "user", "content": "Explain retrieval-augmented generation in one sentence."}]
     }' | jq
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/nebius" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "openai/gpt-oss-120b",
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
kubectl delete AgentgatewayModel nebius-chat nebius-embeddings -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete HTTPRoute nebius -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} nebius -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete secret nebius-secret -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
