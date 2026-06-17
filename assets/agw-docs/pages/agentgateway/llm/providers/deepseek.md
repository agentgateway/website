Configure [DeepSeek](https://www.deepseek.com/) as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}.

{{< callout type="info" >}}
In standalone mode, agentgateway 1.3 supports the first-class shortcut `provider: deepseek` and automatically fills `params.baseUrl: https://api.deepseek.com/v1`. The current Kubernetes `AgentgatewayBackend` API still uses `ai.provider.openai` for DeepSeek's OpenAI-compatible endpoint, so the examples below use that shape.
{{< /callout >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up access to DeepSeek

1. Create a [DeepSeek API key](https://platform.deepseek.com/).

2. Save the API key in an environment variable.

   ```sh
   export DEEPSEEK_API_KEY='<your-api-key>'
   ```

3. Create a Kubernetes secret to store the API key.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: deepseek-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $DEEPSEEK_API_KEY
   EOF
   ```

4. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: deepseek
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: deepseek-chat
         host: api.deepseek.com
         port: 443
         path: /v1/chat/completions
     policies:
       auth:
         secretRef:
           name: deepseek-secret
       tls:
         sni: api.deepseek.com
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   |---------|-------------|
   | Standalone shortcut | Use `provider: deepseek` in standalone mode. |
   | Standalone default base URL | `https://api.deepseek.com/v1` |
   | `ai.provider.openai` | Current Kubernetes workaround for DeepSeek's OpenAI-compatible endpoint. |
   | `ai.provider.openai.model` | Sets the default model. This example uses `deepseek-chat`. |
   | `policies.auth.secretRef` | References the secret that contains your DeepSeek API key. |

5. Create an HTTPRoute resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: deepseek
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /deepseek
       filters:
       - type: URLRewrite
         urlRewrite:
           hostname: api.deepseek.com
       backendRefs:
       - name: deepseek
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

6. Send a request to verify the setup.

   ```sh
   curl "$INGRESS_GW_ADDRESS/deepseek" \
     -H "content-type: application/json" \
     -d '{
       "model": "deepseek-chat",
       "messages": [
         {
           "role": "user",
           "content": "Explain chain-of-thought redaction in one sentence."
         }
       ]
     }' | jq
   ```

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
