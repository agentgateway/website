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

{{< reuse "agw-docs/snippets/review-configuration.md" >}} The tabs have examples for different authentication methods.

{{< tabs items="Foundry,Client secret,System-assigned managed identity,User-assigned managed identity,Workload identity" >}}

{{% tab %}}
**Azure AI Foundry**: Set the host and path to the Foundry endpoint. For the credentials, you can use one of the authentication methods, such as user-assigned managed identity in the following example.

```yaml
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
{{< reuse-append "docs/snippets/provider-azure-base-configuration.md" >}}
| `backendAuth.azure.explicitConfig.managedIdentity` | Use Azure managed identity. Leave empty for system-assigned, or specify `userAssignedIdentity` with `clientId`, `objectId`, or `resourceId`. |
{{< /reuse-append >}}

{{% /tab %}}
{{% tab %}}
**Client secret authentication**
```yaml
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
{{< reuse-append "docs/snippets/provider-azure-base-configuration.md" >}}
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
{{< reuse-append "docs/snippets/provider-azure-base-configuration.md" >}}
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
{{< reuse-append "docs/snippets/provider-azure-base-configuration.md" >}}
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
{{< reuse-append "docs/snippets/provider-azure-base-configuration.md" >}}
| `backendAuth.azure.explicitConfig.workloadIdentity` | Use Azure workload identity for Kubernetes environments. |
{{< /reuse-append >}}

{{% /tab %}}
{{< /tabs >}}
