---
title: Azure
weight: 50
description: Deploy Agent Gateway on Microsoft Azure
---

Run Agent Gateway on Azure to leverage Azure OpenAI, AKS, and Azure services.

## Deployment options

### Azure Kubernetes Service (AKS)

For AKS deployments, use [Agentgateway on Kubernetes](https://agentgateway.dev/docs/kubernetes/) which provides native Kubernetes Gateway API support, dynamic configuration, and MCP service discovery.

{{< cards >}}
  {{< card link="https://agentgateway.dev/docs/kubernetes/" title="Deploy on AKS with kgateway" icon="external-link" >}}
{{< /cards >}}

### Azure Container Apps

Run Agent Gateway as a serverless container.

```bash
az containerapp create \
  --name agentgateway \
  --resource-group my-rg \
  --environment my-env \
  --image ghcr.io/agentgateway/agentgateway:latest \
  --target-port 3000 \
  --ingress external \
  --secrets openai-key=secretref:openai-api-key \
  --env-vars AZURE_OPENAI_ENDPOINT=https://my-resource.openai.azure.com
```

## Azure integrations

| Integration | Purpose |
|-------------|---------|
| [Azure OpenAI]({{< link-hextra path="/llm/providers/azure/" >}}) | Access GPT-4 and other models |
| [Azure Key Vault]({{< link-hextra path="https://azure.microsoft.com/en-us/products/key-vault/" >}}) | Secure API key storage |
| Azure Application Gateway | Load balancing with WAF |
| Azure Monitor | Logs and metrics |
| Azure Application Insights | Distributed tracing |

## Azure role assignments

Assign roles to the managed identity:

```bash
# Get the managed identity principal ID
PRINCIPAL_ID=$(az identity show --name agentgateway-identity \
  --resource-group my-rg --query principalId -o tsv)

# Grant Azure OpenAI access
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Cognitive Services OpenAI User" \
  --scope /subscriptions/<sub-id>/resourceGroups/my-rg/providers/Microsoft.CognitiveServices/accounts/my-openai

# Grant Key Vault access
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Key Vault Secrets User" \
  --scope /subscriptions/<sub-id>/resourceGroups/my-rg/providers/Microsoft.KeyVault/vaults/my-vault
```

## Learn more

- [Azure OpenAI Provider]({{< link-hextra path="/llm/providers/azure/" >}})
- [Azure Key Vault Integration]({{< link-hextra path="https://azure.microsoft.com/en-us/products/key-vault/" >}})
- [Deployment Guide]({{< link-hextra path="/deployment/" >}})
