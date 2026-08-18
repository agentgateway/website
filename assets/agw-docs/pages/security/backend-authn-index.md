Backend authentication is how the gateway proves its own identity to an upstream service. It is separate from client authentication, which is how a client proves its identity to the gateway. A route can use both: the gateway validates the client credential, strips it, and then attaches its own credential to the request that it forwards.

## Backend authentication methods

{{< reuse "agw-docs/pages/security/backend-authn-methods.md" >}}

## Where to configure backend authentication

Kubernetes has three places to set backend authentication, and they are not interchangeable.

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# Attach a policy to a backend, a route, or a gateway.
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
spec:
  targetRefs:
  - group: {{< reuse "agw-docs/snippets/group.md" >}}
    kind: {{< reuse "agw-docs/snippets/backend.md" >}}
    name: my-backend
  backend:
    auth:
      secretRef:
        name: my-credentials
---
# Or set the credential inline on the backend that uses it.
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
spec:
  policies:
    auth:
      secretRef:
        name: my-credentials
```

| Resource | Field | Methods available |
| -- | -- | -- |
| {{< reuse "agw-docs/snippets/policy.md" >}} | `spec.backend.auth` | All methods. |
| {{< reuse "agw-docs/snippets/backend.md" >}} | `spec.policies.auth` | All methods. |
| {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} | `spec.policies.auth` | All methods except `crossAppAccess`{{< version exclude-if="1.4.x" >}} and `jwtSign`{{< /version >}}. |

Choose the {{< reuse "agw-docs/snippets/policy.md" >}} resource when you want one credential to serve several backends, or when you want to attach the credential higher up, such as to a route or a gateway. Choose the inline `spec.policies.auth` field when the credential belongs to exactly one backend or model.

> [!IMPORTANT]
> A policy that targets an {{< reuse "agw-docs/snippets/backend.md" >}} takes effect only if a route forwards traffic to that backend. If no route does, the policy reports `Attached=False` with the message `Policy is not attached`, and the gateway sends no credential. The `backendRefs` entry of the HTTPRoute must name the {{< reuse "agw-docs/snippets/backend.md" >}}, not the Kubernetes Service behind it.

## Where the credential comes from

Every method except `key` and `passthrough` reads its credential from a Kubernetes Secret, through a `secretRef` field. The default resolver reads a specific key from the Secret, which differs by method.

<!--
The version-gated row below has to stay LAST in this table. A gate that renders
nothing leaves a blank line, which ends the table and silently drops every row
after it.

Hugo parses shortcode syntax inside an HTML comment too, so do not write a sample
gate here: an unclosed one fails the whole build.
-->
| Field | Keys that the resolver reads |
| -- | -- |
| `auth.secretRef` | `Authorization`. Set `secretRef.key` to read a different key. |
| `auth.aws.secretRef` | `accessKey` and `secretKey`, plus `sessionToken` for temporary credentials. |
| `auth.azure.secretRef` | `clientID`, `tenantID`, and `clientSecret`. |
| `auth.gcp.secretRef` | `credentials.json`. Set `secretRef.key` to read a different key. |
{{< version exclude-if="1.4.x" >}}| `auth.jwtSign.signingKeyRef` | `signingKey`. |{{< /version >}}

The Secret must be in the same namespace as the policy or backend that names it.

The cloud methods do not need a Secret at all. When you omit `secretRef`, the gateway uses the ambient identity of the pod that it runs in, such as a Google service account through Workload Identity on GKE, an IAM role for a service account on EKS, or an Azure workload identity on AKS. Running without a long-lived secret is the recommended setup for each cloud, and each of the cloud pages describes the resolution order that the gateway follows.

## Send more than one credential

Some upstreams want two credentials on the same request, such as a bearer token and a subscription key. The `credentials` list covers that case. Each entry names a Secret and the location to write the value to, and the list is independent of the primary method, so you can set it on its own or together with one.

```yaml
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
spec:
  targetRefs:
  - group: {{< reuse "agw-docs/snippets/group.md" >}}
    kind: {{< reuse "agw-docs/snippets/backend.md" >}}
    name: my-backend
  backend:
    auth:
      secretRef:
        name: my-credentials
      credentials:
      - location:
          header:
            name: x-tenant-key
        secretRef:
          name: extra-credentials
          key: tenant-key
      - location:
          queryParameter:
            name: subscription
        secretRef:
          name: extra-credentials
          key: subscription-key
```

The policy in the example sends three credentials on every request: the `Authorization` header from the primary `secretRef`, an `x-tenant-key` header, and a `subscription` query parameter.

For the full field reference and a worked example, see [Static keys and passthrough]({{< link-hextra path="/security/backend-authn/key/" >}}).

## How the modes differ

The standalone binary and Kubernetes configure the same features, but they do not use the same field names, and in several places they do not use the same shape either. Do not copy a configuration block from one mode to the other.

<!--
The version-gated row below has to stay LAST in this table, for the same reason
as the table above it.
-->
| Concern | Standalone | Kubernetes |
| -- | -- | -- |
| Field that holds the settings | `policies.backendAuth` | `spec.backend.auth` or `spec.policies.auth` |
| Static key | `key.value`, either inline or `{file: <path>}` | `key`, an inline string |
| Credential from a Secret | Not available. Read the value from a file instead. | `secretRef` |
| Credential location | Nested under the method, such as `key.location` | A sibling field, `auth.location` |
| Methods that accept `location` | Every method that writes a credential | `key`, `secretRef`, and `passthrough` only |
| Entry in the `credentials` list | `location` and `key` | `location` and `secretRef` |
| Google token type | `accessToken` and `idToken` | `AccessToken` and `IdToken` |
| Azure credential source | Nested under `explicitConfig`, plus an `implicit` and a `developerImplicit` method | Set directly on `azure`, with no `developerImplicit` method |
| OAuth client authentication method | `clientSecretBasic`, `clientSecretPost`, and `privateKeyJwt` | `ClientSecretBasic`, `ClientSecretPost`, and `PrivateKeyJwt` |
{{< version exclude-if="1.4.x" >}}| Signing key for `jwtSign` | `signingKey`, either the PEM text or `{file: <path>}` | `signingKeyRef`, a Secret reference |{{< /version >}}

> [!NOTE]
> The capitalization differences are enforced, not cosmetic. The standalone binary rejects `AccessToken`, and the custom resources reject `accessToken`. A wrong case fails validation rather than falling back to a default.

For the standalone equivalents of these pages, see [Backend authentication](https://agentgateway.dev/docs/standalone/latest/configuration/security/backend-authn/) in the standalone documentation.
