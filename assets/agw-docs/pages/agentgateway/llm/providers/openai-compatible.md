Configure LLM providers that expose the OpenAI Chat Completions API but do not have a first-class provider type in the {{< reuse "agw-docs/snippets/backend.md" >}} API.

## Overview

In {{< reuse "agw-docs/snippets/agentgateway.md" >}}, you configure an OpenAI-compatible provider by setting `ai.provider.openai` and pointing it at the provider's `host`, `port`, and `path`. Use the `path` field when the provider serves chat completions from a non-standard path.

{{< callout type="info" >}}
In standalone mode, many of these providers have a first-class `provider:` shortcut, such as `provider: groq`, that automatically fills in the base URL. The Kubernetes {{< reuse "agw-docs/snippets/backend.md" >}} API does not yet expose those shortcuts, so in Kubernetes you configure them with the `ai.provider.openai` shape shown on this page.
{{< /callout >}}

### Built-in OpenAI-compatible providers

The following providers expose an OpenAI-compatible chat completions endpoint. To configure one, use the `ai.provider.openai` shape with `port: 443` and the `host` and `path` values in the table. The example later on this page uses Groq.

| Provider | `host` | `path` |
|----------|--------|--------|
| Baseten | `inference.baseten.co` | `/v1/chat/completions` |
| Cerebras | `api.cerebras.ai` | `/v1/chat/completions` |
| Cohere | `api.cohere.ai` | `/compatibility/v1/chat/completions` |
| DeepInfra | `api.deepinfra.com` | `/v1/openai/chat/completions` |
| DeepSeek | `api.deepseek.com` | `/v1/chat/completions` |
| Fireworks AI | `api.fireworks.ai` | `/inference/v1/chat/completions` |
| Groq | `api.groq.com` | `/openai/v1/chat/completions` |
| Hugging Face | `router.huggingface.co` | `/v1/chat/completions` |
| Mistral | `api.mistral.ai` | `/v1/chat/completions` |
| OpenRouter | `openrouter.ai` | `/api/v1/chat/completions` |
| Together AI | `api.together.xyz` | `/v1/chat/completions` |
| xAI | `api.x.ai` | `/v1/chat/completions` |

If your provider is not in this list but still exposes the OpenAI Chat Completions API, use the [generic endpoint](#generic-openai-compatible-endpoint) template. If the upstream does not match the OpenAI API format, use [custom providers]({{< link-hextra path="/llm/providers/custom/" >}}) instead.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up access to an OpenAI-compatible provider

The following example configures Groq. To configure a different provider from the table, substitute its `host` and `path` values.

1. Get an API key for your provider. For example, get a [Groq API key](https://console.groq.com/keys).

2. Save the API key in an environment variable.

   ```sh
   export GROQ_API_KEY=<insert your API key>
   ```

3. Create a Kubernetes secret to store your API key.

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

4. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource that points the `openai` provider at the provider's host and path.

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
   | `ai.provider.openai.model` | Optional upstream model override. Omit it to pass the client-provided model through. |
   | `host` and `port` | The provider's API host and port. Use `443` for HTTPS endpoints. |
   | `path` | The provider's chat completions path. Omit it for providers that use the standard `/v1/chat/completions` path. |
   | `policies.auth.secretRef` | References the secret that contains your provider API key. |
   | `policies.tls.sni` | Enables TLS and sets the SNI value to the upstream hostname. |

5. Create an HTTPRoute resource that routes incoming traffic to the {{< reuse "agw-docs/snippets/backend.md" >}}.

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
       backendRefs:
       - name: groq
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

6. Send a request to verify the setup.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "$INGRESS_GW_ADDRESS/groq" -H content-type:application/json -d '{
      "model": "llama-3.3-70b-versatile",
      "messages": [
        {
          "role": "user",
          "content": "Explain retrieval-augmented generation in one sentence."
        }
      ]
    }' | jq
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/groq" -H content-type:application/json -d '{
      "model": "llama-3.3-70b-versatile",
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

```yaml
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
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

Use this template when the provider exposes the OpenAI Chat Completions API but is not in the table.

```yaml
apiVersion: agentgateway.dev/v1alpha1
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
| `ai.provider.openai.model` | Optional upstream model override. Omit it to pass the client-provided model through. |
| `host` and `port` | Required target address for the external provider endpoint. |
| `path` | The provider's chat completions path. Omit it for the standard `/v1/chat/completions` path. |
| `policies.auth` | Attach the provider API key secret to outbound requests. |
| `policies.tls.sni` | Enable TLS and set the SNI value to the upstream hostname. |

If the upstream needs mixed API formats or a cluster-local backend target, use [custom providers]({{< link-hextra path="/llm/providers/custom/" >}}) instead. For self-hosted targets that already have guides, prefer the dedicated [Ollama]({{< link-hextra path="/llm/providers/ollama/" >}}) and [vLLM]({{< link-hextra path="/llm/providers/vllm/" >}}) pages.

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
