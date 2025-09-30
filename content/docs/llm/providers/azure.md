---
title: Azure
weight: 60
description: Configuration and setup for Azure AI services provider
---

Configure Microsoft Azure AI services (including Azure AI Foundry) as an LLM provider in agentgateway.

## Authentication

Azure authentication supports multiple credential sources that work with Microsoft Entra ID.

- **Client Secret**: Use Azure service principal credentials
- **Managed Identity**: Use Azure managed identity (system-assigned or user-assigned)
- **Workload Identity**: Use Azure workload identity for Kubernetes

For more information, see the [Azure documentation](https://learn.microsoft.com/en-us/azure/ai-services/authentication).

## Configuration

{{< reuse "docs/snippets/review-configuration.md" >}} The tabs have examples for different authentication methods.

{{< tabs items="Foundry,Client secret,System-assigned,User-assigned,Workload" >}}

{{% tab %}}
**Azure AI Foundry**
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
                  objectId: XXXX
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

{{% /tab %}}
{{% tab %}}
**Client Secret Authentication**
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
              clientSecret:
                tenantId: "your-tenant-id"
                clientId: "your-client-id"
                clientSecret: "$AZURE_CLIENT_SECRET"
```

{{% /tab %}}
{{% tab %}}
**System-Assigned Managed Identity**
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

{{% /tab %}}
{{% tab %}}
**User-Assigned Managed Identity**
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
              managedIdentity:
                userAssignedIdentity:
                  clientId: "your-managed-identity-client-id"
                  # OR use objectId or resourceId instead
                  # objectId: "your-managed-identity-object-id"
                  # resourceId: "/subscriptions/.../resourceGroups/.../providers/Microsoft.ManagedIdentity/userAssignedIdentities/..."
```

{{% /tab %}}
{{% tab %}}
**Workload Identity**
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
              workloadIdentity: {}
```

{{% /tab %}}
{{< /tabs >}}

{{< reuse "docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `ai.name` | The name of the LLM provider for this AI backend. |
| `ai.hostOverride` | Override the hostname to point to your Azure AI service endpoint. |
| `ai.pathOverride` | Override the path to match your Azure AI service API endpoint. |
| `ai.provider.openAI.model` | Optionally set the model to use for requests. If set, any models in the request are overwritten. If not set, the request must include the model to use. |
| `backendAuth.azure.explicitConfig.clientSecret` | Use Azure service principal authentication with tenant ID, client ID, and client secret. |
| `backendAuth.azure.explicitConfig.managedIdentity` | Use Azure managed identity. Leave empty for system-assigned, or specify `userAssignedIdentity` with `clientId`, `objectId`, or `resourceId`. |
| `backendAuth.azure.explicitConfig.workloadIdentity` | Use Azure workload identity for Kubernetes environments. |

