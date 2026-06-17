Configure [Hugging Face](https://huggingface.co/) as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}.

{{< callout type="info" >}}
In standalone mode, agentgateway 1.3 supports the first-class shortcut `provider: huggingface` and automatically fills `params.baseUrl: https://router.huggingface.co/v1`. The current Kubernetes `AgentgatewayBackend` API still uses `ai.provider.openai` for Hugging Face's OpenAI-compatible endpoint, so the examples below use that shape.
{{< /callout >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up access to Hugging Face

1. Create a [Hugging Face access token](https://huggingface.co/settings/tokens).

2. Save the access token in an environment variable.

   ```sh
   export HF_API_KEY='<your-api-key>'
   ```

3. Create a Kubernetes secret to store the access token.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: huggingface-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $HF_API_KEY
   EOF
   ```

4. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: huggingface
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: meta-llama/Llama-3.1-70B-Instruct
           host: router.huggingface.co
           port: 443
           path: /v1/chat/completions
     policies:
       auth:
         secretRef:
           name: huggingface-secret
       tls:
         sni: router.huggingface.co
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   |---------|-------------|
   | Standalone shortcut | Use `provider: huggingface` in standalone mode. |
   | Standalone default base URL | `https://router.huggingface.co/v1` |
   | `ai.provider.openai` | Current Kubernetes workaround for Hugging Face's OpenAI-compatible endpoint. |
   | `openai.model` | Sets the default model. This example uses `meta-llama/Llama-3.1-70B-Instruct`. |
   | `policies.auth.secretRef` | References the secret that contains your Hugging Face access token. |

5. Create an HTTPRoute resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: huggingface
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /huggingface
       filters:
       - type: URLRewrite
         urlRewrite:
           hostname: router.huggingface.co
       backendRefs:
       - name: huggingface
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

6. Send a request to verify the setup.

   ```sh
   curl "$INGRESS_GW_ADDRESS/huggingface" \
     -H "content-type: application/json" \
     -d '{
       "model": "meta-llama/Llama-3.1-70B-Instruct",
       "messages": [
         {
           "role": "user",
           "content": "Explain model routing in one sentence."
         }
       ]
     }' | jq
   ```

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
