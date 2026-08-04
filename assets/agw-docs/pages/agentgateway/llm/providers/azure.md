Configure [Azure](https://learn.microsoft.com/en-us/azure/foundry/) as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}.

Azure supports two endpoint types:

- **Azure OpenAI** (`OpenAI`): Connect to Azure OpenAI Service deployments at `{resourceName}.openai.azure.com`.
- **Azure AI Foundry** (`Foundry`): Connect to Azure AI Foundry project endpoints at `{resourceName}.services.ai.azure.com`.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up access to Azure

1. Retrieve the resource name and, if applicable, the project name from the [Azure AI Foundry portal](https://ai.azure.com/) or the [Azure portal](https://portal.azure.com/). For example:
   * For an Azure OpenAI endpoint like `https://{my-resource}.openai.azure.com`, the resource name is `my-resource`.
   * For an Azure AI Foundry endpoint like `https://{my-resource}.services.ai.azure.com` and path `/api/projects/{my-project}`, the resource name is `my-resource` and the project name is `my-project`. If the resource name and the project name are the same, you can leave the `projectName` field empty.

2. Store the API key to access your model deployment in an environment variable. If you are using implicit Entra ID authentication (such as managed identity or workload identity), you can skip this step.
   ```sh
   export AZURE_API_KEY=<insert your model deployment key>
   ```

3. Create a Kubernetes secret to store your API key. If you are using implicit Entra ID authentication, skip this step.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: azure-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $AZURE_API_KEY
   EOF
   ```

4. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource to configure the Azure LLM provider.

   {{< tabs >}}
   {{% tab name="Azure OpenAI (API key)" %}}
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: azure
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         azure:
           resourceName: my-resource
           resourceType: OpenAI
           model: gpt-4.1-mini
     policies:
       auth:
         secretRef:
           name: azure-secret
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Azure AI Foundry (API key)" %}}
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: azure
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         azure:
           resourceName: my-resource
           resourceType: Foundry
           projectName: my-project
           model: gpt-4.1-mini
     policies:
       auth:
         secretRef:
           name: azure-secret
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Azure OpenAI (implicit auth)" %}}
   When you use implicit Entra ID authentication, the gateway automatically obtains a token using `DefaultAzureCredential`. No secret or `policies.auth` is required. This works with managed identity, workload identity, or Azure CLI credentials.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: azure
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         azure:
           resourceName: my-resource
           resourceType: OpenAI
           model: gpt-4.1-mini
   EOF
   ```
   {{% /tab %}}
   {{< /tabs >}}

   {{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API reference]({{< link-hextra path="/reference/api/#azureconfig" >}}).

   | Setting     | Description |
   |-------------|-------------|
   | `ai.provider.azure` | Define the Azure provider. |
   | `azure.resourceName` | The Azure resource name used to construct the endpoint hostname. |
   | `azure.resourceType` | The endpoint type: `OpenAI` for Azure OpenAI Service, or `Foundry` for Azure AI Foundry. |
   | `azure.model` | The model to use for requests, such as `gpt-4.1-mini`. |
   | `azure.projectName` | The Foundry project name. Required when `resourceType` is `Foundry`. |
   | `azure.apiVersion` | Optional API version override. Defaults to `v1`. For legacy deployments, use a dated version like `2025-01-01-preview`. |

5. Create an HTTPRoute resource that routes incoming traffic to the {{< reuse "agw-docs/snippets/backend.md" >}}. The following example sets up a route. Note that {{< reuse "agw-docs/snippets/kgateway.md" >}} automatically rewrites the endpoint to the appropriate chat completion endpoint of the LLM provider for you, based on the LLM provider that you set up in the {{< reuse "agw-docs/snippets/backend.md" >}} resource.

   {{< tabs >}}
   {{% tab name="OpenAI-compatible v1/chat/completions" %}}
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: azure
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - backendRefs:
       - name: azure
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Custom route" %}}
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: azure
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /azure
       backendRefs:
       - name: azure
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```
   {{% /tab %}}
   {{< /tabs >}}

   

6. Send a request to the LLM provider API along the route that you previously created. Verify that the request succeeds and that you get back a response from the chat completion API.
   
   {{< tabs >}}
   {{% tab name="OpenAI-compatible v1/chat/completions" %}}
   **Cloud Provider LoadBalancer**:
   ```sh
   curl "$INGRESS_GW_ADDRESS/v1/chat/completions" -H content-type:application/json  -d '{
      "model": "gpt-4.1-mini",
      "messages": [
        {
          "role": "system",
          "content": "You are a helpful assistant."
        },
        {
          "role": "user",
          "content": "Write a short haiku about cloud computing."
        }
      ]
    }' | jq
   ```

   **Localhost**:
   ```sh
   curl "localhost:8080/v1/chat/completions" -H content-type:application/json  -d '{
      "model": "gpt-4.1-mini",
      "messages": [
        {
          "role": "system",
          "content": "You are a helpful assistant."
        },
        {
          "role": "user",
          "content": "Write a short haiku about cloud computing."
        }
      ]
    }' | jq
   ```
   {{% /tab %}}
   {{% tab name="Custom route" %}}
   **Cloud Provider LoadBalancer**:
   ```sh
   curl "$INGRESS_GW_ADDRESS/azure" -H content-type:application/json  -d '{
      "model": "gpt-4.1-mini",
      "messages": [
        {
          "role": "system",
          "content": "You are a helpful assistant."
        },
        {
          "role": "user",
          "content": "Write a short haiku about cloud computing."
        }
      ]
    }' | jq
   ```

   **Localhost**:
   ```sh
   curl "localhost:8080/azure" -H content-type:application/json  -d '{
      "model": "gpt-4.1-mini",
      "messages": [
        {
          "role": "system",
          "content": "You are a helpful assistant."
        },
        {
          "role": "user",
          "content": "Write a short haiku about cloud computing."
        }
      ]
    }' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}
   
   Example output: 
   ```json
   {
     "id": "chatcmpl-9A8B7C6D5E4F3G2H1",
     "object": "chat.completion",
     "created": 1727967462,
     "model": "gpt-4.1-mini",
     "choices": [
       {
         "index": 0,
         "message": {
           "role": "assistant",
           "content": "Floating servers bright,\nData streams through endless sky,\nClouds hold all we need."
         },
         "finish_reason": "stop"
       }
     ],
     "usage": {
       "prompt_tokens": 28,
       "completion_tokens": 19,
       "total_tokens": 47
     }
   }
   ```

## Use Claude models on Azure AI Foundry

[Azure AI Foundry](https://ai.azure.com/) hosts Anthropic Claude models at native Anthropic endpoints. When you set `resourceType: Foundry` and a model name that starts with `claude-`, agentgateway automatically routes requests to the Anthropic-native path (`/anthropic/v1/messages`) instead of the OpenAI-compatible path, and injects the required `anthropic-version` header. No extra configuration is needed beyond specifying a Claude model name.

> [!NOTE]
> For more information about Claude models on Azure AI Foundry, see the [Microsoft documentation](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/how-to/use-foundry-models-claude).

1. Create a Kubernetes secret to store your Azure AI Foundry API key.

   ```sh
   export AZURE_API_KEY=<insert your Azure AI Foundry API key>
   ```

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: azure-claude-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $AZURE_API_KEY
   EOF
   ```

2. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource that uses the `azure` provider with `resourceType: Foundry` and a Claude model name.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: azure-claude
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         azure:
           resourceName: my-foundry-resource
           resourceType: Foundry
           projectName: my-project
           model: claude-3-5-haiku-20241022
     policies:
       auth:
         secretRef:
           name: azure-claude-secret
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   |---------|-------------|
   | `azure.resourceName` | The Azure AI Foundry resource name used to construct the endpoint hostname. |
   | `azure.resourceType` | Set to `Foundry` to use Azure AI Foundry endpoints. |
   | `azure.projectName` | The Foundry project name. |
   | `azure.model` | The Claude model to use, for example `claude-3-5-haiku-20241022`. The model name must start with `claude-` to trigger routing to the Anthropic-native endpoint. |
   | `policies.auth.secretRef` | References the secret that holds the Azure AI Foundry API key. The key is automatically sent in the `Authorization` header. |

3. Create an HTTPRoute resource that routes incoming traffic to the {{< reuse "agw-docs/snippets/backend.md" >}}.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: azure-claude
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - backendRefs:
       - name: azure-claude
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: {{< reuse "agw-docs/snippets/group.md" >}}
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
       matches:
          - path:
              type: PathPrefix
              value: /azure-claude #Path  example
   EOF
   ```

4. Send a request to verify the setup.

   **Cloud Provider LoadBalancer**:
   ```sh
   curl "$INGRESS_GW_ADDRESS/azure-claude" -H content-type:application/json -d '{
     "max_tokens": 256,
     "messages": [
       {
         "role": "user",
         "content": "Hello!"
       }
     ]
   }' | jq
   ```

   **Localhost**:
   ```sh
   curl "localhost:8080/azure-claude" -H content-type:application/json -d '{
     "max_tokens": 256,
     "messages": [
       {
         "role": "user",
         "content": "Hello!"
       }
     ]
   }' | jq
   ```

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
