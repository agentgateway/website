Configure authentication for backends in Google Cloud Platform (GCP) with an {{< reuse "agw-docs/snippets/policy.md" >}}.

By default, the proxy uses ambient credentials from the cluster provider environment, such as [Workload Identity on GKE](https://cloud.google.com/kubernetes-engine/docs/how-to/workload-identity), or the `GOOGLE_APPLICATION_CREDENTIALS` environment variable set to a service account key file. To use token-based credentials, apply an {{< reuse "agw-docs/snippets/policy.md" >}} with GCP auth to your backend.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Configure GCP backend authentication

Create an {{< reuse "agw-docs/snippets/policy.md" >}} that uses GCP authentication to sign requests to your backend.

For **access token** authentication (used for most GCP services):

```yaml
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
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
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
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

| Field | Description |
|-------|-------------|
| `backend.auth.gcp.type` | The type of token to generate. `AccessToken` is used for most GCP services; `IdToken` is used for Cloud Run. |
| `backend.auth.gcp.audience` | Explicit `aud` claim for the ID token. Only valid with `IdToken` type. Derived from the backend hostname when omitted. |

## Cleanup

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} gcp-backend-auth -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
