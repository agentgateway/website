Configure [Cohere](https://cohere.com/) as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}.

{{< callout type="info" >}}
In standalone mode, agentgateway 1.3 supports the first-class shortcut `provider: cohere` and automatically fills `params.baseUrl: https://api.cohere.ai`. The current Kubernetes `AgentgatewayBackend` API still uses `ai.provider.openai` for Cohere's compatibility endpoint, so the examples below use that shape.
{{< /callout >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up access to Cohere

1. Create a [Cohere API key](https://dashboard.cohere.com/api-keys).

2. Save the API key in an environment variable.

   ```sh
   export COHERE_API_KEY='<your-api-key>'
   ```

3. Create a Kubernetes secret to store the API key.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: cohere-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $COHERE_API_KEY
   EOF
   ```

4. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: cohere
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: command-r-plus
         host: api.cohere.ai
         port: 443
         path: /compatibility/v1/chat/completions
     policies:
       auth:
         secretRef:
           name: cohere-secret
       tls:
         sni: api.cohere.ai
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   |---------|-------------|
   | Standalone shortcut | Use `provider: cohere` in standalone mode. |
   | Standalone default base URL | `https://api.cohere.ai` |
   | `ai.provider.openai` | Current Kubernetes workaround for Cohere's compatibility endpoint. |
   | `path` | Uses Cohere's OpenAI-compatible chat endpoint at `/compatibility/v1/chat/completions`. |
   | `policies.auth.secretRef` | References the secret that contains your Cohere API key. |

5. Create an HTTPRoute resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: cohere
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /cohere
       filters:
       - type: URLRewrite
         urlRewrite:
           hostname: api.cohere.ai
       backendRefs:
       - name: cohere
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

6. Send a request to verify the setup.

   ```sh
   curl "$INGRESS_GW_ADDRESS/cohere" \
     -H "content-type: application/json" \
     -d '{
       "model": "command-r-plus",
       "messages": [
         {
           "role": "user",
           "content": "Explain retrieval-augmented generation in one sentence."
         }
       ]
     }' | jq
   ```

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
