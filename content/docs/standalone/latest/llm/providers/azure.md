---
title: Azure
weight: 60
description: Configuration and setup for Azure AI services provider
---

Configure Microsoft Azure AI as an LLM provider in agentgateway.

## Authentication

Before you can use Azure as an LLM provider, you must authenticate by using one of the standard [Azure authentication methods](https://learn.microsoft.com/en-us/azure/ai-services/authentication). By default, agentgateway uses `DefaultAzureCredential` which automatically detects credentials from the environment (Azure CLI, managed identity, workload identity, or environment variables). You can also authenticate with an API key.

## Configuration

Azure supports two endpoint types:

- **Azure AI Foundry** (`Foundry`): Connect to Azure AI Foundry project endpoints at `{resourceName}-resource.services.ai.azure.com`.
- **Azure OpenAI** (`OpenAI`): Connect directly to Azure OpenAI Service deployments at `{resourceName}.openai.azure.com`.

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

{{< tabs items="Foundry (implicit auth),Foundry (API key),Azure OpenAI (implicit auth)" >}}

{{% tab %}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: azure
    params:
      azureResourceName: "your-resource-name"
      azureResourceType: Foundry
      azureProjectName: "your-project-name"
```

{{% /tab %}}
{{% tab %}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "gpt-4.1"
    provider: azure
    params:
      azureResourceName: "your-resource-name"
      azureResourceType: Foundry
      azureProjectName: "your-project-name"
      apiKey: "$AZURE_API_KEY"
```

{{% /tab %}}
{{% tab %}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "gpt-4.1"
    provider: azure
    params:
      azureResourceName: "your-resource-name"
      azureResourceType: OpenAI
```

{{% /tab %}}
{{< /tabs >}}

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `azure` for Azure AI models. |
| `params.azureResourceName` | The Azure resource name used to construct the endpoint hostname. |
| `params.azureResourceType` | The endpoint type: `Foundry` for Azure AI Foundry, or `OpenAI` for Azure OpenAI Service. |
| `params.azureProjectName` | The Foundry project name. Required for `Foundry` type. If omitted, defaults to `azureResourceName`. |
| `params.azureApiVersion` | Optional API version override. Defaults to `v1`. For legacy deployments, use a dated version like `2024-04-01-preview`. |
| `params.model` | The specific Azure model to use. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | The Azure API key for authentication. If unset, implicit Entra ID authentication is used. You can reference environment variables using the `$VAR_NAME` syntax. |

## Advanced configuration

For advanced Azure AI scenarios, use the traditional listener/route configuration format. The following tabs show examples for different authentication methods.

{{< tabs items="Foundry (implicit auth),Foundry (client secret),Client secret,System-assigned managed identity,User-assigned managed identity,Workload identity" >}}

{{% tab %}}
**Azure AI Foundry with implicit auth**: Use `DefaultAzureCredential` to automatically detect credentials from the environment (Azure CLI, managed identity, workload identity, or environment variables).

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - matches:
      - path:
          pathPrefix: /azure
      policies:
        urlRewrite:
          authority: auto
        backendAuth:
          azure:
            implicit: {}
        backendTLS: {}
      backends:
      - ai:
          name: azure
          provider:
            azure:
              resourceName: "your-resource-name"
              projectName: "your-project-name"
              resourceType: Foundry
              model: gpt-4.1
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}
{{< reuse-append "agw-docs/snippets/provider-azure-base-configuration.md" >}}
| `backendAuth.azure.implicit` | Use implicit authentication via `DefaultAzureCredential`, which automatically detects credentials from the environment. |
{{< /reuse-append >}}

{{% /tab %}}
{{% tab %}}
**Azure AI Foundry with client secret**: Use Azure service principal credentials to authenticate agentgateway with an Azure AI Foundry endpoint.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - matches:
      - path:
          pathPrefix: /azure
      policies:
        urlRewrite:
          authority: auto
        backendAuth:
          azure:
            explicitConfig:
              clientSecret:
                tenantId: "<your-tenant-id>"
                clientId: "<your-client-id>"
                clientSecret: "<your-client-secret>"
        backendTLS: {}
      backends:
      - ai:
          name: azure
          provider:
            azure:
              resourceName: "your-resource-name"
              projectName: "your-project-name"
              resourceType: Foundry
              model: gpt-4.1
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}
{{< reuse-append "agw-docs/snippets/provider-azure-base-configuration.md" >}}
| `backendAuth.azure.explicitConfig.clientSecret` | Use Azure service principal authentication with tenant ID, client ID, and client secret. |
{{< /reuse-append >}}

{{% /tab %}}
{{% tab %}}
**Client secret authentication**
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: azure
          provider:
            azure:
              resourceName: "your-resource-name"
              resourceType: OpenAI
              model: gpt-4.1
      policies:
        backendAuth:
          azure:
            explicitConfig:
              clientSecret:
                tenantId: "<your-tenant-id>"
                clientId: "<your-client-id>"
                clientSecret: "<your-client-secret>"
        backendTLS: {}
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}
{{< reuse-append "agw-docs/snippets/provider-azure-base-configuration.md" >}}
| `backendAuth.azure.explicitConfig.clientSecret` | Use Azure service principal authentication with tenant ID, client ID, and client secret. |
{{< /reuse-append >}}

{{% /tab %}}
{{% tab %}}
**System-assigned managed identity**: Let the Azure Instance Metadata Service automatically issue agentgateway an access token to use to call Azure AI services.

To use system-assigned managed identity:
* Agentgateway must run in an Azure resource, such as a VM or container instance.
* The Azure resource must have managed identity enabled.
* The Azure resource identity must have permissions to and the network ability to access the Azure AI services.

Leave the `managedIdentity` field empty so that the system assigns a managed identity to use.
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: azure
          provider:
            azure:
              resourceName: "your-resource-name"
              resourceType: OpenAI
              model: gpt-4.1
      policies:
        backendAuth:
          azure:
            explicitConfig:
              managedIdentity: {}
        backendTLS: {}
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}
{{< reuse-append "agw-docs/snippets/provider-azure-base-configuration.md" >}}
| `backendAuth.azure.explicitConfig.managedIdentity` | Use Azure managed identity. Leave empty for system-assigned, or specify `userAssignedIdentity` with `clientId`, `objectId`, or `resourceId`. |
{{< /reuse-append >}}

{{% /tab %}}
{{% tab %}}
**User-assigned managed identity**: Manually assign a managed identity for agentgateway to use to call Azure AI services. Unlike system-assigned managed identity, you manage the identity's lifecycle. This way, the identity is not tied to the underlying Azure resource and can be shared across other Azure resources.

To use user-assigned managed identity:
* Agentgateway must run in an Azure resource, such as a VM or container instance.
* The Azure resource must have managed identity enabled.
* The Azure resource identity must have permissions to and the network ability to access the Azure AI services.
* Create and assign a managed identity for the Azure resource to use.

Specify the client ID of the user-assigned managed identity to use. You can also specify the object ID or resource ID instead.
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: azure
          provider:
            azure:
              resourceName: "your-resource-name"
              resourceType: OpenAI
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
        backendTLS: {}
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}
{{< reuse-append "agw-docs/snippets/provider-azure-base-configuration.md" >}}
| `backendAuth.azure.explicitConfig.managedIdentity` | Use Azure managed identity. Leave empty for system-assigned, or specify `userAssignedIdentity` with `clientId`, `objectId`, or `resourceId`. |
{{< /reuse-append >}}

{{% /tab %}}
{{% tab %}}
**Workload identity**: Authenticate with Azure identity in Kubernetes clusters without the need to store credentials in the cluster.

To use workload identity:
* Agentgateway must run in a Kubernetes cluster.
* The Kubernetes cluster must use federated OIDC for authentication.
* The federated identity must link the Azure identity with access to Azure AI services to the Kubernetes service account.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: azure
          provider:
            azure:
              resourceName: "your-resource-name"
              resourceType: OpenAI
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