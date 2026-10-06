Configure OpenAI-compatible LLM providers with an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} or {{< reuse "agw-docs/snippets/backend.md" >}} resource.

## Overview

Choose the resource that matches how you want to route requests. Both approaches use the provider credentials that you create on this page.

| Resource | When to use it |
|----------|----------------|
| `AgentgatewayModel` | Route by the model name in the request and serve standard LLM paths, such as `/v1/chat/completions`. Provider presets supply the default URL and supported request formats. |
| `AgentgatewayBackend` with an `HTTPRoute` | Configure routing by path, header, or other HTTPRoute matches. For the providers on this page, set `spec.ai.provider.openai` and configure the upstream host and path. |

The {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} API is enabled by default in agentgateway 1.6. For more information about the two approaches, see [About models]({{< link-hextra path="/documentation/llm/models/about/#model-centric-vs-route-centric-configuration" >}}).

### Built-in OpenAI-compatible providers

For an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}, use the case-sensitive `spec.provider` value in the table. You can omit `spec.baseURL` to use the preset's default URL. For an {{< reuse "agw-docs/snippets/backend.md" >}}, use the host and path columns with `port: 443`.

| Provider | Model `spec.provider` | Backend `host` | Backend `path` |
|----------|-----------------------|----------------|----------------|
| Baseten | `Baseten` | `inference.baseten.co` | `/v1/chat/completions` |
| Cerebras | `Cerebras` | `api.cerebras.ai` | `/v1/chat/completions` |
| Cohere | `Cohere` | `api.cohere.ai` | `/compatibility/v1/chat/completions` |
| DeepInfra | `Deepinfra` | `api.deepinfra.com` | `/v1/openai/chat/completions` |
| DeepSeek | `Deepseek` | `api.deepseek.com` | `/v1/chat/completions` |
| Fireworks AI | `Fireworks` | `api.fireworks.ai` | `/inference/v1/chat/completions` |
| Groq | `Groq` | `api.groq.com` | `/openai/v1/chat/completions` |
| Hugging Face | `Huggingface` | `router.huggingface.co` | `/v1/chat/completions` |
| Meta | `Meta` | `api.meta.ai` | `/v1/chat/completions` |
| Mistral AI | `Mistral` | `api.mistral.ai` | `/v1/chat/completions` |
| OpenRouter | `Openrouter` | `openrouter.ai` | `/api/v1/chat/completions` |
| Together AI | `TogetherAI` | `api.together.xyz` | `/v1/chat/completions` |
| xAI | `XAI` | `api.x.ai` | `/v1/chat/completions` |

If your provider is not in this list but still exposes the OpenAI Chat Completions API, use the [generic endpoint](#generic-openai-compatible-endpoint) template. If the upstream does not match the OpenAI API format, use [custom providers]({{< link-hextra path="/integrations/llm/providers/custom/" >}}) instead.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up provider credentials

Create a Secret with an API key for the provider that you want to use. The model and backend examples both reference this Secret. Complete one configuration path after you create the credentials.

{{< doc-test paths="openai-compatible-validate" >}}
# Validate the visible Secret, model, backend, and HTTPRoute manifests against
# the installed CRDs. Do not persist resources or call a provider API.
export MY_API_KEY="test"
kubectl() {
  command kubectl "$@" --dry-run=server
}
{{< /doc-test >}}

1. Get an API key for your provider. For Meta, create a key in the [Meta Model API dashboard](https://dev.meta.ai/).

2. Save the API key in an environment variable.

   ```sh
   export MY_API_KEY='<your-api-key>'
   ```

3. Create a Kubernetes secret to store your API key.

   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: llm-provider-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $MY_API_KEY
   EOF
   ```

## Configure an AgentgatewayModel

Use a provider preset to serve standard LLM APIs through the gateway. Each example uses the provider's default URL and the Secret from the previous section. The model names in the tabs are examples. Use a model that your provider supports.

1. [Enable LLM serving on a listener]({{< link-hextra path="/documentation/llm/models/serve/#enable-llm-serving-on-a-listener" >}}). The listener must allow the `AgentgatewayModel` route kind. The examples below attach to the `http` listener of the `agentgateway-proxy` Gateway.

2. Create the model. Select the tab for your provider and use that provider's API key in the Secret. Set `spec.match.model` to the model that you want to serve.

   {{< tabs >}}
   {{% tab name="Baseten" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: llm-model
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: meta-llama/Llama-3.1-8B-Instruct
     provider: Baseten
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Cerebras" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: llm-model
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: llama-3.3-70b
     provider: Cerebras
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Cohere" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: llm-model
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: command-r-plus
     provider: Cohere
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
   EOF
   ```
   {{% /tab %}}
   {{% tab name="DeepInfra" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: llm-model
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: meta-llama/Meta-Llama-3.1-8B-Instruct
     provider: Deepinfra
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
   EOF
   ```
   {{% /tab %}}
   {{% tab name="DeepSeek" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: llm-model
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: deepseek-chat
     provider: Deepseek
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Fireworks AI" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: llm-model
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: accounts/fireworks/models/llama-v3p1-70b-instruct
     provider: Fireworks
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Groq" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: llm-model
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: llama-3.3-70b-versatile
     provider: Groq
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Hugging Face" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: llm-model
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: meta-llama/Llama-3.1-8B-Instruct
     provider: Huggingface
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Meta" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: llm-model
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: muse-spark-1.3
     provider: Meta
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Mistral AI" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: llm-model
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: mistral-large-latest
     provider: Mistral
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
   EOF
   ```
   {{% /tab %}}
   {{% tab name="OpenRouter" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: llm-model
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: openai/gpt-4o
     provider: Openrouter
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Together AI" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: llm-model
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo
     provider: TogetherAI
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
   EOF
   ```
   {{% /tab %}}
   {{% tab name="xAI" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: llm-model
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: grok-2-latest
     provider: XAI
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
   EOF
   ```
   {{% /tab %}}
   {{< /tabs >}}

   | Setting | Description |
   |---------|-------------|
   | `spec.parentRefs` | Attaches the model to the `http` listener of `agentgateway-proxy` in the same namespace. This listener serves the model without a separate backend or HTTPRoute. |
   | `spec.match.model` | The model name that clients send in requests. Each example forwards the same name to the provider. |
   | `spec.provider` | The provider preset, such as `Meta` or `Groq`. The preset supplies the URL and request formats. |
   | `spec.policies.auth.secretRef.name` | The Secret that contains the provider API key in its `Authorization` entry. The Secret must be in the model's namespace. |

   To override a preset's URL, set `spec.baseURL`. For the URL format and examples, see [Providers]({{< link-hextra path="/documentation/llm/models/about/#providers" >}}).

3. Send a request through the gateway. The model endpoint is `/v1/chat/completions`. Replace `<your-model>` with the `spec.match.model` value from your model configuration.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "http://$INGRESS_GW_ADDRESS/v1/chat/completions" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "<your-model>",
       "messages": [{"role": "user", "content": "Explain retrieval-augmented generation in one sentence."}]
     }' | jq
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   Use the port-forward from the listener setup guide.

   ```sh
   curl http://localhost:8080/v1/chat/completions \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "<your-model>",
       "messages": [{"role": "user", "content": "Explain retrieval-augmented generation in one sentence."}]
     }' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}

## Configure an AgentgatewayBackend {#set-up-access-to-an-openai-compatible-provider}

Use this approach to select the backend with an HTTPRoute. The examples configure Chat Completions through `spec.ai.provider.openai` and expose the backend on `/llm`. The model names in the tabs are examples. Use a model that your provider supports.

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource that points the `openai` provider at your provider's host and path. Select the tab for your provider.

   {{< tabs >}}
   {{% tab name="Baseten" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: llm-backend
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: meta-llama/Llama-3.1-8B-Instruct
         host: inference.baseten.co
         port: 443
         path: /v1/chat/completions
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
       tls:
         sni: inference.baseten.co
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Cerebras" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: llm-backend
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: llama-3.3-70b
         host: api.cerebras.ai
         port: 443
         path: /v1/chat/completions
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
       tls:
         sni: api.cerebras.ai
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Cohere" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: llm-backend
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
           name: llm-provider-secret
       tls:
         sni: api.cohere.ai
   EOF
   ```
   {{% /tab %}}
   {{% tab name="DeepInfra" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: llm-backend
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: meta-llama/Meta-Llama-3.1-8B-Instruct
         host: api.deepinfra.com
         port: 443
         path: /v1/openai/chat/completions
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
       tls:
         sni: api.deepinfra.com
   EOF
   ```
   {{% /tab %}}
   {{% tab name="DeepSeek" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: llm-backend
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
           name: llm-provider-secret
       tls:
         sni: api.deepseek.com
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Fireworks AI" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: llm-backend
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
           name: llm-provider-secret
       tls:
         sni: api.fireworks.ai
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Groq" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: llm-backend
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
           name: llm-provider-secret
       tls:
         sni: api.groq.com
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Hugging Face" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: llm-backend
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: meta-llama/Llama-3.1-8B-Instruct
         host: router.huggingface.co
         port: 443
         path: /v1/chat/completions
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
       tls:
         sni: router.huggingface.co
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Meta" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: llm-backend
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: muse-spark-1.3
         host: api.meta.ai
         port: 443
         path: /v1/chat/completions
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
       tls:
         sni: api.meta.ai
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Mistral AI" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: llm-backend
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: mistral-large-latest
         host: api.mistral.ai
         port: 443
         path: /v1/chat/completions
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
       tls:
         sni: api.mistral.ai
   EOF
   ```
   {{% /tab %}}
   {{% tab name="OpenRouter" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: llm-backend
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: openai/gpt-4o
         host: openrouter.ai
         port: 443
         path: /api/v1/chat/completions
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
       tls:
         sni: openrouter.ai
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Together AI" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: llm-backend
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo
         host: api.together.xyz
         port: 443
         path: /v1/chat/completions
     policies:
       auth:
         secretRef:
           name: llm-provider-secret
       tls:
         sni: api.together.xyz
   EOF
   ```
   {{% /tab %}}
   {{% tab name="xAI" %}}
   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: llm-backend
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
           name: llm-provider-secret
       tls:
         sni: api.x.ai
   EOF
   ```
   {{% /tab %}}
   {{< /tabs >}}

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   |---------|-------------|
   | `ai.provider.openai.model` | Optional upstream model override. Omit this parameter to pass the client-provided model through. |
   | `host` and `port` | The provider's API host and port. Use `443` for HTTPS endpoints. |
   | `path` | The provider's chat completions path. Omit this parameter for providers that use the standard `/v1/chat/completions` path. |
   | `policies.auth.secretRef` | References the secret that contains your provider API key. |
   | `policies.tls.sni` | Enables TLS and sets the SNI value to the upstream hostname. |

2. Create an HTTPRoute resource that routes incoming traffic to the {{< reuse "agw-docs/snippets/backend.md" >}}.

   ```yaml {paths="openai-compatible-validate"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: llm-route
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /llm
       backendRefs:
       - name: llm-backend
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

3. Send a request to verify the setup. Replace the `model` value with the model that you configured on the {{< reuse "agw-docs/snippets/backend.md" >}}.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "$INGRESS_GW_ADDRESS/llm" -H content-type:application/json -d '{
      "model": "<your-model>",
      "messages": [
        {
          "role": "user",
          "content": "Explain retrieval-augmented generation in one sentence."
        }
      ]
    }' | jq
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/llm" -H content-type:application/json -d '{
      "model": "<your-model>",
      "messages": [
        {
          "role": "user",
          "content": "Explain retrieval-augmented generation in one sentence."
        }
      ]
    }' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}

## Other OpenAI-compatible providers

### Perplexity example {#perplexity}

[Perplexity](https://www.perplexity.ai/) exposes an OpenAI-compatible API for search-augmented models and uses the standard chat completions path, so you do not need to set `path`.

```yaml {paths="openai-compatible-validate"}
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: perplexity
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      openai:
        model: sonar
      host: api.perplexity.ai
      port: 443
  policies:
    auth:
      secretRef:
        name: perplexity-secret
    tls:
      sni: api.perplexity.ai
EOF
```

### Generic OpenAI-compatible endpoint {#generic-openai-compatible-endpoint}

Use this template when the provider exposes the OpenAI Chat Completions API but is not listed in the [Built-in OpenAI-compatible providers](#built-in-openai-compatible-providers) table.

```yaml
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: generic-openai
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      openai:
        model: <upstream-model-name>
      host: api.example.com
      port: 443
      path: /v1/chat/completions
  policies:
    auth:
      secretRef:
        name: provider-secret
    tls:
      sni: api.example.com
```

Use the following fields to adapt the template:

| Setting | Description |
|---------|-------------|
| `ai.provider.openai.model` | Optional upstream model override. Omit this parameter to pass the client-provided model through. |
| `host` and `port` | Required target address for the external provider endpoint. |
| `path` | The provider's chat completions path. Omit this parameter for the standard `/v1/chat/completions` path. |
| `policies.auth` | Attach the provider API key secret to outbound requests. |
| `policies.tls.sni` | Enable TLS and set the SNI value to the upstream hostname. |

If the upstream needs mixed API formats or a cluster-local backend target, use [custom providers]({{< link-hextra path="/integrations/llm/providers/custom/" >}}) instead. For self-hosted targets that already have guides, prefer the dedicated [Ollama]({{< link-hextra path="/integrations/llm/providers/ollama/" >}}) and [vLLM]({{< link-hextra path="/integrations/llm/providers/vllm/" >}}) pages.

{{< doc-test paths="openai-compatible-validate" >}}
unset -f kubectl
{{< /doc-test >}}

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
