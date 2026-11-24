Configure [Azure](https://learn.microsoft.com/en-us/azure/foundry/) as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}.

Azure supports two endpoint types:

- **Azure OpenAI** (`OpenAI`): Connect to Azure OpenAI Service deployments at `{resourceName}.openai.azure.com`.
- **Azure AI Foundry** (`Foundry`): Connect to Azure AI Foundry project endpoints at `{resourceName}.services.ai.azure.com`.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Authentication

You can authenticate to Azure with an API key or with implicit Entra ID authentication through `DefaultAzureCredential`. On Kubernetes, implicit authentication can obtain a token from managed identity or workload identity. It does not require a Kubernetes secret or `policies.auth`.

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,2.1.x,2.2.x,2.3.x" >}}
You can also configure explicit managed identity or workload identity authentication in the {{< reuse "agw-docs/snippets/backend.md" >}}. Managed identity requires access to an Azure managed identity endpoint. Workload identity exchanges the projected ServiceAccount token with Microsoft Entra ID.

Workload identity is not limited to AKS. Microsoft Entra ID can trust the ServiceAccount tokens of any Kubernetes cluster whose token issuer is publicly discoverable, such as a Google Kubernetes Engine (GKE) cluster. To set up the trust, you create a federated credential for the token issuer of the cluster. On AKS, the Azure workload identity webhook adds the token and the Azure settings to the proxy pod. On other clusters, you can install the [open source webhook](https://azure.github.io/azure-workload-identity/docs/installation/mutating-admission-webhook.html), or add the token and the settings yourself. To set up workload identity, follow the steps for your cluster:

- [Use Microsoft Entra Workload ID on AKS](#use-microsoft-entra-workload-id-on-aks)
- [Use Microsoft Entra Workload ID on GKE](#use-microsoft-entra-workload-id-on-gke)

### Use Microsoft Entra Workload ID on AKS

To authenticate with Microsoft Entra Workload ID, prepare the AKS cluster and the proxy service account before you create the {{< reuse "agw-docs/snippets/backend.md" >}}.

1. [Enable workload identity on the AKS cluster](https://learn.microsoft.com/azure/aks/workload-identity-deploy-cluster).

2. Create a user-assigned managed identity. Then, grant that identity the least-privilege role that the Azure AI resource requires. For Azure AI Foundry, you can use a custom role that allows only the inference requests that the gateway sends. For more information, see [Use a least-privilege role for Azure AI Foundry](#foundry-least-privilege-role).

3. Create a federated credential that trusts the service account that the proxy uses. By default, the deployer names this service account after the Gateway. For the default gateway from the quickstart, use the following subject. The subject must match the namespace and the service account name exactly.

   ```txt
   system:serviceaccount:{{< reuse "agw-docs/snippets/namespace.md" >}}:agentgateway-proxy
   ```

4. Create an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource that annotates the service account with the managed identity client ID, and that labels the proxy pod for the Azure workload identity webhook. If the gateway already refers to an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource, add these overlays to that resource instead.

   ```yaml
   kubectl apply --server-side -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
   metadata:
     name: azure-workload-identity
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     serviceAccount:
       metadata:
         annotations:
           azure.workload.identity/client-id: <managed-identity-client-id>
     deployment:
       spec:
         template:
           metadata:
             labels:
               azure.workload.identity/use: "true"
   EOF
   ```

5. Attach the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource to the gateway.

   ```sh
   kubectl patch gateway agentgateway-proxy \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --type merge \
     --patch '{"spec":{"infrastructure":{"parametersRef":{"group":"{{< reuse "agw-docs/snippets/group.md" >}}","kind":"{{< reuse "agw-docs/snippets/gatewayparameters.md" >}}","name":"azure-workload-identity"}}}}'
   ```

### Use Microsoft Entra Workload ID on GKE

GKE serves the token issuer of each cluster from a public Google endpoint, so Microsoft Entra ID can verify the ServiceAccount tokens of the proxy. GKE does not include the Azure workload identity webhook. The following steps add the federated token volume and the Azure environment variables to the proxy pod in an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource. You can also install the webhook on the cluster yourself. In that case, complete steps 1 to 4, and then configure the proxy as described in steps 4 and 5 of the [AKS steps](#use-microsoft-entra-workload-id-on-aks). You can use the same steps on other Kubernetes clusters that have a publicly discoverable token issuer.

Before you begin, install `jq` and the Azure CLI, and set your `kubectl` context to the GKE cluster.

1. Get the token issuer URL from the discovery document of the cluster. Do not build the URL from the `selfLink` value of the cluster. For a zonal cluster, `selfLink` contains `/zones/`, but the issuer contains `/locations/`. Microsoft Entra ID rejects a token if the issuer does not match exactly.

   ```sh
   export ISSUER=$(kubectl get --raw /.well-known/openid-configuration | jq -r .issuer)
   echo $ISSUER
   ```

   Example output:

   ```
   https://container.googleapis.com/v1/projects/my-project/locations/us-central1-b/clusters/my-cluster
   ```

2. Confirm that the discovery document is publicly available. Microsoft Entra ID gets the document and the signing keys without credentials. The following command sends no credentials. The output is the same issuer URL.

   ```sh
   curl -s "$ISSUER/.well-known/openid-configuration" | jq -r .issuer
   ```

3. Create a user-assigned managed identity. Then, grant that identity the least-privilege role that the Azure AI resource requires. For Azure AI Foundry, see [Use a least-privilege role for Azure AI Foundry](#foundry-least-privilege-role). Record the client ID of the identity and the ID of your Microsoft Entra tenant for a later step.

4. Create a federated credential on the managed identity that trusts the service account of the proxy. The deployer names this service account after the Gateway. The following example uses the default gateway from the quickstart.

   ```sh
   az identity federated-credential create \
     --name agentgateway-gke \
     --identity-name <managed-identity-name> \
     --resource-group <resource-group> \
     --issuer "$ISSUER" \
     --subject "system:serviceaccount:{{< reuse "agw-docs/snippets/namespace.md" >}}:agentgateway-proxy" \
     --audiences "api://AzureADTokenExchange"
   ```

   | Setting | Description |
   | -- | -- |
   | `--issuer` | The token issuer URL of the cluster from step 1. |
   | `--subject` | The service account of the proxy, in the format `system:serviceaccount:<namespace>:<name>`. The namespace and the name must match exactly. |
   | `--audiences` | Set to `api://AzureADTokenExchange`. This value must match the audience of the projected token in the next step. |

5. Create an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource for the proxy pod. The resource projects a ServiceAccount token for Microsoft Entra ID, and sets the Azure environment variables that the proxy reads. If the gateway already refers to an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource, add these settings to that resource instead.

   ```yaml
   kubectl apply --server-side -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
   metadata:
     name: azure-workload-identity
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     env:
     - name: AZURE_CLIENT_ID
       value: <managed-identity-client-id>
     - name: AZURE_TENANT_ID
       value: <entra-tenant-id>
     - name: AZURE_FEDERATED_TOKEN_FILE
       value: /var/run/secrets/azure/tokens/azure-identity-token
     deployment:
       spec:
         template:
           spec:
             containers:
             - name: agentgateway
               volumeMounts:
               - name: azure-identity-token
                 mountPath: /var/run/secrets/azure/tokens
                 readOnly: true
             volumes:
             - name: azure-identity-token
               projected:
                 sources:
                 - serviceAccountToken:
                     path: azure-identity-token
                     audience: api://AzureADTokenExchange
                     expirationSeconds: 3600
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `env.AZURE_CLIENT_ID` | The client ID of the managed identity. |
   | `env.AZURE_TENANT_ID` | The ID of your Microsoft Entra tenant. The proxy gets the token from the Microsoft Entra endpoint of the Azure public cloud, `https://login.microsoftonline.com`. To use a different endpoint, such as for a sovereign cloud, also set the `AZURE_AUTHORITY_HOST` environment variable. |
   | `env.AZURE_FEDERATED_TOKEN_FILE` | The path to the projected token in the proxy container. The path is the `mountPath` of the volume, followed by the `path` of the token. |
   | `deployment.spec.template.spec.containers[].name` | Set to `agentgateway`, the name of the proxy container. The controller merges the volume mount into the container that has this name. |
   | `volumes[].projected.sources[].serviceAccountToken.audience` | Set to `api://AzureADTokenExchange`, the audience that Microsoft Entra ID requires. |
   | `volumes[].projected.sources[].serviceAccountToken.expirationSeconds` | The lifetime of the projected token. The kubelet replaces the token before it expires, and the proxy reads the file again. You do not have to restart the proxy. |

6. Attach the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource to the gateway.

   ```sh
   kubectl patch gateway agentgateway-proxy \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --type merge \
     --patch '{"spec":{"infrastructure":{"parametersRef":{"group":"{{< reuse "agw-docs/snippets/group.md" >}}","kind":"{{< reuse "agw-docs/snippets/gatewayparameters.md" >}}","name":"azure-workload-identity"}}}}'
   ```

7. Confirm that the proxy deployment mounts the token with the Microsoft Entra audience.

   ```sh
   kubectl get deployment agentgateway-proxy \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -o jsonpath='{.spec.template.spec.volumes[?(@.name=="azure-identity-token")].projected.sources[0].serviceAccountToken.audience}'
   ```

   Example output:

   ```
   api://AzureADTokenExchange
   ```
{{< /version >}}

### Use a least-privilege role for Azure AI Foundry {#foundry-least-privilege-role}

{{< reuse "agw-docs/snippets/azure-foundry-least-privilege-role.md" >}}

## Set up access to Azure

1. Retrieve the resource name and, if applicable, the project name from the [Azure AI Foundry portal](https://ai.azure.com/) or the [Azure portal](https://portal.azure.com/). For example:
   * For an Azure OpenAI endpoint like `https://{my-resource}.openai.azure.com`, the resource name is `my-resource`.
   * For an Azure AI Foundry endpoint like `https://{my-resource}.services.ai.azure.com` and path `/api/projects/{my-project}`, the resource name is `my-resource` and the project name is `my-project`.

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

   {{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,2.1.x,2.2.x,2.3.x" >}}

   To use explicit managed identity or workload identity authentication instead of an API key, apply one of the following {{< reuse "agw-docs/snippets/backend.md" >}} configurations.

   {{< tabs >}}
   {{% tab name="Workload identity" %}}
   To use workload identity, first prepare the cluster as described in [Use Microsoft Entra Workload ID on AKS](#use-microsoft-entra-workload-id-on-aks) or [Use Microsoft Entra Workload ID on GKE](#use-microsoft-entra-workload-id-on-gke). Then, select workload identity in the {{< reuse "agw-docs/snippets/backend.md" >}}.

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
         azure:
           workloadIdentity: {}
   EOF
   ```
   {{% /tab %}}
   {{% tab name="System-assigned managed identity" %}}
   {{< version include-if="1.4.x" >}}
   In this version, `managedIdentity` requires `clientId`, `objectId`, and `resourceId`, so it cannot select the system-assigned identity. To use the system-assigned identity, omit `policies.auth` and use implicit authentication instead. You can also use the user-assigned form.
   {{< /version >}}
   {{< version exclude-if="1.4.x" >}}
   To use the identity of the Azure resource that runs the proxy, leave `managedIdentity` empty.

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
         azure:
           managedIdentity: {}
   EOF
   ```
   {{< /version >}}
   {{% /tab %}}
   {{% tab name="User-assigned managed identity" %}}
   {{< version include-if="1.4.x" >}}
   To use an identity that you manage separately from the Azure resource, set its client ID, object ID, and resource ID. In this version, all three fields are required, and the gateway uses the first one that is not empty.

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
         azure:
           managedIdentity:
             clientId: <managed-identity-client-id>
             objectId: <managed-identity-object-id>
             resourceId: <managed-identity-resource-id>
   EOF
   ```
   {{< /version >}}
   {{< version exclude-if="1.4.x" >}}
   To use an identity that you manage separately from the Azure resource, set the client ID of that identity. You can set the object ID or the resource ID instead.

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
         azure:
           managedIdentity:
             clientId: <managed-identity-client-id>
   EOF
   ```
   {{< /version >}}
   {{% /tab %}}
   {{< /tabs >}}
   {{< /version >}}

   {{% reuse "agw-docs/snippets/review-table.md" %}}{{< version exclude-if="1.1.x" >}} For more information, see the [API reference]({{< link-hextra path="/reference/api/#azureconfig" >}}).{{< /version >}}

   | Setting     | Description |
   |-------------|-------------|
   | `ai.provider.azure` | Define the Azure provider. |
   | `azure.resourceName` | The Azure resource name used to construct the endpoint hostname. |
   | `azure.resourceType` | The endpoint type: `OpenAI` for Azure OpenAI Service, or `Foundry` for Azure AI Foundry. |
   | `azure.model` | The model to use for requests, such as `gpt-4.1-mini`. |
   | `azure.projectName` | The Foundry project name. Required when `resourceType` is `Foundry`. |
   | `azure.apiVersion` | Optional API version override. Defaults to `v1`. For legacy deployments, use a dated version like `2025-01-01-preview`. |{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,2.1.x,2.2.x,2.3.x" >}}
   | `policies.auth.azure.workloadIdentity` | Use Azure workload identity. Leave the object empty. The proxy uses the federated token and the Azure environment variables in the proxy pod. On AKS, the Azure workload identity webhook adds them. On other clusters, the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource adds them. |
   | `policies.auth.azure.managedIdentity` | Use an Azure managed identity.{{< version include-if="1.4.x" >}} Set `clientId`, `objectId`, and `resourceId` of a user-assigned identity. All three are required in this version.{{< /version >}}{{< version exclude-if="1.4.x" >}} Leave the object empty to use the system-assigned identity. To use a user-assigned identity, set exactly one of `clientId`, `objectId`, or `resourceId`.{{< /version >}} |{{< /version >}}

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
         group: {{< reuse "agw-docs/snippets/group.md" >}}
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
         group: {{< reuse "agw-docs/snippets/group.md" >}}
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

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x" >}}
## Use Decisions on Azure

Azure models can answer classification questions about an input, such as which of several choices fits best or how likely a statement is true. {{< reuse "agw-docs/snippets/agentgateway.md" >}} accepts two client request formats for these models:

- **Decisions API** (`/v1/decisions`): The OpenAI-compatible format, with `predicate`, `choice`, and `score` question types.
- **SystemOne** (`/v1/systemone`): The TypeSafe format, with corresponding `noul`, `choice`, and `score` question types.

Choose the Azure endpoint that hosts your model. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} converts requests and responses to the upstream endpoint's native format.

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x" >}}
- **Azure OpenAI**: Deploy a model that supports the [Azure OpenAI Decisions API](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/decisions), such as `gpt-6-luna`. Azure OpenAI receives both client formats at `/openai/v1/decisions`: Decisions requests are sent unchanged, and SystemOne requests are converted to Decisions.
{{< /version >}}
- **Azure AI Foundry**: Deploy Microsoft-Decision-1 in your Foundry resource. Foundry receives both client formats at `https://{resourceName}.cognitiveservices.azure.com/providers/microsoft/v1/systemone`: SystemOne requests are sent unchanged, and Decisions requests are converted to SystemOne.

Before you begin, set up workload identity for the `agentgateway-proxy` Gateway, either [on AKS](#use-microsoft-entra-workload-id-on-aks) or [on GKE](#use-microsoft-entra-workload-id-on-gke).

### Configure the Azure backend

Create the {{< reuse "agw-docs/snippets/backend.md" >}} for the endpoint that hosts your model. Replace the resource, project, and deployment names with your own values.

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x" >}}
#### Azure OpenAI

```yaml
kubectl apply --server-side -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: azure-decisions
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      azure:
        model: my-decision-deployment
        resourceName: my-openai-resource
        resourceType: OpenAI
  policies:
    ai:
      routes:
        /v1/decisions: Decisions
        /v1/systemone: SystemOne
    auth:
      azure:
        workloadIdentity: {}
EOF
```
{{< /version >}}

#### Azure AI Foundry

```yaml
kubectl apply --server-side -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: azure-decisions
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      azure:
        model: my-decision-deployment
        projectName: my-project
        resourceName: my-foundry-resource
        resourceType: Foundry
  policies:
    ai:
      routes:
        /v1/decisions: Decisions
        /v1/systemone: SystemOne
    auth:
      azure:
        workloadIdentity: {}
EOF
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting | Description |
|---------|-------------|
| `azure.resourceName` | The Azure resource name used to construct the endpoint hostname. |
| `azure.resourceType` | Set to {{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x" >}}`OpenAI` for Azure OpenAI or {{< /version >}}`Foundry` for Azure AI Foundry. |
| `azure.projectName` | The Foundry project name. The CRD requires this field for the `Foundry` resource type, even though Decisions and SystemOne requests go to the resource endpoint and do not use the project.{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x" >}} Do not set this field for `OpenAI`.{{< /version >}} |
| `azure.model` | The name of your Azure deployment. {{< reuse "agw-docs/snippets/agentgateway.md" >}} sends this name upstream and replaces the `model` value in the client request. |
| `policies.ai.routes` | Maps each request path to a request format, `Decisions` or `SystemOne`. |
| `policies.auth.azure.workloadIdentity` | Authenticate to Azure with the workload identity that you set up for the proxy. Leave the object empty. |

### Route Decisions and SystemOne traffic

Create one HTTPRoute that sends both client request formats to the backend.

```yaml
kubectl apply --server-side -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: azure-decisions
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
  - name: agentgateway-proxy
  rules:
  - backendRefs:
    - group: {{< reuse "agw-docs/snippets/group.md" >}}
      kind: {{< reuse "agw-docs/snippets/backend.md" >}}
      name: azure-decisions
    matches:
    - method: POST
      path:
        type: Exact
        value: /v1/decisions
    - method: POST
      path:
        type: Exact
        value: /v1/systemone
EOF
```

### Send requests

1. Set the address of the gateway.

   **Cloud Provider LoadBalancer**:
   ```sh
   export GATEWAY_URL=http://$INGRESS_GW_ADDRESS
   ```

   **Localhost**: Forward the gateway Service in one terminal. Then set the address in another terminal.
   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     service/agentgateway-proxy 8080:80
   ```
   ```sh
   export GATEWAY_URL=http://localhost:8080
   ```

2. Send a choice question through the Decisions API.

   ```sh
   curl --fail-with-body --max-time 120 "$GATEWAY_URL/v1/decisions" \
     -H 'Content-Type: application/json' \
     -d '{
       "input": "I was charged twice for my subscription.",
       "model": "my-decision-deployment",
       "questions": [{
         "choices": [
           {"description": "Payments and invoices", "value": "billing"},
           {"description": "Software problems", "value": "technical"}
         ],
         "instructions": "Which team should handle this support ticket?",
         "name": "department",
         "type": "choice"
       }]
     }'
   ```

   The response includes a `department` choice with a probability for each value, and token usage. The Decisions API also supports `predicate` and `score` questions.

3. Send the same question in the SystemOne client format. SystemOne takes the text in `state` and the questions as a map keyed by name, and returns an `answers` map. Its question types are `noul`, `choice`, and `score`.

   ```sh
   curl --fail-with-body --max-time 120 "$GATEWAY_URL/v1/systemone" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "my-decision-deployment",
       "questions": {
         "department": {
           "criteria": {
             "billing": "Payments and invoices",
             "technical": "Software problems"
           },
           "instructions": "Which team should handle this support ticket?",
           "type": "choice"
         }
       },
       "state": "I was charged twice for my subscription."
     }'
   ```

   > [!NOTE]
   > Prompt guards are disabled for requests in the SystemOne format.

### Clean up {#decisions-cleanup}

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete httproute azure-decisions -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} azure-decisions -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

If you forwarded the Service, stop the port-forward with Ctrl+C.
{{< /version >}}

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
