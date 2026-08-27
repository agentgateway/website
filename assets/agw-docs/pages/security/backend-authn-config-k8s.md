## Configure backend authentication

In Kubernetes, backend authentication is the `auth` field of a backend policy. Three resources carry it, and they are not interchangeable.

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
| {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} | `spec.policies.auth` | All methods except `crossAppAccess`{{< version exclude-if="2026.7.1" >}} and `jwtSign`{{< /version >}}. |

Choose the {{< reuse "agw-docs/snippets/policy.md" >}} resource when one credential serves several backends, or when you want to attach the credential higher up, such as to a route or a gateway. Choose the inline `spec.policies.auth` field when the credential belongs to exactly one backend or model. For how the controller resolves a policy that targets more than one level, see [Targeting and merging]({{< link-hextra path="/about/policies/target-merge/" >}}).

> [!IMPORTANT]
> A policy that targets an {{< reuse "agw-docs/snippets/backend.md" >}} takes effect only if a route forwards traffic to that backend. If no route does, the policy reports `Attached=False` with the message `Policy is not attached`, and the gateway sends no credential. The `backendRefs` entry of the HTTPRoute must name the {{< reuse "agw-docs/snippets/backend.md" >}}, not the Kubernetes Service behind it.

## Where the credential comes from

Every method except `key` and `passthrough` reads its credential from a Kubernetes Secret, through a `secretRef` field. The default resolver reads a specific key from the Secret, and the key differs by method.

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
{{< version exclude-if="2026.7.1" >}}| `auth.jwtSign.signingKeyRef` | `signingKey`. |{{< /version >}}

The Secret must be in the same namespace as the policy or backend that names it.

The cloud methods do not need a Secret at all. When you omit `secretRef`, the gateway uses the ambient identity of the pod that it runs in, such as a Google service account through Workload Identity on GKE, an IAM role for a service account on EKS, or an Azure workload identity on AKS. Running without a long-lived secret is the recommended setup for each cloud, and each provider page describes the resolution order that the gateway follows.

## Next

Each method has its own page.

| Method | Page |
| -- | -- |
| Static keys, Secrets, passthrough, and extra credentials | [Static keys and passthrough]({{< link-hextra path="/security/backend-authn/key/" >}}) |
| AWS, Azure, and Google Cloud | [Cloud provider credentials]({{< link-hextra path="/security/backend-authn/providers/" >}}) |{{< version exclude-if="2026.7.1" >}}
| Signed JWT | [Signed JWT (jwtSign)]({{< link-hextra path="/security/backend-authn/jwt-sign/" >}}) |{{< /version >}}
| OAuth token exchange | [OAuth token exchange]({{< link-hextra path="/security/backend-authn/oauth-token-exchange/" >}}) |
| Cross App Access | [Cross App Access (ID-JAG)]({{< link-hextra path="/security/backend-authn/cross-app-access/" >}}) |

For the client side of authentication, see [JWT auth]({{< link-hextra path="/security/jwt/" >}}) and [API key auth]({{< link-hextra path="/security/apikey/" >}}). To control which callers are allowed through, see [Authorization]({{< link-hextra path="/security/authorization/" >}}).

{{< reuse "agw-docs/pages/security/backend-authn-mode-differences.md" >}}
