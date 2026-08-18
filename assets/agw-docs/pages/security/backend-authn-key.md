Send a static credential to a backend, forward the credential that the client sent, or add a second credential alongside either one.

## About

Three of the backend authentication methods send a credential that the gateway does not have to fetch from anywhere.

* **`secretRef`** reads a static credential from a Kubernetes Secret. Use this method for an API key or a long-lived token.
* **`key`** holds the credential inline in the resource. The value is stored in plain text in the cluster and in any Git repository that tracks the resource, so use `secretRef` instead wherever you can.
* **`passthrough`** forwards the credential that the client sent. Use this method when the backend validates the same credential that the gateway validated.

All three write the credential to the `Authorization` header with a `Bearer ` prefix by default. The `location` field changes where the credential goes.

The `credentials` list is separate. It adds credentials rather than choosing one, so you can send a second or third credential on the same request.

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

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   | Field | Description |
   | -- | -- |
   | `secretRef.name` | Required name of a Secret in the same namespace as the policy. |
   | `secretRef.key` | Key in the Secret that holds the credential. Defaults to `Authorization`. |
   | `secretRef.group` and `secretRef.kind` | Credential source other than a Secret. Omit both to use a Secret. Set both together, because setting one alone is rejected. |
   | `location` | Where the gateway writes the credential. Defaults to the `Authorization` header with a `Bearer ` prefix. Set exactly one of `header`, `queryParameter`, or `cookie`. |

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
> Store the bare token in the Secret. The gateway strips a `Bearer ` prefix only from the default `Authorization` key, so a value of `Bearer my-backend-token` under that key still arrives as `Bearer my-backend-token`. Under any other key, the prefix is not stripped, and the same value arrives as `Bearer Bearer my-backend-token`.

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

## Change where the credential goes

Set `location` to write the credential somewhere other than the `Authorization` header. The field is a sibling of `key`, `secretRef`, and `passthrough`, not a field inside them, and it applies to those three methods only.

1. Update the policy to send the credential as an `x-api-key` header instead. The example also reads a different Secret key, to show that the two settings are independent.

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

## Forward the credential that the client sent

The `passthrough` method sends the client credential on to the backend. It exists because the client authentication policies remove the credential that they validate: a [JWT]({{< link-hextra path="/security/jwt/" >}}) or [API key]({{< link-hextra path="/security/apikey/" >}}) policy strips the credential before the gateway forwards the request. The `passthrough` method adds it back.

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
> On a route with no client authentication policy, `passthrough` does nothing. Nothing removed the client credential, so it reaches the backend whether the method is set or not.

The `location` field controls where the gateway writes the forwarded credential, which does not have to be where the client sent it. To read a JWT from the `Authorization` header and forward it as an `x-forwarded-token` header, set `location` to that header.

## Send more than one credential

Each entry in the `credentials` list names a Secret and a location. The list is additive, so the gateway sends every entry in it, plus the primary credential if a policy sets one.

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
   | `credentials[].secretRef.key` | Key in the Secret that holds the credential. Defaults to `Authorization`, so set it for every entry that reads a Secret with more than one key in it. |

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

The `credentials` list also works with no primary method. Omit `secretRef` and the gateway sends only the entries in the list.

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
