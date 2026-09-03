## About

The `azure` backend authentication method gets a Microsoft Entra ID token and writes it to the `Authorization` header of every request that the gateway forwards to the backend. By default, the gateway requests the token for the Azure Cognitive Services scope, or for the Azure AI scope when the backend is an Azure AI Foundry endpoint. To authenticate to Microsoft Graph or another Microsoft Entra-protected backend, configure the token scopes. The gateway caches the credential after the first successful use.

The method has two forms.

* **Implicit.** You set `azure: {}` and configure no credential source. The gateway detects the identity from its own environment. This is the recommended form on AKS, where the workload identity of the pod supplies the token and no secret is stored in the cluster.
* **Explicit.** You name one credential source: a Secret that holds service principal credentials, a managed identity, or a workload identity. Use an explicit source when the gateway must use an identity other than the one that the environment would give it.

At most one credential source may be set. The API server rejects a policy that sets two.

## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

You also need an Azure resource to authenticate to, and an identity that is allowed to call it.

## Choose a credential source

{{< reuse "agw-docs/snippets/review-configuration.md" >}} Each tab shows the `auth` block of an {{< reuse "agw-docs/snippets/policy.md" >}} that targets an {{< reuse "agw-docs/snippets/backend.md" >}}.

{{< tabs >}}
{{% tab name="Implicit" %}}
Leave `azure` empty, and the gateway detects the identity from its environment. On AKS with workload identity enabled, this is the form to use.

```yaml
auth:
  azure: {}
```
{{% /tab %}}
{{% tab name="Workload identity" %}}
Name workload identity explicitly. The gateway uses the federated token and the Azure environment variables that are projected into its pod. The result is the same as the implicit form on a correctly configured AKS cluster, but it fails rather than falling through to another source.

```yaml
auth:
  azure:
    workloadIdentity: {}
```
{{% /tab %}}
{{% tab name="Service principal" %}}
Point at a Secret that holds service principal credentials. The default resolver reads the `clientID`, `tenantID`, and `clientSecret` keys.

```yaml
auth:
  azure:
    secretRef:
      name: azure-creds
```
{{% /tab %}}
{{% tab name="Managed identity" %}}
Name a user-assigned managed identity. Read the note that follows this section before you use this form.

```yaml
auth:
  azure:
    managedIdentity:
      clientId: "<client-id>"
      objectId: "<object-id>"
      resourceId: "<resource-id>"
```
{{% /tab %}}
{{< /tabs >}}

| Field | Description |
| -- | -- |
| `azure` | Set to `{}` to detect the credential from the environment. Set exactly one child field to name a credential source instead. |
| `azure.scopes` | Scopes to request for the access token. When omitted, the gateway infers the scope from the backend hostname. Set 1–64 scopes. With `managedIdentity`, set exactly one scope. |
| `azure.secretRef` | Secret in the policy namespace that holds service principal credentials under the `clientID`, `tenantID`, and `clientSecret` keys. |
| `azure.workloadIdentity` | Set to `{}` to use the federated token and the Azure environment variables that are projected into the gateway pod. |
| `azure.managedIdentity` | Names a user-assigned managed identity. |

> [!WARNING]
> The `managedIdentity` field requires all three of `clientId`, `objectId`, and `resourceId`, but the gateway uses only the first one that is not empty, in that order. A policy that names one identifier is rejected with `objectId: Required value`. To use a user-assigned managed identity, set `clientId` to the identifier that you want the gateway to use, and set the other two fields to a placeholder. Prefer `workloadIdentity` or the implicit form where you can, because neither has this restriction.

## Configure token scopes

Set `scopes` when the backend requires a token for a resource other than Azure Cognitive Services or Azure AI Foundry. For example, the following configuration uses workload identity to request a token for Microsoft Graph.

```yaml
auth:
  azure:
    scopes:
    - https://graph.microsoft.com/.default
    workloadIdentity: {}
```

The configured scopes override hostname-based inference. Use the scope required by the backend, commonly the resource application ID URI followed by `/.default`. The identity must have permission to access the requested resource. When you use `managedIdentity`, configure exactly one scope; the API server rejects a managed identity configuration with multiple scopes.

## Configure Azure backend authentication

1. Create a Secret with your service principal credentials in it. Skip this step if you use the implicit form, workload identity, or a managed identity.

   ```sh
   kubectl create secret generic azure-creds \
     --namespace httpbin \
     --from-literal=clientID="<your-client-id>" \
     --from-literal=tenantID="<your-tenant-id>" \
     --from-literal=clientSecret="<your-client-secret>"
   ```

2. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that attaches Azure authentication to your Azure backend.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: azure-backend-auth
     namespace: httpbin
   spec:
     targetRefs:
     - group: {{< reuse "agw-docs/snippets/group.md" >}}
       kind: {{< reuse "agw-docs/snippets/backend.md" >}}
       name: my-azure-backend
     backend:
       auth:
         azure:
           secretRef:
             name: azure-creds
   EOF
   ```

3. Verify that the controller accepted the policy.

   ```sh
   kubectl get {{< reuse "agw-docs/snippets/policy.md" >}} azure-backend-auth -n httpbin \
     -o jsonpath='{.status.ancestors[0].conditions[?(@.type=="Accepted")].message}'
   ```

   Example output:

   ```
   Policy accepted
   ```

4. Send a request through the gateway to your Azure backend. A `200` response means that the gateway got a token and that Azure accepted it.

## How the gateway resolves an implicit credential

When you set `azure: {}`, the gateway tries the following credential sources in order and stops at the first one that returns a token. The chain matches the `DefaultAzureCredential` chain of the Azure SDK.

1. **Environment credential.** A service principal, used when `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_CLIENT_SECRET` are all set.
2. **Workload identity credential.** A federated token, used when `AZURE_FEDERATED_TOKEN_FILE`, `AZURE_TENANT_ID`, and `AZURE_CLIENT_ID` are set. This is the source that an AKS cluster with workload identity enabled supplies.
3. **Managed identity credential.** The identity of the Azure host, read from the instance metadata service. A user-assigned identity is selected with `AZURE_CLIENT_ID`.
4. **Developer tools credential.** The cached login of the Azure CLI (`az login`) or the Azure Developer CLI (`azd auth login`).

The gateway caches the source that first returns a token and uses it for every later request.

Two behaviors of this chain are worth knowing.

* **The managed identity step is guarded by a probe.** Before it tries the instance metadata service, the gateway opens a TCP connection to `169.254.169.254:80` and waits one second. If the connection does not succeed, the gateway skips the step. Without the probe, the Azure SDK retries for about 99 seconds on a host that is not an Azure virtual machine, which would stall every request on the route. The gateway skips the probe when `IDENTITY_ENDPOINT` or `MSI_ENDPOINT` is set, because the SDK then uses that endpoint instead of the metadata service.
* **The developer tools step calls a command that the gateway image does not contain.** A gateway that runs in Kubernetes cannot reach step 4, because neither `az` nor `azd` is installed in the image. Treat the step as available for local development with the standalone binary only.

> [!TIP]
> To find out which source the gateway used, set the log level to `trace` and look for `DefaultAzureCredential` in the gateway logs. The gateway records the name of the source that provided the token, and the construction error of every source that failed.

## Troubleshoot

A request that the gateway cannot authenticate returns a `500`.

```
backend authentication failed: the credential provider was not enabled
```

| Symptom | Cause |
| -- | -- |
| The API server rejects the policy with `objectId: Required value`. | The `managedIdentity` field names one identifier. All three fields are required. See the warning earlier on this page. |
| The API server rejects the policy with `at most one of the fields in [secretRef managedIdentity workloadIdentity] may be set`. | The policy names two credential sources. Name one, or set `azure: {}` to detect the source. |
| The API server rejects the policy with `unknown field "spec.backend.auth.azure.explicitConfig"`. | The configuration was copied from the standalone binary, which nests the credential source under `explicitConfig`. In Kubernetes, set the source directly on `azure`. |
| Every request returns a `500`, and the gateway logs show that each credential source failed to construct. | The gateway has no identity. Confirm that workload identity is enabled on the cluster and that the service account of the gateway is annotated for it, or supply a Secret with `secretRef`. |
| The first request on a route takes several seconds. | The gateway is resolving the credential for the first time. The result is cached, so later requests do not pay this cost. |

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} azure-backend-auth -n httpbin
kubectl delete secret azure-creds -n httpbin
```
