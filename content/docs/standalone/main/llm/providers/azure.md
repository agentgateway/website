---
title: Azure
weight: 15
icon: /integrations/providers/bw/azure.svg
description: Route agentgateway LLM traffic to models hosted on Microsoft Azure AI.
test:
  azure:
  - file: ${versionRoot}/llm/providers/azure.md
    path: azure
---

Configure Microsoft Azure AI as an LLM provider in agentgateway.

{{< doc-test paths="azure" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Configuration", all three tabs: the Foundry implicit-auth, Foundry API-key
#     (`auth.key.location.header`), and Azure OpenAI configs are accepted by
#     agentgateway (--validate-only), covering `params.azureResourceName`,
#     `params.azureResourceType`, and `params.azureProjectName`.
#   * "Advanced configuration", all six tabs: the routing-based configs for
#     implicit auth, client secret (Foundry and Azure OpenAI), system-assigned and
#     user-assigned managed identity, and workload identity are all accepted,
#     covering every `policies.backendAuth.azure.explicitConfig` variant the page
#     documents.
#   * "Use Claude models on Azure AI Foundry": the routing-based Claude config is
#     accepted. This example was missing its `gateways` and `routes` keys until
#     this test was added, so it could not have been run as written.
#   * With the Foundry implicit-auth config loaded, agentgateway serves the
#     wildcard model and resolves it to the `azure` provider.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * Any authentication method at runtime - external dependency; each needs a
#     real Azure tenant, resource, and identity (Entra ID, service principal,
#     managed identity, or workload identity), none of which the test can stand
#     up. Only that agentgateway accepts each config shape is asserted.
#   * The verification curl at the end of the Claude Foundry section - external
#     dependency, as above.
#   * `params.azureApiVersion` - display-only table row; no example on this page
#     sets it.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}

export AZURE_API_KEY="${AZURE_API_KEY:-test}"
{{< /doc-test >}}

## Authentication

Before you can use Azure as an LLM provider, you must authenticate by using one of the standard [Azure authentication methods](https://learn.microsoft.com/en-us/azure/ai-services/authentication). In standalone mode, this authentication is configured with `llm.models[]` fields (for example, `params.apiKey` or `auth.azure`). In routing-based configurations, use `policies.backendAuth.azure`.

> [!IMPORTANT]
> Azure CLI authentication requires `az` or `azd` to be installed and signed in. Agentgateway calls the CLI when it needs a token. It does not open an interactive flow or run `az login` or `azd auth login` for you. Agentgateway does not bundle either command. Mounting a credential directory such as `~/.azure` makes cached login state available inside the container, but it does not install the CLI. Use Azure CLI authentication only when running Agentgateway directly on your local machine. If Agentgateway runs in a container, use an API key, client secret, managed identity, or workload identity.

## Configuration

Azure supports two endpoint types:

- **Azure AI Foundry** (`foundry`): Connect to Azure AI Foundry project endpoints at `{resourceName}-resource.services.ai.azure.com`.
- **Azure OpenAI** (`openAI`): Connect directly to Azure OpenAI Service deployments at `{resourceName}.openai.azure.com`.

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

{{< tabs >}}

{{% tab name="Foundry (implicit auth)" %}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: azure
    params:
      azureResourceName: "your-resource-name"
      azureResourceType: foundry
      azureProjectName: "your-project-name"
```

{{< doc-test paths="azure" >}}
cat <<'EOF' > config-foundry-implicit.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: azure
    params:
      azureResourceName: "your-resource-name"
      azureResourceType: foundry
      azureProjectName: "your-project-name"
EOF
agentgateway -f config-foundry-implicit.yaml --validate-only
{{< /doc-test >}}

{{% /tab %}}
{{% tab name="Foundry (API key)" %}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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

{{< doc-test paths="azure" >}}
cat <<'EOF' > config-foundry-apikey.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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
EOF
agentgateway -f config-foundry-apikey.yaml --validate-only
{{< /doc-test >}}

{{% /tab %}}
{{% tab name="Azure OpenAI (implicit auth)" %}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "gpt-4.1"
    provider: azure
    params:
      azureResourceName: "your-resource-name"
      azureResourceType: openAI
```

{{< doc-test paths="azure" >}}
cat <<'EOF' > config-azure-openai.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "gpt-4.1"
    provider: azure
    params:
      azureResourceName: "your-resource-name"
      azureResourceType: openAI
EOF
agentgateway -f config-azure-openai.yaml --validate-only
{{< /doc-test >}}

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

## Advanced configuration

For advanced Azure AI scenarios, use the traditional listener/route configuration format. The following tabs show examples for different authentication methods.

{{< tabs >}}

{{% tab name="Foundry (implicit auth)" %}}
**Azure AI Foundry with implicit auth**: Use `DefaultAzureCredential` to automatically detect credentials from the environment (Azure CLI, managed identity, workload identity, or environment variables).

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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

{{< doc-test paths="azure" >}}
cat <<'EOF' > config-adv-foundry-implicit.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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
EOF
agentgateway -f config-adv-foundry-implicit.yaml --validate-only
{{< /doc-test >}}

{{< reuse "agw-docs/snippets/review-configuration.md" >}}
{{< reuse-append "agw-docs/snippets/provider-azure-base-configuration.md" >}}
| `backendAuth.azure.implicit` | Use implicit authentication via `DefaultAzureCredential`, which automatically detects credentials from the environment. |
{{< /reuse-append >}}

{{% /tab %}}
{{% tab name="Foundry (client secret)" %}}
**Azure AI Foundry with client secret**: Use Azure service principal credentials to authenticate agentgateway with an Azure AI Foundry endpoint.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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

{{< doc-test paths="azure" >}}
cat <<'EOF' > config-adv-foundry-client-secret.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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
EOF
agentgateway -f config-adv-foundry-client-secret.yaml --validate-only
{{< /doc-test >}}

{{< reuse "agw-docs/snippets/review-configuration.md" >}}
{{< reuse-append "agw-docs/snippets/provider-azure-base-configuration.md" >}}
| `backendAuth.azure.explicitConfig.clientSecret` | Use Azure service principal authentication with tenant ID, client ID, and client secret. |
{{< /reuse-append >}}

{{% /tab %}}
{{% tab name="Client secret" %}}
**Client secret authentication**
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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

{{< doc-test paths="azure" >}}
cat <<'EOF' > config-adv-client-secret.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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
EOF
agentgateway -f config-adv-client-secret.yaml --validate-only
{{< /doc-test >}}

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

Leave `managedIdentity` empty to use the identity of the Azure resource that runs Agentgateway.
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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

{{< doc-test paths="azure" >}}
cat <<'EOF' > config-adv-system-managed-identity.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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
EOF
agentgateway -f config-adv-system-managed-identity.yaml --validate-only
{{< /doc-test >}}

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
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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

{{< doc-test paths="azure" >}}
cat <<'EOF' > config-adv-user-managed-identity.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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
EOF
agentgateway -f config-adv-user-managed-identity.yaml --validate-only
{{< /doc-test >}}

{{< reuse "agw-docs/snippets/review-configuration.md" >}}
{{< reuse-append "agw-docs/snippets/provider-azure-base-configuration.md" >}}
| `backendAuth.azure.explicitConfig.managedIdentity.userAssignedIdentity` | Use a user-assigned managed identity. Specify exactly one of `clientId`, `objectId`, or `resourceId`. |
{{< /reuse-append >}}

{{% /tab %}}
{{% tab name="Workload identity" %}}
**Workload identity**: Authenticate from Kubernetes without storing Azure credentials in the cluster.

On AKS, [enable Microsoft Entra Workload ID](https://learn.microsoft.com/azure/aks/workload-identity-deploy-cluster), create a user-assigned managed identity, and grant that identity the least-privilege role required by the Azure AI resource. For example, the `Azure AI User` role grants access to Azure AI Foundry.

Create a federated credential that trusts the service account used by Agentgateway. By default, the standalone Helm chart names the service account after the Helm release. For a release named `agentgateway` in the `agentgateway` namespace, use this subject:

```txt
system:serviceaccount:agentgateway:agentgateway
```

The subject must match the namespace and service account name exactly. Configure the chart to annotate that service account and label the pod for the Azure workload identity webhook.

```yaml
serviceAccount:
  create: true
  annotations:
    azure.workload.identity/client-id: <managed-identity-client-id>

podLabels:
  azure.workload.identity/use: "true"
```

Then select workload identity in the Agentgateway configuration.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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

{{< doc-test paths="azure" >}}
cat <<'EOF' > config-adv-workload-identity.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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
EOF
agentgateway -f config-adv-workload-identity.yaml --validate-only
{{< /doc-test >}}

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
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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

{{< doc-test paths="azure" >}}
cat <<'EOF' > config-claude-foundry.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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
EOF
agentgateway -f config-claude-foundry.yaml --validate-only
{{< /doc-test >}}

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The exact Claude model name to match in incoming requests, such as `claude-3-5-haiku-20241022`. Use `*` to match any model name. |
| `provider` | Set to `azure` for Azure AI Foundry. |
| `backendAuth.key.value` | The Azure AI Foundry API key. You can reference environment variables using the `$VAR_NAME` syntax. The key is automatically sent in the `Authorization` header. Other auth method can be applied [Backend authentication]({{< link-hextra path="/configuration/security/backend-authn/" >}})|
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

{{< doc-test paths="azure" >}}
# Confirm the Foundry implicit-auth config serves the wildcard model and resolves
# it to the azure provider.
agentgateway -f config-foundry-implicit.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3

SERVED=$(curl -sf --max-time 10 http://localhost:4000/v1/models | jq -r '[.data[].id] | index("*") // "missing"')
if [ "$SERVED" = "missing" ]; then
  echo "FAIL: the wildcard model from the example config is not served"
  exit 1
fi
PROVIDER=$(curl -sf --max-time 10 http://localhost:15000/config_dump | jq -r '
  [ .backends[].backend.ai
    | select(. != null)
    | .target.providers[].active[].endpoint
    | .provider | keys[0]
  ] | first')
if [ "$PROVIDER" != "azure" ]; then
  echo "FAIL: expected provider azure but agentgateway resolved $PROVIDER"
  exit 1
fi
echo "✓ The wildcard model is served and resolves to the azure provider"
{{< /doc-test >}}
