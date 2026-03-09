---
title: Azure
weight: 60
description: Configuration and setup for Azure AI services provider
---

Configure Microsoft Azure AI as an LLM provider in agentgateway. Through Azure AI Foundry, you can connect to multiple Azure AI services, including Azure OpenAI, Content Safety, Speech, Vision, and more.

## Authentication

Azure authentication supports several credential sources:

- **Client secret**: Use Azure service principal credentials
- **Managed identity**: Use Azure managed identity for system- or user-assigned identities
- **Workload Identity**: Use Azure identity for Kubernetes workloads

These credential sources work with Microsoft Entra ID. Additionally, Azure AI Foundry supports connecting to multiple Azure AI services with your credentials by overriding the host and path to the Foundry endpoint.

For more information, see the [Azure documentation](https://learn.microsoft.com/en-us/azure/ai-services/authentication).

## Configuration

The simplified LLM configuration supports basic Azure OpenAI authentication with client credentials.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: gpt-4
    provider: azure
    params:
      model: gpt-4
      azureEndpoint: "https://your-resource.openai.azure.com"
      azureTenantId: "your-tenant-id"
      azureClientId: "your-client-id"
      azureClientSecret: "$AZURE_CLIENT_SECRET"
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The name identifier for this model configuration. |
| `provider` | The LLM provider, set to `azure` for Azure OpenAI. |
| `params.model` | The specific Azure OpenAI model to use. |
| `params.azureEndpoint` | The Azure OpenAI endpoint URL. |
| `params.azureTenantId` | The Azure tenant ID for authentication. |
| `params.azureClientId` | The Azure client ID for authentication. |
| `params.azureClientSecret` | The Azure client secret for authentication. You can reference environment variables using the `$VAR_NAME` syntax. |

{{< callout type="info" >}}
For advanced Azure authentication methods (managed identity, workload identity, or Azure AI Foundry), use the traditional `binds/listeners/routes` configuration format. See the [Configuration modes guide](../configuration-modes/) for more information.
{{< /callout >}}

## Advanced configuration

For advanced Azure AI scenarios, use the traditional configuration format. The following tabs show examples for different authentication methods.

{{< tabs items="Foundry,Client secret,System-assigned managed identity,User-assigned managed identity,Workload identity" >}}

{{% tab %}}
**Azure AI Foundry**: Set the host and path to the Foundry endpoint. For the credentials, you can use one of the authentication methods, such as user-assigned managed identity in the following example.

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
              managedIdentity:
                userAssignedIdentity:
                  objectId: <object-id>
        backendTLS: {}
      backends:
      - ai:
          name: azure
          hostOverride: "ai-gateway-foundry-eastus2.services.ai.azure.com:443"
          pathOverride: "/models/chat/completions?api-version=2024-05-01-preview"
          provider:
            openAI:
              model: gpt-5-mini
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}
{{< reuse-append "agw-docs/snippets/provider-azure-base-configuration.md" >}}
| `backendAuth.azure.explicitConfig.managedIdentity` | Use Azure managed identity. Leave empty for system-assigned, or specify `userAssignedIdentity` with `clientId`, `objectId`, or `resourceId`. |
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
          hostOverride: "<your-azure-endpoint.com:443>"
          provider:
            openAI:
              model: gpt-4
      policies:
        backendAuth:
          azure:
            explicitConfig:
              clientSecret:
                tenantId: "<your-tenant-id>"
                clientId: "<your-client-id>"
                clientSecret: "<your-client-secret>"
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
          hostOverride: "your-azure-endpoint.com:443"
          provider:
            openAI:
              model: gpt-4
      policies:
        backendAuth:
          azure:
            explicitConfig:
              managedIdentity: {}
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
          hostOverride: "<your-azure-endpoint.com:443>"
          provider:
            openAI:
              model: gpt-4
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
          hostOverride: "<your-azure-endpoint.com:443>"
          provider:
            openAI:
              model: gpt-4
      policies:
        backendAuth:
          azure:
            explicitConfig:
              workloadIdentity: {}
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}
{{< reuse-append "agw-docs/snippets/provider-azure-base-configuration.md" >}}
| `backendAuth.azure.explicitConfig.workloadIdentity` | Use Azure workload identity for Kubernetes environments. |
{{< /reuse-append >}}

{{% /tab %}}
{{< /tabs >}}
