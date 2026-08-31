---
title: Azure
weight: 30
description: Run agentgateway on Azure and reach Azure OpenAI with a managed identity instead of an API key.
test:
  azure-cloud:
  - file: ${versionRoot}/integrations/cloud-providers/azure.md
    path: azure-cloud
aliases:
  - /docs/standalone/latest/integrations/platforms/azure/
---

Run agentgateway on Azure Container Apps or AKS, and reach [Azure OpenAI]({{< link-hextra path="/documentation/llm/providers/azure/" >}}) with the managed identity that Azure already attaches to the workload. No API key goes into your configuration file.

{{< doc-test paths="azure-cloud" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Authenticate with a managed identity", both tabs: the auto-detect config
#     (`auth.azure.implicit`) and the user-assigned identity config
#     (`auth.azure.explicitConfig.managedIdentity.userAssignedIdentity.clientId`)
#     are both accepted by agentgateway (--validate-only), alongside
#     `params.azureResourceName` and `params.azureResourceType`.
#   * With the auto-detect config loaded, agentgateway serves LLM traffic on
#     port 4000 and resolves the model to the Azure provider with the documented
#     resource name and type. This is what makes the --target-port value in the
#     Container Apps command on this page checkable rather than asserted.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That either identity reaches Azure OpenAI - external dependency; the test
#     has no Azure tenant, resource, or identity, and a live call bills a
#     completion. Only that agentgateway accepts each config shape is asserted.
#   * "Run on Azure Container Apps" - external dependency; the az commands need
#     a subscription, a resource group, and a Container Apps environment that
#     the test cannot stand up. The image and port in them match the
#     configuration that this test does run.
#   * "Role assignments" - a different layer; the roles are evaluated by Azure,
#     not by agentgateway.
#   * "Azure services" - display-only table of links.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

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

{{< doc-test paths="azure-cloud" >}}
# Auto-detect tab
cat <<'EOF' > config.yaml
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
EOF
agentgateway -f config.yaml --validate-only

# User-assigned identity tab
cat <<'EOF' > /tmp/azure-user-assigned.yaml
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
EOF
agentgateway -f /tmp/azure-user-assigned.yaml --validate-only
{{< /doc-test >}}

Review the following table to understand this configuration.

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `azure` for Azure AI. |
| `params.model` | The deployment name to send upstream. |
| `params.azureResourceName` | The Azure resource name. |
| `params.azureResourceType` | The endpoint type, either `openAI` for Azure OpenAI Service or `foundry` for an Azure AI Foundry project. |
| `auth.azure` | Entra ID authentication. Use `implicit` to detect the method from the environment, or `explicitConfig` to name a client secret, a managed identity, or workload identity. |

{{< doc-test paths="azure-cloud" >}}
# Confirm that agentgateway serves LLM traffic on port 4000, which the Container
# Apps command on this page sets with --target-port, and that the Azure params
# reach the resolved provider as the settings table describes.
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3

SERVED=$(curl -sf --max-time 10 http://localhost:4000/v1/models | jq -r '[.data[].id] | index("*") // "missing"')
if [ "$SERVED" = "missing" ]; then
  echo "FAIL: the wildcard model from the example config is not served on port 4000"
  exit 1
fi
RESOLVED=$(curl -sf --max-time 10 http://localhost:15000/config_dump | jq -r '
  [ .backends[].backend.ai
    | select(. != null)
    | .target.providers[].active[].endpoint
    | .provider.azure
    | "\(.model)|\(.resourceName)|\(.resourceType)"
  ] | first')
EXPECTED="gpt-4o|my-resource|openAI"
if [ "$RESOLVED" != "$EXPECTED" ]; then
  echo "FAIL: expected azure params $EXPECTED but agentgateway resolved $RESOLVED"
  exit 1
fi
echo "✓ Port 4000 serves the model and the Azure params resolve to the documented values"
{{< /doc-test >}}

For client secret and workload identity configurations, and for the Azure AI Foundry endpoint type, see [Azure]({{< link-hextra path="/documentation/llm/providers/azure/" >}}).

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
| [Azure OpenAI]({{< link-hextra path="/documentation/llm/providers/azure/" >}}) | GPT and other models, reached with the managed identity |
| [Azure Content Safety]({{< link-hextra path="/documentation/llm/prompt-guards/azure-content-safety/" >}}) | Prompt and response moderation |
| [Azure Key Vault](https://azure.microsoft.com/en-us/products/key-vault/) | Storage for the API keys of non-Azure providers |
| Azure Application Gateway | Load balancing, TLS termination, and WAF in front of the gateway port |
| Azure Monitor | Metrics and log collection |
| Application Insights | Trace collection, through an [OpenTelemetry]({{< link-hextra path="/documentation/observability/traces/configs/otel/" >}}) collector |

## Next steps

* [Azure]({{< link-hextra path="/documentation/llm/providers/azure/" >}}) for the full provider reference, including Azure AI Foundry.
* [Set up the UI]({{< link-hextra path="/documentation/setup/ui/" >}}) to serve the web interface on a gateway.
* [Choose where configuration is stored]({{< link-hextra path="/documentation/setup/storage/" >}}) before you mount a read-only file.
