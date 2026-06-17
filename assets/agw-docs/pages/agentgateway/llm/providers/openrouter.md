Configure [OpenRouter](https://openrouter.ai/) as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}.

{{< callout type="info" >}}
In standalone mode, agentgateway 1.3 supports the first-class shortcut `provider: openrouter` and automatically fills `params.baseUrl: https://openrouter.ai/api/v1`. The current Kubernetes `AgentgatewayBackend` API still uses `ai.provider.openai` for OpenRouter's OpenAI-compatible endpoint, so the examples below use that shape.
{{< /callout >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up access to OpenRouter

1. Create an [OpenRouter API key](https://openrouter.ai/settings/keys).

2. Save the API key in an environment variable.

   ```sh
   export OPENROUTER_API_KEY='<your-api-key>'
   ```

3. Create a Kubernetes secret to store the API key.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: openrouter-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $OPENROUTER_API_KEY
   EOF
   ```

4. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: openrouter
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: openai/gpt-4o-mini
           host: openrouter.ai
           port: 443
           path: /api/v1/chat/completions
     policies:
       auth:
         secretRef:
           name: openrouter-secret
       tls:
         sni: openrouter.ai
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   |---------|-------------|
   | Standalone shortcut | Use `provider: openrouter` in standalone mode. |
   | Standalone default base URL | `https://openrouter.ai/api/v1` |
   | `ai.provider.openai` | Current Kubernetes workaround for OpenRouter's OpenAI-compatible endpoint. |
   | `openai.model` | Sets the default model. This example uses `openai/gpt-4o-mini`. |
   | `policies.auth.secretRef` | References the secret that contains your OpenRouter API key. |

5. Create an HTTPRoute resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: openrouter
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /openrouter
       filters:
       - type: URLRewrite
         urlRewrite:
           hostname: openrouter.ai
       backendRefs:
       - name: openrouter
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

6. Send a request to verify the setup.

   ```sh
   curl "$INGRESS_GW_ADDRESS/openrouter" \
     -H "content-type: application/json" \
     -d '{
       "model": "openai/gpt-4o-mini",
       "messages": [
         {
           "role": "user",
           "content": "Explain cross-provider model routing in one sentence."
         }
       ]
     }' | jq
   ```

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
