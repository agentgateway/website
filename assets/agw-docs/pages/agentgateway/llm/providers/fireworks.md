Configure [Fireworks AI](https://fireworks.ai/) as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}.

{{< callout type="info" >}}
In standalone mode, agentgateway 1.3 supports the first-class shortcut `provider: fireworks` and automatically fills `params.baseUrl: https://api.fireworks.ai/inference/v1`. The current Kubernetes `AgentgatewayBackend` API still uses `ai.provider.openai` for Fireworks AI's OpenAI-compatible endpoint, so the examples below use that shape.
{{< /callout >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up access to Fireworks AI

1. Create a [Fireworks API key](https://fireworks.ai/account/api-keys).

2. Save the API key in an environment variable.

   ```sh
   export FIREWORKS_API_KEY='<your-api-key>'
   ```

3. Create a Kubernetes secret to store the API key.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: fireworks-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $FIREWORKS_API_KEY
   EOF
   ```

4. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: fireworks
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: accounts/fireworks/models/llama-v3p1-70b-instruct
           host: api.fireworks.ai
           port: 443
           path: /inference/v1/chat/completions
     policies:
       auth:
         secretRef:
           name: fireworks-secret
       tls:
         sni: api.fireworks.ai
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   |---------|-------------|
   | Standalone shortcut | Use `provider: fireworks` in standalone mode. |
   | Standalone default base URL | `https://api.fireworks.ai/inference/v1` |
   | `ai.provider.openai` | Current Kubernetes workaround for Fireworks AI's OpenAI-compatible endpoint. |
   | `openai.model` | Sets the default model. This example uses `accounts/fireworks/models/llama-v3p1-70b-instruct`. |
   | `policies.auth.secretRef` | References the secret that contains your Fireworks API key. |

5. Create an HTTPRoute resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: fireworks
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /fireworks
       filters:
       - type: URLRewrite
         urlRewrite:
           hostname: api.fireworks.ai
       backendRefs:
       - name: fireworks
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

6. Send a request to verify the setup.

   ```sh
   curl "$INGRESS_GW_ADDRESS/fireworks" \
     -H "content-type: application/json" \
     -d '{
       "model": "accounts/fireworks/models/llama-v3p1-70b-instruct",
       "messages": [
         {
           "role": "user",
           "content": "Explain low-latency inference in one sentence."
         }
       ]
     }' | jq
   ```

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
