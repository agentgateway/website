## About

Use one of the following backend authentication methods to send a static credential to your backend. The client may already send the credential that the backend expects. If it does not, the gateway must supply one of its own.

* **Kubernetes Secret** (`secretRef`) reads the credential from a Secret in the cluster. Use this method for an API key or a long-lived token.
* **Inline** (`key`) holds the credential in the policy itself. The value is stored in plain text in the cluster and in any Git repository that tracks the resource, so use a Secret instead wherever you can.
* **Passthrough** (`passthrough`) forwards the JWT that the client sent. Use this method when the backend validates the same token that the gateway validated.

All three write the credential to the `Authorization` header with a `Bearer ` prefix by default. The `location` field changes where the gateway writes it.

The `credentials` list is separate. It adds credentials rather than choosing one, so you can send a second or third credential on the same request. Set it on its own, or alongside one of the three methods.

## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

## Send a static credential from a Secret

1. Create a Secret that holds the credential. The default resolver reads the `Authorization` key.

   ```sh {paths="backend-authn-key"}
   kubectl create secret generic backend-api-key \
     --namespace httpbin \
     --from-literal=Authorization="my-backend-token"
   ```

2. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that reads the Secret and attaches the credential to every request that the gateway forwards to the httpbin route.

   ```yaml {paths="backend-authn-key"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: static-backend-auth
     namespace: httpbin
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: httpbin
     backend:
       auth:
         secretRef:
           name: backend-api-key
   EOF
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}} The example sets `secretRef.name` only. The remaining fields are optional: you add the `secretRef.*` fields to the same `secretRef` block, and `location` alongside it.

   | Field | Description |
   | -- | -- |
   | `secretRef.name` | Required name of a Secret in the same namespace as the policy. |
   | `secretRef.key` | Key in the Secret that holds the credential. Defaults to `Authorization`. |
   | `secretRef.group` and `secretRef.kind` | Credential source other than a Secret. Omit both to use a Secret. Set both together, because setting one alone is rejected. |
   | `location` | Where the gateway writes the credential. Defaults to the `Authorization` header with a `Bearer ` prefix. Set exactly one of `header`, `queryParameter`, or `cookie`. For an example, see [Change the credential location](#change-the-credential-location). |

3. Send a request through the gateway to the httpbin `/headers` endpoint, which reflects the headers that the backend received.

   ```sh {paths="backend-authn-key"}
   curl -s "http://$INGRESS_GW_ADDRESS:80/headers" -H "host: www.example.com" | jq '.headers.Authorization'
   ```

   The backend receives the value from the Secret, with the `Bearer ` prefix that the default location adds.

   ```
   [
     "Bearer my-backend-token"
   ]
   ```

> [!WARNING]
> Store the bare token in the Secret. The gateway strips a `Bearer ` prefix only when it reads the `Authorization` key, and then re-adds the prefix that the location defines. A value of `Bearer my-backend-token` under that key therefore still arrives as `Bearer my-backend-token`. Under any other key the prefix is not stripped, so the same value arrives as `Bearer Bearer my-backend-token`. Entries in the `credentials` list are never stripped, whichever key they read.

{{< doc-test paths="backend-authn-key" >}}
YAMLTest -f - <<'EOF'
- name: wait for the static backend auth policy to be accepted
  wait:
    target:
      kind: {{< reuse "agw-docs/snippets/policy.md" >}}
      metadata:
        namespace: httpbin
        name: static-backend-auth
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 5
EOF

# WHAT THIS TEST VALIDATES:
#   * The secretRef policy is accepted, and the backend receives the Secret value with the
#     `Bearer ` prefix that the default location adds.
# Programming the backend auth policy can lag route readiness, so poll until the credential shows
# up rather than sending one request and trusting the timing.
for i in $(seq 1 60); do
  curl -s --max-time 5 "http://${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com" > key-secretref.json || true
  grep -q 'Bearer my-backend-token' key-secretref.json && break
  sleep 2
done
grep -q 'Bearer my-backend-token' key-secretref.json || { echo "FAILED: the backend never received the credential"; exit 1; }
echo "secretRef backend authentication verified"
{{< /doc-test >}}

## Send an inline credential

The `key` method holds the credential in the policy instead of a Secret. The value is stored in plain text in the cluster, and in any Git repository that tracks the resource. Use the method only when a Secret is not an option.

```yaml
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: inline-backend-auth
  namespace: httpbin
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: httpbin
  backend:
    auth:
      key: my-backend-token
```

The value is a plain string, not a nested object, and it is capped at 2048 characters. The `key` method takes the same `location` field as `secretRef` and writes to the `Authorization` header with a `Bearer ` prefix by default. Unlike `secretRef`, it never strips a `Bearer ` prefix from the value that you set, so store the bare token here too.

## Change the credential location

Set the `location` field in your {{< reuse "agw-docs/snippets/policy.md" >}} resource to write the credential somewhere other than the `Authorization` header. The field is a sibling of `key`, `secretRef`, and `passthrough`, not a field inside them, and it applies to those three methods only.

1. Update the policy to send the credential as an `x-api-key` header instead.

   ```yaml {paths="backend-authn-key"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: static-backend-auth
     namespace: httpbin
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: httpbin
     backend:
       auth:
         secretRef:
           name: backend-api-key
         location:
           header:
             name: x-api-key
   EOF
   ```

2. Send another request and check the new header.

   ```sh {paths="backend-authn-key"}
   curl -s "http://$INGRESS_GW_ADDRESS:80/headers" -H "host: www.example.com" | jq '.headers'
   ```

   The credential moves to `x-api-key`, and the gateway adds no prefix. A custom location writes the bare value, because the `Bearer ` prefix belongs to the default location and not to the credential.

   ```
   {
     "X-Api-Key": [
       "my-backend-token"
     ],
     ...
   }
   ```

   To write a prefix at a custom header, set it explicitly.

   ```yaml
   location:
     header:
       name: x-api-key
       prefix: "Token "
   ```

{{< doc-test paths="backend-authn-key" >}}
# WHAT THIS TEST VALIDATES:
#   * A custom header location moves the credential and writes the bare value, with no `Bearer `
#     prefix.
for i in $(seq 1 60); do
  curl -s --max-time 5 "http://${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com" > key-location.json || true
  grep -qi 'x-api-key' key-location.json && break
  sleep 2
done
python3 -c '
import json
h={k.lower():v for k,v in json.load(open("key-location.json"))["headers"].items()}
one=lambda v: v[0] if isinstance(v,list) else v
assert one(h.get("x-api-key"))=="my-backend-token", h.get("x-api-key")
assert "authorization" not in h, h.get("authorization")
print("custom credential location verified")'
{{< /doc-test >}}

## Pass through client credentials

If the client already sends the credential that the backend expects, forward it with the `passthrough` method. A client authentication policy strips the credential that it validates before the gateway forwards the request, so without `passthrough` the backend receives nothing.

The method forwards a JWT only. It re-sends the token that a [JWT authentication]({{< link-hextra path="/security/jwt/" >}}) policy validated on the route. An [API key]({{< link-hextra path="/security/apikey/" >}}) or basic auth credential is still stripped, and `passthrough` does not add it back.

```yaml
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: passthrough-backend-auth
  namespace: httpbin
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: httpbin
  backend:
    auth:
      passthrough: {}
```

> [!NOTE]
> On a route with no JWT authentication policy, `passthrough` sends nothing, because no validated token exists for the gateway to re-add. If the route has an API key or a basic auth policy instead, that credential is stripped and `passthrough` does not restore it.

The `passthrough` method has no field for where to read the credential from, because the gateway does not read it from the request at all. It re-sends the token that the JWT authentication policy already validated. The source is therefore wherever that policy's own `location` field reads from, which is the `Authorization` header by default.

The `location` field on `passthrough` controls only where the gateway writes the token on the backend request. That location does not have to be where the client sent it. To read a JWT from the `Authorization` header and forward it as an `x-forwarded-token` header, set `location` to that header.

> [!NOTE]
> Prefer `passthrough` over the `preserveToken` field of the [JWT authentication]({{< link-hextra path="/security/jwt/setup/" >}}) policy. Both get the token to the backend. However, `preserveToken` leaves the token in its original location, where every policy that runs later can read it. The `passthrough` method re-adds the token only on the request that the gateway forwards to the backend.

## Send more than one credential

Use the `credentials` list when a backend wants two credentials on the same request, such as a bearer token and a subscription key. The list does not replace the methods in the previous sections, and it is not how you choose one of them. The list is additive. Each entry names a Secret and a location, and the gateway sends every entry in it. If the policy also sets a primary method, the gateway sends that credential too.

The following example keeps `secretRef` as the primary credential and adds two more credentials from a second Secret. The primary credential still goes to the `Authorization` header. Each entry in the list carries its own location, and the policy-level `location` field does not apply to the list.

1. Create a Secret with two more credentials in it.

   ```sh {paths="backend-authn-key"}
   kubectl create secret generic extra-credentials \
     --namespace httpbin \
     --from-literal=tenant-key="my-tenant-key" \
     --from-literal=subscription-key="my-subscription-key"
   ```

2. Update the policy to send all three credentials.

   ```yaml {paths="backend-authn-key"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: static-backend-auth
     namespace: httpbin
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: httpbin
     backend:
       auth:
         secretRef:
           name: backend-api-key
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
   EOF
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   | Field | Description |
   | -- | -- |
   | `credentials[].location` | Required location that the gateway writes this credential to. Set exactly one of `header`, `queryParameter`, or `cookie`. Each entry carries its own location, and the policy-level `location` field does not apply to the list. |
   | `credentials[].secretRef.name` | Required name of a Secret in the same namespace as the policy. |
   | `credentials[].secretRef.key` | Key in the Secret that holds the credential. Defaults to `Authorization`, so set it for every entry that reads a Secret with more than one key in it. Unlike the primary `secretRef`, an entry in the list never strips a `Bearer ` prefix from the value, whichever key it reads. |

3. Send a request to the httpbin `/get` endpoint, which reflects the query string as well as the headers.

   ```sh {paths="backend-authn-key"}
   curl -s "http://$INGRESS_GW_ADDRESS:80/get" -H "host: www.example.com" | jq '{headers, args}'
   ```

   The backend receives the primary credential in the `Authorization` header, one extra credential as a header, and the other as a query parameter.

   ```
   {
     "headers": {
       "Authorization": [
         "Bearer my-backend-token"
       ],
       "X-Tenant-Key": [
         "my-tenant-key"
       ],
       ...
     },
     "args": {
       "subscription": [
         "my-subscription-key"
       ]
     }
   }
   ```

The `credentials` list also works on its own, or alongside any other primary method. Omit `secretRef` and the gateway sends only the entries in the list. Set `passthrough` instead and the gateway forwards the client's JWT alongside them.

{{< doc-test paths="backend-authn-key" >}}
# WHAT THIS TEST VALIDATES:
#   * credentials is additive: the primary secretRef credential and both list entries all arrive,
#     across two different location types (header and query parameter).
for i in $(seq 1 60); do
  curl -s --max-time 5 "http://${INGRESS_GW_ADDRESS}:80/get" -H "host: www.example.com" > key-credentials.json || true
  grep -q 'my-subscription-key' key-credentials.json && break
  sleep 2
done
python3 -c '
import json
d=json.load(open("key-credentials.json"))
h={k.lower():v for k,v in d["headers"].items()}
one=lambda v: v[0] if isinstance(v,list) else v
assert one(h.get("authorization"))=="Bearer my-backend-token", h.get("authorization")
assert one(h.get("x-tenant-key"))=="my-tenant-key", h.get("x-tenant-key")
assert one(d["args"].get("subscription"))=="my-subscription-key", d["args"]
print("additive credentials verified")'
{{< /doc-test >}}

## Troubleshoot

| Symptom | Cause |
| -- | -- |
| The backend receives no credential, and the policy reports `Attached=False` with `Policy is not attached`. | The policy targets an {{< reuse "agw-docs/snippets/backend.md" >}} that no route forwards to. Point the `backendRefs` entry of the HTTPRoute at the {{< reuse "agw-docs/snippets/backend.md" >}}, or target the HTTPRoute instead. |
| The backend receives `Bearer Bearer <token>`. | The Secret value carries a `Bearer ` prefix, and `secretRef.key` names a key other than `Authorization`. The gateway strips the prefix only from the default key. Store the bare token. |
| The API server rejects the policy with `location may only be set for key, secretRef, or passthrough auth`. | The policy sets `location` next to a cloud method or a token exchange method. Those methods carry their own location field, or write to a fixed location. |
| The API server rejects the policy with `at most one of the fields in [key secretRef passthrough ...] may be set`. | The policy sets two primary methods. Only the `credentials` list can be combined with a primary method. |

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="backend-authn-key"}
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} static-backend-auth -n httpbin
kubectl delete secret backend-api-key extra-credentials -n httpbin
```
