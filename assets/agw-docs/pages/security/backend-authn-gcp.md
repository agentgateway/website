Authenticate to GCP backends from an {{< reuse "agw-docs/snippets/agentgateway/agentgatewaypolicy.md" >}} using Google Cloud Platform authentication.

By default, the proxy uses ambient credentials from the environment (for example, Workload Identity on GKE, or `GOOGLE_APPLICATION_CREDENTIALS`). Configure GCP auth in your {{< reuse "agw-docs/snippets/agentgateway/agentgatewaypolicy.md" >}} to generate the appropriate token type for your backend.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Configure GCP backend authentication

Create an {{< reuse "agw-docs/snippets/agentgateway/agentgatewaypolicy.md" >}} that uses GCP authentication to sign requests to your backend.

For **access token** authentication (used for most GCP services):

```yaml
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/agentgateway/agentgatewaypolicy.md" >}}
metadata:
  name: gcp-backend-auth
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
    - group: agentgateway.dev
      kind: {{< reuse "agw-docs/snippets/backend.md" >}}
      name: my-gcp-backend
  backend:
    auth:
      gcp:
        type: AccessToken
EOF
```

For **ID token** authentication (used for Cloud Run and other audience-based services):

```yaml
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/agentgateway/agentgatewaypolicy.md" >}}
metadata:
  name: gcp-backend-auth
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
    - group: agentgateway.dev
      kind: {{< reuse "agw-docs/snippets/backend.md" >}}
      name: my-gcp-backend
  backend:
    auth:
      gcp:
        type: IdToken
        audience: "https://my-cloudrun-service-xyz.run.app"
EOF
```

If `audience` is omitted with `IdToken`, it is automatically derived from the backend hostname.

| Field | Description |
|-------|-------------|
| `backend.auth.gcp.type` | The type of token to generate. `AccessToken` is used for most GCP services; `IdToken` is used for Cloud Run. |
| `backend.auth.gcp.audience` | Explicit `aud` claim for the ID token. Only valid with `IdToken` type. Derived from the backend hostname when omitted. |

GCP credentials are sourced from the environment automatically. On GKE, use [Workload Identity](https://cloud.google.com/kubernetes-engine/docs/how-to/workload-identity) to bind the pod's service account to a GCP service account. Outside GKE, set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to a service account key file.

## Cleanup

```sh
kubectl delete {{< reuse "agw-docs/snippets/agentgateway/agentgatewaypolicy.md" >}} gcp-backend-auth -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
