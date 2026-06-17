Configure [xAI](https://x.ai/) as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}.

{{< callout type="info" >}}
In standalone mode, agentgateway 1.3 supports the first-class shortcut `provider: xai` and automatically fills `params.baseUrl: https://api.x.ai/v1`. The current Kubernetes `AgentgatewayBackend` API still uses `ai.provider.openai` for xAI's OpenAI-compatible endpoint, so the examples below use that shape.
{{< /callout >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up access to xAI

1. Create an [xAI API key](https://console.x.ai/).

2. Save the API key in an environment variable.

   ```sh
   export XAI_API_KEY='<your-api-key>'
   ```

3. Create a Kubernetes secret to store the API key.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: xai-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $XAI_API_KEY
   EOF
   ```

4. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: xai
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: grok-2-latest
           host: api.x.ai
           port: 443
           path: /v1/chat/completions
     policies:
       auth:
         secretRef:
           name: xai-secret
       tls:
         sni: api.x.ai
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   |---------|-------------|
   | Standalone shortcut | Use `provider: xai` in standalone mode. |
   | Standalone default base URL | `https://api.x.ai/v1` |
   | `ai.provider.openai` | Current Kubernetes workaround for xAI's OpenAI-compatible endpoint. |
   | `openai.model` | Sets the default model. This example uses `grok-2-latest`. |
   | `policies.auth.secretRef` | References the secret that contains your xAI API key. |

5. Create an HTTPRoute resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: xai
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /xai
       filters:
       - type: URLRewrite
         urlRewrite:
           hostname: api.x.ai
       backendRefs:
       - name: xai
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

6. Send a request to verify the setup.

   ```sh
   curl "$INGRESS_GW_ADDRESS/xai" \
     -H "content-type: application/json" \
     -d '{
       "model": "grok-2-latest",
       "messages": [
         {
           "role": "user",
           "content": "Explain tool use in one sentence."
         }
       ]
     }' | jq
   ```

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
