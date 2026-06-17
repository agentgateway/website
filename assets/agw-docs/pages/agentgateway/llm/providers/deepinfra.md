Configure [DeepInfra](https://deepinfra.com/) as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}.

{{< callout type="info" >}}
In standalone mode, agentgateway 1.3 supports the first-class shortcut `provider: deepinfra` and automatically fills `params.baseUrl: https://api.deepinfra.com/v1/openai`. The current Kubernetes `AgentgatewayBackend` API still uses `ai.provider.openai` for DeepInfra's OpenAI-compatible endpoint, so the examples below use that shape.
{{< /callout >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up access to DeepInfra

1. Create a [DeepInfra API key](https://deepinfra.com/dash/api_keys).

2. Save the API key in an environment variable.

   ```sh
   export DEEPINFRA_API_KEY='<your-api-key>'
   ```

3. Create a Kubernetes secret to store the API key.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: deepinfra-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $DEEPINFRA_API_KEY
   EOF
   ```

4. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: deepinfra
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: meta-llama/Llama-3.3-70B-Instruct-Turbo
           host: api.deepinfra.com
           port: 443
           path: /v1/openai/chat/completions
     policies:
       auth:
         secretRef:
           name: deepinfra-secret
       tls:
         sni: api.deepinfra.com
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   |---------|-------------|
   | Standalone shortcut | Use `provider: deepinfra` in standalone mode. |
   | Standalone default base URL | `https://api.deepinfra.com/v1/openai` |
   | `ai.provider.openai` | Current Kubernetes workaround for DeepInfra's OpenAI-compatible endpoint. |
   | `openai.model` | Sets the default model. This example uses `meta-llama/Llama-3.3-70B-Instruct-Turbo`. |
   | `policies.auth.secretRef` | References the secret that contains your DeepInfra API key. |

5. Create an HTTPRoute resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: deepinfra
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /deepinfra
       filters:
       - type: URLRewrite
         urlRewrite:
           hostname: api.deepinfra.com
       backendRefs:
       - name: deepinfra
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

6. Send a request to verify the setup.

   ```sh
   curl "$INGRESS_GW_ADDRESS/deepinfra" \
     -H "content-type: application/json" \
     -d '{
       "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
       "messages": [
         {
           "role": "user",
           "content": "Give one sentence on how mixture-of-experts models work."
         }
       ]
     }' | jq
   ```

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
