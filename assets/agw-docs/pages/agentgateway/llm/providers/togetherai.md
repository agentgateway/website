Configure [Together AI](https://www.together.ai/) as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}.

{{< callout type="info" >}}
In standalone mode, agentgateway 1.3 supports the first-class shortcut `provider: togetherai` and automatically fills `params.baseUrl: https://api.together.xyz/v1`. The current Kubernetes `AgentgatewayBackend` API still uses `ai.provider.openai` for Together AI's OpenAI-compatible endpoint, so the examples below use that shape.
{{< /callout >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up access to Together AI

1. Create a [Together AI API key](https://api.together.xyz/settings/api-keys).

2. Save the API key in an environment variable.

   ```sh
   export TOGETHER_API_KEY='<your-api-key>'
   ```

3. Create a Kubernetes secret to store the API key.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: togetherai-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $TOGETHER_API_KEY
   EOF
   ```

4. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: togetherai
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: meta-llama/Llama-3.3-70B-Instruct-Turbo
           host: api.together.xyz
           port: 443
           path: /v1/chat/completions
     policies:
       auth:
         secretRef:
           name: togetherai-secret
       tls:
         sni: api.together.xyz
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   |---------|-------------|
   | Standalone shortcut | Use `provider: togetherai` in standalone mode. |
   | Standalone default base URL | `https://api.together.xyz/v1` |
   | `ai.provider.openai` | Current Kubernetes workaround for Together AI's OpenAI-compatible endpoint. |
   | `openai.model` | Sets the default model. This example uses `meta-llama/Llama-3.3-70B-Instruct-Turbo`. |
   | `policies.auth.secretRef` | References the secret that contains your Together AI API key. |

5. Create an HTTPRoute resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: togetherai
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /togetherai
       filters:
       - type: URLRewrite
         urlRewrite:
           hostname: api.together.xyz
       backendRefs:
       - name: togetherai
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

6. Send a request to verify the setup.

   ```sh
   curl "$INGRESS_GW_ADDRESS/togetherai" \
     -H "content-type: application/json" \
     -d '{
       "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
       "messages": [
         {
           "role": "user",
           "content": "Explain batched inference in one sentence."
         }
       ]
     }' | jq
   ```

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
