Configure [Mistral](https://mistral.ai/) as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}.

{{< callout type="info" >}}
In standalone mode, agentgateway 1.3 supports the first-class shortcut `provider: mistral` and automatically fills `params.baseUrl: https://api.mistral.ai/v1`. The current Kubernetes `AgentgatewayBackend` API still uses `ai.provider.openai` for Mistral's OpenAI-compatible endpoint, so the examples below use that shape.
{{< /callout >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up access to Mistral

1. Create a [Mistral API key](https://console.mistral.ai/api-keys/).

2. Save the API key in an environment variable.

   ```sh
   export MISTRAL_API_KEY='<your-api-key>'
   ```

3. Create a Kubernetes secret to store the API key.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: mistral-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $MISTRAL_API_KEY
   EOF
   ```

4. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: mistral
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: mistral-small-latest
           host: api.mistral.ai
           port: 443
           path: /v1/chat/completions
     policies:
       auth:
         secretRef:
           name: mistral-secret
       tls:
         sni: api.mistral.ai
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   |---------|-------------|
   | Standalone shortcut | Use `provider: mistral` in standalone mode. |
   | Standalone default base URL | `https://api.mistral.ai/v1` |
   | `ai.provider.openai` | Current Kubernetes workaround for Mistral's OpenAI-compatible endpoint. |
   | `openai.model` | Sets the default model. This example uses `mistral-small-latest`. |
   | `policies.auth.secretRef` | References the secret that contains your Mistral API key. |

5. Create an HTTPRoute resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: mistral
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /mistral
       filters:
       - type: URLRewrite
         urlRewrite:
           hostname: api.mistral.ai
       backendRefs:
       - name: mistral
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

6. Send a request to verify the setup.

   ```sh
   curl "$INGRESS_GW_ADDRESS/mistral" \
     -H "content-type: application/json" \
     -d '{
       "model": "mistral-small-latest",
       "messages": [
         {
           "role": "user",
           "content": "Explain mixture-of-experts models in one sentence."
         }
       ]
     }' | jq
   ```

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
