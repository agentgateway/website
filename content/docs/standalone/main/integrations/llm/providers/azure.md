---
title: Azure
weight: 15
icon: /integrations/providers/bw/azure.svg
description: Route agentgateway LLM traffic to models hosted on Microsoft Azure AI.
---

Configure Microsoft Azure AI as an LLM provider in agentgateway.

## Authentication

Before you can use Azure as an LLM provider, you must authenticate by using one of the standard [Azure authentication methods](https://learn.microsoft.com/en-us/azure/ai-services/authentication). In standalone mode, this authentication is configured with `llm.models[]` fields (for example, `params.apiKey` or `auth.azure`). In routing-based configurations, use `policies.backendAuth.azure`.

> [!IMPORTANT]
> Azure CLI authentication requires `az` or `azd` to be installed and signed in. Agentgateway calls the CLI when it needs a token. It does not open an interactive flow or run `az login` or `azd auth login` for you. Agentgateway does not bundle either command. Mounting a credential directory such as `~/.azure` makes cached login state available inside the container, but it does not install the CLI. Use Azure CLI authentication only when running agentgateway directly on your local machine. If agentgateway runs in a container, use an API key, client secret, managed identity, or workload identity.

## Configuration

Azure supports two endpoint types:

- **Azure AI Foundry** (`foundry`): Connect to Azure AI Foundry project endpoints at `{resourceName}-resource.services.ai.azure.com`.
- **Azure OpenAI** (`openAI`): Connect directly to Azure OpenAI Service deployments at `{resourceName}.openai.azure.com`.

You can add the model in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
To add the model in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps. The steps create the same models as the **Config file** tab.

1. Optional: To authenticate with an API key, set your API key in the `AZURE_API_KEY` environment variable. The UI checks that the variable exists when you save the model.

   ```sh
   export AZURE_API_KEY='<your-api-key>'
   ```

2. {{< reuse "agw-docs/standalone/llm/providers/ui-start-empty-llm.md" >}}
3. Open **LLM** > **Models**, such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
4. From the **Provider** dropdown, select **Azure**.
5. In the **Incoming model match** field, replace the default `azure/*` with the model name to match, such as `*` or `gpt-4.1`.
6. For the **Azure credentials**, select one of the following options.
   * **Default**: Uses implicit Entra ID authentication.
   * **Managed**: Uses a managed identity. Optionally, enter the client ID of a user-assigned identity.
   * **API key**: Select **Env var**, and enter `AZURE_API_KEY`.
7. Enter the **Azure resource name**, such as `your-resource-name`.
8. For the **Azure resource type**, select **Foundry** or **OpenAI**. For **Foundry**, also enter the **Azure project name**, such as `your-project-name`.
9. Optional: Enter an **Azure API version**. Leave the field empty to use the default.

   {{< reuse-image src="img/ui-llm-add-model-azure-foundry.png" srcDark="img/ui-llm-add-model-azure-foundry-dark.png" alt="Add model drawer with Azure selected as the provider, Default as the Azure credentials, your-resource-name as the Azure resource name, Foundry as the Azure resource type, and your-project-name as the Azure project name" >}}

10. Click **Save model**.

The **API key** option saves the key in `params.apiKey`. The **Foundry (API key)** example in the **Config file** tab uses an `auth.key` block instead, which sends the key in the `api-key` header. To write that block, click the **Raw** icon (`<>`) in the drawer header, or use the **Config file** tab.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/snippets/review-configuration.md" >}}

{{< tabs >}}

{{% tab name="Foundry (implicit auth)" %}}

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
llm:
  models:
  - name: "*"
    provider: azure
    params:
      azureResourceName: "your-resource-name"
      azureResourceType: foundry
      azureProjectName: "your-project-name"
```

{{% /tab %}}
{{% tab name="Foundry (API key)" %}}

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
llm:
  models:
  - name: "gpt-4.1"
    provider: azure
    auth:
      key:
        value: "$AZURE_API_KEY"
        location:
          header:
            name: api-key
    params:
      azureResourceName: "your-resource-name"
      azureResourceType: foundry
      azureProjectName: "your-project-name"
```

{{% /tab %}}
{{% tab name="Azure OpenAI (implicit auth)" %}}

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
llm:
  models:
  - name: "gpt-4.1"
    provider: azure
    params:
      azureResourceName: "your-resource-name"
      azureResourceType: openAI
```

{{% /tab %}}
{{< /tabs >}}

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `azure` for Azure AI models. |
| `params.azureResourceName` | The Azure resource name used to construct the endpoint hostname. |
| `params.azureResourceType` | The endpoint type: `foundry` for Azure AI Foundry, or `openAI` for Azure OpenAI Service. |
| `params.azureProjectName` | The Foundry project name. Required for `foundry` type. If omitted, defaults to `azureResourceName`. |
| `params.azureApiVersion` | Optional API version override. Defaults to `v1`. For legacy deployments, use a dated version like `2024-04-01-preview`. |
| `params.model` | The specific Azure model to use. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | The Azure API key for authentication. If unset, implicit Entra ID authentication is used. You can reference environment variables using the `$VAR_NAME` syntax. |
{{% /tab %}}
{{< /tabs >}}

## Advanced configuration

For advanced Azure AI scenarios, use the traditional listener/route configuration format. The following tabs show examples for different authentication methods.

{{< tabs >}}

{{% tab name="Foundry (implicit auth)" %}}
**Azure AI Foundry with implicit auth**: Use `DefaultAzureCredential` to automatically detect credentials from the environment (Azure CLI, managed identity, workload identity, or environment variables).

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
gateways:
  default:
    port: 3000
routes:
- matches:
  - path:
      pathPrefix: /azure
  backends:
  - ai:
      name: azure
      provider:
        azure:
          resourceName: "your-resource-name"
          projectName: "your-project-name"
          resourceType: foundry
          model: gpt-4.1
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}
{{< reuse-append "agw-docs/snippets/provider-azure-base-configuration.md" >}}
| `backendAuth.azure.implicit` | Use implicit authentication via `DefaultAzureCredential`, which automatically detects credentials from the environment. |
{{< /reuse-append >}}

{{% /tab %}}
{{% tab name="Foundry (client secret)" %}}
**Azure AI Foundry with client secret**: Use Azure service principal credentials to authenticate agentgateway with an Azure AI Foundry endpoint.

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
gateways:
  default:
    port: 3000
routes:
- matches:
  - path:
      pathPrefix: /azure
  policies:
    backendAuth:
      azure:
        explicitConfig:
          clientSecret:
            tenant_id: "<your-tenant-id>"
            client_id: "<your-client-id>"
            client_secret: "<your-client-secret>"
  backends:
  - ai:
      name: azure
      provider:
        azure:
          resourceName: "your-resource-name"
          projectName: "your-project-name"
          resourceType: foundry
          model: gpt-4.1
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}
{{< reuse-append "agw-docs/snippets/provider-azure-base-configuration.md" >}}
| `backendAuth.azure.explicitConfig.clientSecret` | Use Azure service principal authentication with tenant ID, client ID, and client secret. |
{{< /reuse-append >}}

{{% /tab %}}
{{% tab name="Client secret" %}}
**Client secret authentication**
```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
gateways:
  default:
    port: 3000
routes:
- backends:
  - ai:
      name: azure
      provider:
        azure:
          resourceName: "your-resource-name"
          resourceType: openAI
          model: gpt-4.1
  policies:
    backendAuth:
      azure:
        explicitConfig:
          clientSecret:
            tenant_id: "<your-tenant-id>"
            client_id: "<your-client-id>"
            client_secret: "<your-client-secret>"
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}
{{< reuse-append "agw-docs/snippets/provider-azure-base-configuration.md" >}}
| `backendAuth.azure.explicitConfig.clientSecret` | Use Azure service principal authentication with tenant ID, client ID, and client secret. |
{{< /reuse-append >}}

{{% /tab %}}
{{% tab name="System-assigned managed identity" %}}
**System-assigned managed identity**: Let the Azure Instance Metadata Service automatically issue agentgateway an access token to use to call Azure AI services.

To use system-assigned managed identity:
* Agentgateway must run in an Azure resource, such as a VM or container instance.
* The Azure resource must have managed identity enabled.
* The Azure resource identity must have permissions to and the network ability to access the Azure AI services.

Leave `managedIdentity` empty to use the identity of the Azure resource that runs agentgateway.
```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
gateways:
  default:
    port: 3000
routes:
- backends:
  - ai:
      name: azure
      provider:
        azure:
          resourceName: "your-resource-name"
          resourceType: openAI
          model: gpt-4.1
  policies:
    backendAuth:
      azure:
        explicitConfig:
          managedIdentity: {}
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}
{{< reuse-append "agw-docs/snippets/provider-azure-base-configuration.md" >}}
| `backendAuth.azure.explicitConfig.managedIdentity` | Use Azure managed identity. Leave the object empty to use the system-assigned identity. |
{{< /reuse-append >}}

{{% /tab %}}
{{% tab name="User-assigned managed identity" %}}
**User-assigned managed identity**: Manually assign a managed identity for agentgateway to use to call Azure AI services. Unlike system-assigned managed identity, you manage the identity's lifecycle. This way, the identity is not tied to the underlying Azure resource and can be shared across other Azure resources.

To use user-assigned managed identity:
* Agentgateway must run in an Azure resource, such as a VM or container instance.
* Create a user-assigned identity and attach it to the Azure resource.
* The selected identity must have permissions to and the network ability to access the Azure AI services.

Specify the client ID of the user-assigned managed identity to use. You can also specify the object ID or resource ID instead.
```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
gateways:
  default:
    port: 3000
routes:
- backends:
  - ai:
      name: azure
      provider:
        azure:
          resourceName: "your-resource-name"
          resourceType: openAI
          model: gpt-4.1
  policies:
    backendAuth:
      azure:
        explicitConfig:
          managedIdentity:
            userAssignedIdentity:
              clientId: "<your-managed-identity-client-id>"
              # OR use objectId or resourceId instead
              # objectId: "your-managed-identity-object-id"
              # resourceId: "/subscriptions/.../resourceGroups/.../providers/Microsoft.ManagedIdentity/userAssignedIdentities/..."
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}
{{< reuse-append "agw-docs/snippets/provider-azure-base-configuration.md" >}}
| `backendAuth.azure.explicitConfig.managedIdentity.userAssignedIdentity` | Use a user-assigned managed identity. Specify exactly one of `clientId`, `objectId`, or `resourceId`. |
{{< /reuse-append >}}

{{% /tab %}}
{{% tab name="Workload identity" %}}
**Workload identity**: Authenticate from Kubernetes without storing Azure credentials in the cluster.

To use workload identity:
* Agentgateway must run in a Kubernetes cluster.
* The cluster must use federated OIDC for authentication.
* The federated identity must link the Kubernetes service account to an Azure identity that can access the Azure AI services.

On AKS, complete the following steps to prepare the cluster.

1. [Enable Microsoft Entra Workload ID on the cluster](https://learn.microsoft.com/azure/aks/workload-identity-deploy-cluster).

2. Create a user-assigned managed identity. Then, grant that identity the least-privilege role that the Azure AI resource requires. For example, the `Azure AI User` role grants access to Azure AI Foundry.

3. Create a federated credential that trusts the service account that agentgateway uses. By default, the standalone Helm chart names the service account after the Helm release. For a release named `agentgateway` in the `agentgateway` namespace, use the following subject. The subject must match the namespace and the service account name exactly.

   ```txt
   system:serviceaccount:agentgateway:agentgateway
   ```

4. Configure the Helm chart to annotate that service account, and to label the pod for the Azure workload identity webhook.

   ```yaml
   serviceAccount:
     create: true
     annotations:
       azure.workload.identity/client-id: <managed-identity-client-id>

   podLabels:
     azure.workload.identity/use: "true"
   ```

Then, select workload identity in the agentgateway configuration.

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
gateways:
  default:
    port: 3000
routes:
- backends:
  - ai:
      name: azure
      provider:
        azure:
          resourceName: "your-resource-name"
          resourceType: openAI
          model: gpt-4.1
  policies:
    backendAuth:
      azure:
        explicitConfig:
          workloadIdentity: {}
    backendTLS: {}
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}
{{< reuse-append "agw-docs/snippets/provider-azure-base-configuration.md" >}}
| `backendAuth.azure.explicitConfig.workloadIdentity` | Use Azure workload identity for Kubernetes environments. |
{{< /reuse-append >}}

{{% /tab %}}
{{< /tabs >}}

## Use Claude models on Azure AI Foundry

[Azure AI Foundry](https://ai.azure.com/) hosts Anthropic Claude models at native Anthropic endpoints. When you set `azureResourceType: foundry` and a model name that starts with `claude-`, agentgateway automatically routes requests to the Anthropic-native path (`/anthropic/v1/messages`) instead of the OpenAI-compatible path, and injects the required `anthropic-version` header. No extra configuration is needed beyond specifying a Claude model name.

> [!NOTE]
> For more information about Claude models on Azure AI Foundry, see the [Microsoft documentation](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/how-to/use-foundry-models-claude).

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
gateways:
  default:
    port: 3000
routes:
- name: azure
  matches:
  - path:
      pathPrefix: /azure-anthropic #prefix example
  backends:
  - ai:
      name: azure
      provider:
        azure:
          resourceName: your-foundry-resource
          projectName: your-project-name
          resourceType: foundry
          model: claude-sonnet-4-6
    policies:
      backendAuth:
        key:
          value: your-api-key
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The exact Claude model name to match in incoming requests, such as `claude-3-5-haiku-20241022`. Use `*` to match any model name. |
| `provider` | Set to `azure` for Azure AI Foundry. |
| `backendAuth.key.value` | The Azure AI Foundry API key. You can reference environment variables using the `$VAR_NAME` syntax. The key is automatically sent in the `Authorization` header. Other auth method can be applied [Backend authentication]({{< link-hextra path="/documentation/configuration/security/backend-authn/" >}})|
| `params.azureResourceName` | The Azure AI Foundry resource name used to construct the endpoint hostname. |
| `params.azureResourceType` | Set to `foundry` to use Azure AI Foundry endpoints. |
| `params.azureProjectName` | The Foundry project name.|

After running agentgateway with this configuration, send a request to verify:

```sh
curl -X POST http://localhost:4000/azure-anthropic \
  -H "Content-Type: application/json" \
  -d '{
    "max_tokens": 256,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Use Decisions on Azure

Azure models can answer classification questions about an input, such as which of several choices fits best or how likely a statement is true. {{< reuse "agw-docs/snippets/agentgateway.md" >}} accepts two client request formats for these models:

- **Decisions API** (`/v1/decisions`): The OpenAI-compatible format, with `predicate`, `choice`, and `score` question types. For another example of this API, see the [Jev guardrail guide]({{< link-hextra path="/integrations/llm/guardrails/jev/" >}}).
- **SystemOne** (`/v1/systemone`): The TypeSafe format, with corresponding `noul`, `choice`, and `score` question types.

Choose the Azure endpoint that hosts your model. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} converts requests and responses to the upstream endpoint's native format.

- **Azure OpenAI**: Deploy a model that supports the [Azure OpenAI Decisions API](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/decisions), such as `gpt-6-luna`. Azure OpenAI receives both client formats at `/openai/v1/decisions`: Decisions requests are sent unchanged, and SystemOne requests are converted to Decisions.
- **Azure AI Foundry**: Deploy Microsoft-Decision-1 in your Foundry resource. Foundry receives both client formats at `https://{resourceName}.cognitiveservices.azure.com/providers/microsoft/v1/systemone`: SystemOne requests are sent unchanged, and Decisions requests are converted to SystemOne.

Before you begin, sign in with the Azure CLI or the Azure Developer CLI as an identity that has inference access to the resource.

1. Save the following configuration as `config-decisions.yaml`. Choose the tab for the endpoint that hosts your model, and replace the resource and deployment names with your own values.

   {{< reuse "agw-docs/snippets/review-configuration.md" >}}

   {{< tabs >}}
   {{% tab name="Azure OpenAI" %}}
   ```yaml
   # yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
   llm:
     models:
     - auth:
         azure:
           developerImplicit: {}
       name: azure-decisions
       params:
         azureResourceName: my-openai-resource
         azureResourceType: openAI
         model: my-decision-deployment
       provider: azure
     port: 3000
   ```
   {{% /tab %}}
   {{% tab name="Azure AI Foundry" %}}
   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - auth:
         azure:
           developerImplicit: {}
       name: azure-decisions
       params:
         azureResourceName: my-foundry-resource
         azureResourceType: foundry
         model: my-decision-deployment
       provider: azure
     port: 3000
   ```
   {{% /tab %}}
   {{< /tabs >}}

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   | Setting | Description |
   |---------|-------------|
   | `name` | The model name that clients send in the `model` field. This name is not the Azure deployment name. A request with any other model name returns a `404` error. |
   | `provider` | Set to `azure` for Azure. |
   | `auth.azure.developerImplicit` | Authenticate with the credentials from your Azure CLI or Azure Developer CLI sign-in. |
   | `params.azureResourceName` | The Azure resource name used to construct the endpoint hostname. |
   | `params.azureResourceType` | Set to `openAI` for Azure OpenAI or `foundry` for Azure AI Foundry. |
   | `params.model` | The name of your Azure deployment. {{< reuse "agw-docs/snippets/agentgateway.md" >}} sends this name upstream and replaces the `model` value in the client request. |

   Both request paths are served from the same model. You do not need to configure a route for each path.

2. Validate the configuration, then start agentgateway.

   ```sh
   agentgateway --validate-only -f config-decisions.yaml
   agentgateway -f config-decisions.yaml
   ```

3. In another terminal, send a predicate question through the Decisions API.

   ```sh
   curl --fail-with-body --max-time 120 http://localhost:3000/v1/decisions \
     -H 'Content-Type: application/json' \
     -d '{
       "input": "I was charged twice. Can I get a refund?",
       "model": "azure-decisions",
       "questions": [{
         "instructions": "Is the customer asking for a refund?",
         "name": "refund_requested",
         "type": "predicate"
       }]
     }'
   ```

   The response includes the probability that the customer requested a refund and the request's token usage. For more information about the request format, see [Decisions]({{< link-hextra path="/documentation/llm/api-types/decisions/" >}}).

4. Send the same question in the SystemOne client format. SystemOne takes the input in `state`, the questions as a map keyed by name, and returns an `answers` map.

   ```sh
   curl --fail-with-body --max-time 120 http://localhost:3000/v1/systemone \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "azure-decisions",
       "questions": {
         "refund_requested": {
           "instructions": "Is the customer asking for a refund?",
           "type": "noul"
         }
       },
       "state": "I was charged twice. Can I get a refund?"
     }'
   ```

   > [!NOTE]
   > Prompt guards are disabled for requests in the SystemOne format.

5. When you finish, stop agentgateway with Ctrl+C.
