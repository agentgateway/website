Configure [Baseten](https://baseten.co/) as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}.

{{< callout type="info" >}}
In standalone mode, agentgateway 1.3 supports the first-class shortcut `provider: baseten` and automatically fills `params.baseUrl: https://inference.baseten.co/v1`. The current Kubernetes `AgentgatewayBackend` API still uses `ai.provider.openai` for Baseten's OpenAI-compatible endpoint, so the examples below use that shape.
{{< /callout >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up access to Baseten

1. Create a [Baseten API key](https://app.baseten.co/settings/api_keys).

2. Save the API key in an environment variable.

   ```sh
   export BASETEN_API_KEY='<your-api-key>'
   ```

3. Create a Kubernetes secret to store the API key.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: baseten-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $BASETEN_API_KEY
   EOF
   ```

4. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: baseten
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: <your-baseten-model-id>
           host: inference.baseten.co
           port: 443
           path: /v1/chat/completions
     policies:
       auth:
         secretRef:
           name: baseten-secret
       tls:
         sni: inference.baseten.co
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   |---------|-------------|
   | Standalone shortcut | Use `provider: baseten` in standalone mode. |
   | Standalone default base URL | `https://inference.baseten.co/v1` |
   | `openai.model` | Replace `<your-baseten-model-id>` with the model or deployment ID exposed by your Baseten endpoint. |
   | `ai.provider.openai` | Current Kubernetes workaround for Baseten's OpenAI-compatible endpoint. |
   | `policies.auth.secretRef` | References the secret that contains your Baseten API key. |

5. Create an HTTPRoute resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: baseten
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /baseten
       filters:
       - type: URLRewrite
         urlRewrite:
           hostname: inference.baseten.co
       backendRefs:
       - name: baseten
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

6. Send a request to verify the setup.

   ```sh
   curl "$INGRESS_GW_ADDRESS/baseten" \
     -H "content-type: application/json" \
     -d '{
       "model": "<your-baseten-model-id>",
       "messages": [
         {
           "role": "user",
           "content": "Respond with the word hello."
         }
       ]
     }' | jq
   ```

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
