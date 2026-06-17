Configure OpenAI-compatible LLM providers that do not have a first-class page in {{< reuse "agw-docs/snippets/kgateway.md" >}}.

## Overview

Use the OpenAI-compatible provider when your upstream exposes the OpenAI Chat Completions API but does not have a dedicated agentgateway provider page.

For providers with built-in shortcuts, prefer the dedicated pages instead. This includes [Cohere]({{< link-hextra path="/llm/providers/cohere/" >}}), [DeepSeek]({{< link-hextra path="/llm/providers/deepseek/" >}}), [Fireworks AI]({{< link-hextra path="/llm/providers/fireworks/" >}}), [Groq]({{< link-hextra path="/llm/providers/groq/" >}}), [Mistral]({{< link-hextra path="/llm/providers/mistral/" >}}), [OpenRouter]({{< link-hextra path="/llm/providers/openrouter/" >}}), [Together AI]({{< link-hextra path="/llm/providers/togetherai/" >}}), [xAI]({{< link-hextra path="/llm/providers/xai/" >}}), and the other first-class provider pages in this section.

If the upstream does not match a built-in provider or an OpenAI-compatible API, use [custom providers]({{< link-hextra path="/llm/providers/custom/" >}}) instead.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up access to an OpenAI-compatible provider

Review the following fallback examples for providers without built-in support.

- [Perplexity](#perplexity)
- [Generic external endpoint](#generic-openai-compatible-endpoint)

### Perplexity example {#perplexity}

Set up OpenAI-compatible provider access to [Perplexity](https://www.perplexity.ai/) for online search-augmented responses.

1. Get a [Perplexity API key](https://www.perplexity.ai/settings/api).

2. Save the API key in an environment variable.

   ```sh
   export PERPLEXITY_API_KEY=<insert your API key>
   ```

3. Create a Kubernetes secret to store your Perplexity API key.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: perplexity-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $PERPLEXITY_API_KEY
   EOF
   ```

4. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource to configure the provider endpoint.

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

5. Create an HTTPRoute resource that routes incoming traffic to the {{< reuse "agw-docs/snippets/backend.md" >}}.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: perplexity
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /perplexity
       backendRefs:
       - name: perplexity
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

6. Send a request to verify the setup.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "$INGRESS_GW_ADDRESS/perplexity" -H content-type:application/json  -d '{
      "model": "llama-3.1-sonar-large-128k-online",
      "messages": [
        {
          "role": "user",
          "content": "What are the latest developments in AI?"
        }
      ]
    }' | jq
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/perplexity" -H content-type:application/json  -d '{
      "model": "llama-3.1-sonar-large-128k-online",
      "messages": [
        {
          "role": "user",
          "content": "What are the latest developments in AI?"
        }
      ]
    }' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}

### Generic OpenAI-compatible endpoint {#generic-openai-compatible-endpoint}

Use this template when the provider exposes the OpenAI Chat Completions API but does not have a first-class provider page.

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
      # path: /v1/chat/completions
      # pathPrefix: /openai/v1
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
| `path` | Optional full upstream request path override. Use this when the provider expects a non-standard chat completions path. |
| `pathPrefix` | Optional base path prefix when the provider serves the standard API under a prefixed route. |
| `policies.auth` | Attach the provider API key secret to outbound requests. |
| `policies.tls.sni` | Enable TLS and set the SNI value to the upstream hostname. |

For cluster-local or self-hosted targets, prefer the dedicated [Ollama]({{< link-hextra path="/llm/providers/ollama/" >}}) and [vLLM]({{< link-hextra path="/llm/providers/vllm/" >}}) guides, or use [custom providers]({{< link-hextra path="/llm/providers/custom/" >}}) when you need to declare supported API formats explicitly.

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
