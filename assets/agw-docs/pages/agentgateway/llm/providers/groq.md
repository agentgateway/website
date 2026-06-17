Configure [Groq](https://groq.com/) as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}.

{{< callout type="info" >}}
In standalone mode, agentgateway 1.3 supports the first-class shortcut `provider: groq` and automatically fills `params.baseUrl: https://api.groq.com/openai/v1`. The current Kubernetes `AgentgatewayBackend` API still uses `ai.provider.openai` for Groq's OpenAI-compatible endpoint, so the examples below use that shape.
{{< /callout >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up access to Groq

1. Create a [Groq API key](https://console.groq.com/keys).

2. Save the API key in an environment variable.

   ```sh
   export GROQ_API_KEY='<your-api-key>'
   ```

3. Create a Kubernetes secret to store the API key.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: groq-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $GROQ_API_KEY
   EOF
   ```

4. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: groq
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: llama-3.3-70b-versatile
         host: api.groq.com
         port: 443
         path: /openai/v1/chat/completions
     policies:
       auth:
         secretRef:
           name: groq-secret
       tls:
         sni: api.groq.com
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   |---------|-------------|
   | Standalone shortcut | Use `provider: groq` in standalone mode. |
   | Standalone default base URL | `https://api.groq.com/openai/v1` |
   | `ai.provider.openai` | Current Kubernetes workaround for Groq's OpenAI-compatible endpoint. |
   | `ai.provider.openai.model` | Sets the default model. This example uses `llama-3.3-70b-versatile`. |
   | `policies.auth.secretRef` | References the secret that contains your Groq API key. |

5. Create an HTTPRoute resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: groq
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /groq
       filters:
       - type: URLRewrite
         urlRewrite:
           hostname: api.groq.com
       backendRefs:
       - name: groq
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

6. Send a request to verify the setup.

   ```sh
   curl "$INGRESS_GW_ADDRESS/groq" \
     -H "content-type: application/json" \
     -d '{
       "model": "llama-3.3-70b-versatile",
       "messages": [
         {
           "role": "user",
           "content": "Describe speculative decoding in one sentence."
         }
       ]
     }' | jq
   ```

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
