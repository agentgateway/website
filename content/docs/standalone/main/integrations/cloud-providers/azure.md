---
title: Azure
weight: 30
description: Run agentgateway on Azure and reach Azure OpenAI with a managed identity instead of an API key.
aliases:
  - ../platforms/azure/
---

Run agentgateway on Azure Container Apps or AKS, and reach [Azure OpenAI]({{< link-hextra path="/integrations/llm/providers/azure/" >}}) with the managed identity that Azure already attaches to the workload. No API key goes into your configuration file.

## Authenticate with a managed identity

Azure supplies credentials to the container through a managed identity on Container Apps and through workload identity on AKS. Agentgateway obtains an Entra ID token from whichever one is present.

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

{{< tabs >}}

{{% tab name="Auto-detect" %}}

Use `auth.azure.implicit` to detect the method from the environment. Agentgateway uses workload identity on Kubernetes, managed identity on Azure compute, and local developer tools on a workstation.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: azure
    params:
      model: gpt-4o
      azureResourceName: my-resource
      azureResourceType: openAI
    auth:
      azure:
        implicit: {}
```

{{% /tab %}}

{{% tab name="User-assigned identity" %}}

When more than one identity is attached to the container, name the one to use by its client ID. `objectId` and `resourceId` are accepted in place of `clientId`.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: azure
    params:
      model: gpt-4o
      azureResourceName: my-resource
      azureResourceType: openAI
    auth:
      azure:
        explicitConfig:
          managedIdentity:
            userAssignedIdentity:
              clientId: 00000000-0000-0000-0000-000000000000
```

{{% /tab %}}

{{< /tabs >}}

Review the following table to understand this configuration.

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `azure` for Azure AI. |
| `params.model` | The deployment name to send upstream. |
| `params.azureResourceName` | The Azure resource name. |
| `params.azureResourceType` | The endpoint type, either `openAI` for Azure OpenAI Service or `foundry` for an Azure AI Foundry project. |
| `auth.azure` | Entra ID authentication. Use `implicit` to detect the method from the environment, or `explicitConfig` to name a client secret, a managed identity, or workload identity. |

For client secret and workload identity configurations, and for the Azure AI Foundry endpoint type, see [Azure]({{< link-hextra path="/integrations/llm/providers/azure/" >}}).

> [!IMPORTANT]
> Azure CLI authentication is a developer convenience, not a deployment method. Agentgateway calls `az` or `azd` when it needs a token, and neither command is in the container image. In a container, use a managed identity, workload identity, or a client secret.

## Run on Azure Container Apps

Run agentgateway as a serverless container with a user-assigned identity.

```bash
az containerapp create \
  --name agentgateway \
  --resource-group my-rg \
  --environment my-env \
  --image cr.agentgateway.dev/agentgateway:{{< reuse "agw-docs/versions/image-tag.md" >}} \
  --target-port 4000 \
  --ingress internal \
  --user-assigned /subscriptions/<sub-id>/resourceGroups/my-rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/agentgateway-identity
```

Note the following details.

* **Port 4000 carries LLM traffic.** When your configuration file defines no gateway, the implied `default` gateway serves LLM traffic on port `4000` and MCP traffic on port `3000`. Set `--target-port` to the port that carries the traffic you route. For more information, see [Configuration modes]({{< link-hextra path="/documentation/llm/configuration-modes/" >}}).
* **The identity is the credential.** Because `auth.azure` uses the identity attached to the container, `--user-assigned` is what lets agentgateway call Azure OpenAI. No API key is needed in the create command or in the configuration file.
* **The container still needs a configuration file.** The command above starts the image with no `-f` flag, so agentgateway generates a default configuration that does not route to Azure. Mount your file with an Azure Files volume, or bake it into your own image, and pass it with `-f`. For more information, see [Configuration storage]({{< link-hextra path="/documentation/setup/storage/" >}}).
* **`--ingress internal` keeps the gateway inside the environment.** A gateway that holds Azure OpenAI access is a credential of its own, so anyone who can reach it can spend against your resource. Before you switch to `--ingress external`, put an authentication policy in front of it. For more information, see [Authentication and identity]({{< link-hextra path="/integrations/auth/" >}}).

## Run on AKS

AKS is an ordinary Kubernetes distribution as far as agentgateway is concerned. Two options are available.

* Run standalone agentgateway as a Deployment with the [Helm chart]({{< link-hextra path="/documentation/setup/install/helm/" >}}). Enable the workload identity add-on and annotate the pod's service account, and `auth.azure.implicit` picks up workload identity automatically.
* Run the [Kubernetes control plane]({{< link-hextra path="/documentation/setup/install/kubernetes/" >}}), which manages agentgateway proxies from Kubernetes custom resources and the Kubernetes Gateway API.

{{< cards >}}
  {{< card link="https://agentgateway.dev/docs/kubernetes/" title="Kubernetes mode docs" icon="external-link" >}}
{{< /cards >}}

## Role assignments

Assign the roles that agentgateway needs to the managed identity.

```bash
# Get the managed identity principal ID
PRINCIPAL_ID=$(az identity show --name agentgateway-identity \
  --resource-group my-rg --query principalId -o tsv)

# Grant Azure OpenAI access
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Cognitive Services OpenAI User" \
  --scope /subscriptions/<sub-id>/resourceGroups/my-rg/providers/Microsoft.CognitiveServices/accounts/my-openai

# Grant Key Vault access, if you store the API keys of other providers there
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Key Vault Secrets User" \
  --scope /subscriptions/<sub-id>/resourceGroups/my-rg/providers/Microsoft.KeyVault/vaults/my-vault
```

## Azure services

| Service | How it is used |
|-------------|---------|
| [Azure OpenAI]({{< link-hextra path="/integrations/llm/providers/azure/" >}}) | GPT and other models, reached with the managed identity |
| [Azure Content Safety]({{< link-hextra path="/documentation/llm/prompt-guards/azure-content-safety/" >}}) | Prompt and response moderation |
| [Azure Key Vault](https://azure.microsoft.com/en-us/products/key-vault/) | Storage for the API keys of non-Azure providers |
| Azure Application Gateway | Load balancing, TLS termination, and WAF in front of the gateway port |
| Azure Monitor | Metrics and log collection |
| Application Insights | Trace collection, through an [OpenTelemetry]({{< link-hextra path="/documentation/observability/traces/configs/otel/" >}}) collector |

## Next steps

* [Azure]({{< link-hextra path="/integrations/llm/providers/azure/" >}}) for the full provider reference, including Azure AI Foundry.
* [Set up the UI]({{< link-hextra path="/documentation/setup/ui/" >}}) to serve the web interface on a gateway.
* [Choose where configuration is stored]({{< link-hextra path="/documentation/setup/storage/" >}}) before you mount a read-only file.
