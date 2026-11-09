---
title: Nebius Token Factory
weight: 24
description: Configure Nebius Token Factory as an LLM provider for agentgateway.
---

Configure Nebius Token Factory as an LLM provider in agentgateway. The `Nebius` preset uses `https://api.tokenfactory.nebius.com/v1` as the default base URL. The preset serves Chat Completions and Embeddings requests.

## Before you begin {#before-you-begin}

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Allow the {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} route kind on the `http` listener of the `agentgateway-proxy` Gateway. For the steps, see [Enable LLM serving on a listener]({{< link-hextra path="/documentation/llm/models/serve/#enable-llm-serving-on-a-listener" >}}).
3. Get a Nebius API key and choose a Nebius model. The following examples use `openai/gpt-oss-120b` for Chat Completions and `Qwen/Qwen3-Embedding-8B` for embeddings.

## Set up Nebius {#set-up-nebius}

Store your Nebius API key in a Secret. Then, create a model that uses the `Nebius` preset. The model attaches directly to the Gateway listener, so you do not create an {{< reuse "agw-docs/snippets/backend.md" >}} or an HTTPRoute.

1. Save the API key in an environment variable.

   ```sh
   export NEBIUS_API_KEY='<your-api-key>'
   ```

2. Create a Kubernetes Secret to store your API key.

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

3. Create an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} that uses the `Nebius` preset and references the Secret.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
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
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API docs]({{< link-hextra path="/reference/api/#agentgatewaymodelspec" >}}).

   | Setting | Description |
   |---------|-------------|
   | `spec.match.model` | The model name that clients send in requests. |
   | `spec.provider` | The `Nebius` preset. The preset supplies the default URL, `https://api.tokenfactory.nebius.com/v1`, and the Chat Completions and Embeddings request formats. |
   | `spec.policies.auth.secretRef` | The Secret that holds your Nebius API key. |

4. Send a Chat Completions request to the model.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "http://$INGRESS_GW_ADDRESS/v1/chat/completions" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "openai/gpt-oss-120b",
       "messages": [{"role": "user", "content": "Explain model routing in one sentence."}]
     }' | jq
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/v1/chat/completions" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "openai/gpt-oss-120b",
       "messages": [{"role": "user", "content": "Explain model routing in one sentence."}]
     }' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}

To serve embeddings, create another {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} that uses `provider: Nebius` and a Nebius embedding model, such as `Qwen/Qwen3-Embedding-8B`. Then, clients can send embeddings requests to `/v1/embeddings` with that model name.

## Cleanup {#cleanup}

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete AgentgatewayModel nebius-chat -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete secret nebius-secret -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
