## About

The `azure` backend authentication method gets a Microsoft Entra ID token and writes it to the `Authorization` header of every request that agentgateway forwards to the backend. Agentgateway requests the token for the Azure Cognitive Services scope, or for the Azure AI scope when the backend is an Azure AI Foundry endpoint, and it caches the credential after the first successful use.

The method has three forms.

* **`implicit`** detects the credential from the environment, through the full `DefaultAzureCredential` chain. Use this form in production when the host supplies the identity, such as a virtual machine with a managed identity.
* **`developerImplicit`** uses the Azure CLI login only. Use this form on a workstation, where it fails fast instead of trying the production sources first.
* **`explicitConfig`** names one credential source: a service principal, a managed identity, or a workload identity.

> [!NOTE]
> This page covers `azure` as a general backend authentication method, which works for any Azure service. To route requests to Azure OpenAI or Azure AI Foundry as an LLM provider, see [Azure]({{< link-hextra path="/documentation/llm/providers/azure/" >}}), which covers the same authentication methods alongside the provider settings.

## Configuration examples

Each example shows the `backendAuth` policy only. Attach it to a backend under `backends[].policies`, or to a route under `routes[].policies`.

{{< tabs >}}
{{% tab name="Implicit" %}}
Detect the credential from the environment. Agentgateway tries each source of the `DefaultAzureCredential` chain in order.

```yaml
backendAuth:
  azure:
    implicit: {}
```
{{% /tab %}}
{{% tab name="Developer" %}}
Use the Azure CLI login only. Agentgateway calls `az` or `azd`, so both must be installed and signed in.

```yaml
backendAuth:
  azure:
    developerImplicit: {}
```
{{% /tab %}}
{{% tab name="Service principal" %}}
Name a service principal directly. The three inner fields are `snake_case`, unlike every field around them.

```yaml
backendAuth:
  azure:
    explicitConfig:
      clientSecret:
        tenant_id: "$AZURE_TENANT_ID"
        client_id: "$AZURE_CLIENT_ID"
        client_secret: "$AZURE_CLIENT_SECRET"
```
{{% /tab %}}
{{% tab name="Managed identity" %}}
Use the managed identity of the Azure host. Leave `managedIdentity` empty for the system-assigned identity, or name a user-assigned one.

```yaml
backendAuth:
  azure:
    explicitConfig:
      managedIdentity: {}
```

To select a user-assigned identity, set exactly one of `clientId`, `objectId`, or `resourceId`.

```yaml
backendAuth:
  azure:
    explicitConfig:
      managedIdentity:
        userAssignedIdentity:
          clientId: "<your-client-id>"
```
{{% /tab %}}
{{% tab name="Workload identity" %}}
Use the federated token and the Azure environment variables that are projected into the pod. This is the form to use when the standalone binary runs in Kubernetes with workload identity enabled.

```yaml
backendAuth:
  azure:
    explicitConfig:
      workloadIdentity: {}
```
{{% /tab %}}
{{< /tabs >}}

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Field | Description |
| -- | -- |
| `azure.implicit` | Set to `{}` to detect the credential from the environment with the full chain. |
| `azure.developerImplicit` | Set to `{}` to use the Azure CLI login only. |
| `azure.explicitConfig.clientSecret` | Service principal credentials. Requires `tenant_id`, `client_id`, and `client_secret`, all in `snake_case`. |
| `azure.explicitConfig.managedIdentity` | Managed identity of the Azure host. Set to `{}` for the system-assigned identity, or set `userAssignedIdentity` to select a user-assigned one. |
| `azure.explicitConfig.managedIdentity.userAssignedIdentity` | Identifier of a user-assigned managed identity. Set exactly one of `clientId`, `objectId`, or `resourceId`. |
| `azure.explicitConfig.workloadIdentity` | Set to `{}` to use the projected federated token. |

> [!WARNING]
> The three fields under `clientSecret` are `tenant_id`, `client_id`, and `client_secret`, in `snake_case`. Every field around them is camelCase, so this is easy to get wrong. The camelCase spelling is not accepted, and agentgateway rejects the configuration when it loads rather than falling back to another credential source.
>
> ```
> Error: routes[0]: data did not match any variant of untagged enum BackendAuthCompat
> ```

{{< doc-test paths="backend-authn-azure" >}}
# WHAT THIS TEST VALIDATES:
#   * Every credential mode in the tabs above is accepted as a complete standalone config:
#     implicit, developerImplicit, and all three explicitConfig sources, including each of the
#     three userAssignedIdentity identifiers.
#   * The snake_case gotcha is real: the camelCase spelling of the clientSecret fields is rejected
#     with the error that the warning quotes.
#   * userAssignedIdentity is a one-of: naming two identifiers is rejected.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That any credential actually authenticates to Azure -- external dependency: each mode needs a
#     real Azure tenant and identity (a service principal, a managed identity, or a federated
#     workload identity), none of which a doc test can stand up. Only that agentgateway accepts
#     each config shape is asserted.
#   * The resolution order of the implicit chain -- external dependency: exercising a rung means
#     supplying the credential it looks for, on the host type it looks on.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
export AZURE_TENANT_ID="${AZURE_TENANT_ID:-00000000-0000-0000-0000-000000000000}"
export AZURE_CLIENT_ID="${AZURE_CLIENT_ID:-11111111-1111-1111-1111-111111111111}"
export AZURE_CLIENT_SECRET="${AZURE_CLIENT_SECRET:-not-a-real-secret}"
{{< /doc-test >}}

{{< doc-test paths="backend-authn-azure" >}}
# Wrap each policy fragment from the tabs above in the gateways/routes scaffolding that a complete
# standalone config needs, then validate it. The fragments on the page are field references, so
# they are not runnable as written.
azure_case() {
  local name="$1" expect="$2"
  { cat <<'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: myaccount.openai.azure.com:443
    policies:
      backendAuth:
EOF
    sed 's/^/        /'
  } > "config-azure-$name.yaml"
  if agentgateway -f "config-azure-$name.yaml" --validate-only > "azure-$name.log" 2>&1; then
    [ "$expect" = ok ] || { echo "FAIL: $name was accepted but should be rejected"; exit 1; }
    echo "ok       $name"
  else
    [ "$expect" = fail ] || { echo "FAIL: $name was rejected"; cat "azure-$name.log"; exit 1; }
    echo "rejected $name (as expected)"
  fi
}

azure_case implicit ok <<'EOF'
azure:
  implicit: {}
EOF

azure_case developer-implicit ok <<'EOF'
azure:
  developerImplicit: {}
EOF

azure_case client-secret ok <<'EOF'
azure:
  explicitConfig:
    clientSecret:
      tenant_id: "$AZURE_TENANT_ID"
      client_id: "$AZURE_CLIENT_ID"
      client_secret: "$AZURE_CLIENT_SECRET"
EOF

azure_case managed-identity-system ok <<'EOF'
azure:
  explicitConfig:
    managedIdentity: {}
EOF

azure_case managed-identity-client-id ok <<'EOF'
azure:
  explicitConfig:
    managedIdentity:
      userAssignedIdentity:
        clientId: "22222222-2222-2222-2222-222222222222"
EOF

azure_case managed-identity-object-id ok <<'EOF'
azure:
  explicitConfig:
    managedIdentity:
      userAssignedIdentity:
        objectId: "33333333-3333-3333-3333-333333333333"
EOF

azure_case managed-identity-resource-id ok <<'EOF'
azure:
  explicitConfig:
    managedIdentity:
      userAssignedIdentity:
        resourceId: "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/my-identity"
EOF

azure_case workload-identity ok <<'EOF'
azure:
  explicitConfig:
    workloadIdentity: {}
EOF

# The gotcha the page warns about: camelCase inner fields are rejected.
azure_case client-secret-camel fail <<'EOF'
azure:
  explicitConfig:
    clientSecret:
      tenantId: "$AZURE_TENANT_ID"
      clientId: "$AZURE_CLIENT_ID"
      clientSecret: "$AZURE_CLIENT_SECRET"
EOF
grep -q 'did not match any variant of untagged enum BackendAuthCompat' azure-client-secret-camel.log || {
  echo "FAIL: the error the warning quotes is no longer what the binary emits"
  cat azure-client-secret-camel.log; exit 1; }

# userAssignedIdentity is a one-of, so two identifiers must be rejected.
azure_case managed-identity-two-ids fail <<'EOF'
azure:
  explicitConfig:
    managedIdentity:
      userAssignedIdentity:
        clientId: "22222222-2222-2222-2222-222222222222"
        objectId: "33333333-3333-3333-3333-333333333333"
EOF

echo "azure standalone backend authentication verified"
{{< /doc-test >}}

## How agentgateway resolves an implicit credential

With `implicit`, agentgateway tries the following credential sources in order and stops at the first one that returns a token. The chain matches the `DefaultAzureCredential` chain of the Azure SDK.

1. **Environment credential.** A service principal, used when `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_CLIENT_SECRET` are all set.
2. **Workload identity credential.** A federated token, used when `AZURE_FEDERATED_TOKEN_FILE`, `AZURE_TENANT_ID`, and `AZURE_CLIENT_ID` are set.
3. **Managed identity credential.** The identity of the Azure host, read from the instance metadata service. A user-assigned identity is selected with `AZURE_CLIENT_ID`.
4. **Developer tools credential.** The cached login of the Azure CLI (`az login`) or the Azure Developer CLI (`azd auth login`).

Agentgateway caches the source that first returns a token and uses it for every later request. Each `azure` policy keeps its own cache, so two backends that name different service principals do not share a credential.

Two behaviors of this chain are worth knowing.

* **The managed identity step is guarded by a probe.** Before it tries the instance metadata service, agentgateway opens a TCP connection to `169.254.169.254:80` and waits one second. If the connection does not succeed, agentgateway skips the step. Without the probe, the Azure SDK retries for about 99 seconds on a host that is not an Azure virtual machine, which would stall every request on the route. Agentgateway skips the probe when `IDENTITY_ENDPOINT` or `MSI_ENDPOINT` is set, because the SDK then uses that endpoint instead of the metadata service.
* **The developer tools step needs a command that agentgateway does not bundle.** Agentgateway calls `az` or `azd` when it needs a token. It does not open an interactive flow, and it does not run `az login` or `azd auth login` for you. Mounting a credential directory such as `~/.azure` into a container makes a cached login available, but it does not install the command. In a container, use a service principal, a managed identity, or a workload identity instead.

> [!TIP]
> To find out which source agentgateway used, run the binary with `RUST_LOG=trace` and look for `DefaultAzureCredential` in the output. Agentgateway records the name of the source that provided the token, and the construction error of every source that failed.

## Troubleshoot

A request that agentgateway cannot authenticate returns a `500`.

```
backend authentication failed: the credential provider was not enabled
```

| Symptom | Cause |
| -- | -- |
| `data did not match any variant of untagged enum BackendAuthCompat` | A field name is wrong. Check the `clientSecret` fields for camelCase, and check that `userAssignedIdentity` sets exactly one identifier. |
| Every request returns a `500`, and the log shows that each credential source failed to construct. | Agentgateway has no identity. Set an explicit credential source, or supply the environment variables that one of the implicit sources needs. |
| Requests hang for roughly a second before they fail. | The managed identity probe is timing out. Agentgateway is not on an Azure host, so the step is skipped after the one-second probe. Use an explicit credential source to skip it. |
| The Azure CLI source never runs in a container. | The image does not contain `az` or `azd`. Use a service principal, a managed identity, or a workload identity. |
| The first request on a route takes several seconds. | Agentgateway is resolving the credential for the first time. The result is cached, so later requests do not pay this cost. |
