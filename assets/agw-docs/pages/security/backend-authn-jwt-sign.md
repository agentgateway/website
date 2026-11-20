## About

Some upstreams do not accept a durable credential at all. The Snowflake SQL API, for example, requires a JWT that is signed with the caller's private key on each call. The `key` and `secretRef` backend authentication methods cannot serve those upstreams, because they forward a static credential.

With the `jwtSign` backend authentication method, the gateway mints the token itself. It reads a PEM-encoded private key from a Kubernetes Secret, signs a JWT that carries the claims that you configure, and writes that token to each request that it forwards to the backend. Nothing is cached, so every request is signed afresh.

> [!NOTE]
> The `jwtSign` method is not the same as the `clientAuth.privateKeyJwt` setting on [Cross App Access]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/cross-app-access/" >}}). The two share the signing implementation, but `privateKeyJwt` authenticates the gateway to an OAuth token endpoint, and `jwtSign` sends a signed JWT to the backend itself.

Two behaviors are worth knowing before you configure the method:

* **The signer (gateway) owns the time claims.** The gateway always sets `iat` and `exp`, and rejects a policy that tries to configure `iat`, `exp`, or `nbf`. It backdates `iat` by 10 seconds, so that a validator whose clock trails the gateway still accepts a freshly minted token. A decoded token therefore spans the `ttl` plus 10 seconds, and never carries an `nbf` claim.
* **The token overwrites only what sits at its location.** By default, the gateway writes the `Authorization` header, replacing any credential that the client sent there. If you point `location` at a different header, query parameter, or cookie, the client's `Authorization` header is forwarded to the backend untouched. Remove it with a request filter if the upstream must not see it.


## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

## Create the signing key Secret

The gateway reads the private key from the `signingKey` entry of a Secret in the policy's namespace. The key must be a PEM-encoded RSA or EC private key that matches the algorithm that you configure.

1. Generate a private key that you use for the signing process. An EC P-256 key is the smallest option, and pairs with the `ES256` algorithm.

   ```sh
   openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out signing-key.pem
   ```

   To use the default `RS256` algorithm instead, generate an RSA key.

   ```sh
   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out signing-key.pem
   ```

2. Store the key in a Secret in the same namespace as the policy, under the `signingKey` data key.

   ```sh
   kubectl create secret generic jwt-signing-key \
     --namespace httpbin \
     --from-file=signingKey=signing-key.pem
   ```

## Configure jwtSign backend authentication

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that targets the httpbin route and signs every request that the gateway forwards to the backend. The claim values in this example follow the shape that the Snowflake SQL API expects. Replace them with the claims that your upstream requires.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: jwt-sign-backend-auth
     namespace: httpbin
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: httpbin
     backend:
       auth:
         jwtSign:
           signingKeyRef:
             name: jwt-signing-key
           alg: ES256
           kid: my-signing-key
           claims:
             iss: MYACCOUNT.MYUSER.SHA256:my-public-key-fingerprint
             sub: MYACCOUNT.MYUSER
             aud: https://myaccount.snowflakecomputing.com
           ttl: 60s
   EOF
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}} For more information, see the [API docs]({{< link-hextra path="/reference/api/#jwtsignauth" >}}).

   | Field | Description |
   | -- | -- |
   | `signingKeyRef` | Required Secret in the policy's namespace that holds the PEM-encoded RSA or EC private key under the `signingKey` data key. |
   | `alg` | JWS signing algorithm: `RS256` (default), `RS384`, `RS512`, `PS256`, `ES256`, or `ES384`. The algorithm must match the key family. The `RS` and `PS` algorithms need an RSA key, and the `ES` algorithms need an EC key. |
   | `kid` | Optional `kid` header that the gateway stamps on every token. Omit the field and the gateway writes no `kid` header. |
   | `claims` | Optional static claims that the gateway copies into every token, such as `iss`, `sub`, and `aud`. A value can be any JSON value, including a number or an array. The `iat`, `exp`, and `nbf` claims are reserved for the signer, and the controller rejects them. |
   | `ttl` | Optional token lifetime that the gateway uses for `exp`. Defaults to `300s`. |
   | `location` | Optional location that the gateway writes the signed token to. Defaults to the `Authorization` header with a `Bearer` prefix. Set exactly one of `header`, `queryParameter`, or `cookie` to change it. At a custom location, the gateway writes the bare token with no `Bearer` prefix. |

## Verify that requests are signed

1. Send a request through the gateway to the httpbin `/headers` endpoint, which reflects the headers that the backend received. Because the gateway writes the token to the `Authorization` header, the command decodes that header to show the protected header and the payload of the token that the backend received.

   ```sh
   curl -s "http://$INGRESS_GW_ADDRESS:80/headers" -H "host: www.example.com" | python3 -c '
   import sys,json,base64
   h=json.load(sys.stdin)["headers"]
   tok=(h.get("Authorization") or h.get("authorization"))
   tok=(tok[0] if isinstance(tok,list) else tok).split()[1]
   seg=lambda i: json.loads(base64.urlsafe_b64decode(tok.split(".")[i]+"=="))
   print(json.dumps(seg(0)))
   print(json.dumps(seg(1)))
   print("exp - iat:", seg(1)["exp"] - seg(1)["iat"])'
   ```

   In the example output, the protected header carries the configured algorithm and key ID, and the payload carries your claims plus the timestamps of the signer. The difference between `exp` and `iat` is 70 seconds, which is the 60-second `ttl` plus the 10-second backdate, and the payload carries no `nbf` claim.

   ```
   {"typ": "JWT", "alg": "ES256", "kid": "my-signing-key"}
   {"aud": "https://myaccount.snowflakecomputing.com", "iss": "MYACCOUNT.MYUSER.SHA256:my-public-key-fingerprint", "sub": "MYACCOUNT.MYUSER", "iat": 1786485823, "exp": 1786485893}
   exp - iat: 70
   ```

2. Confirm that the gateway caches nothing. Send two requests a second or more apart, and compare the tokens. The gateway signs each request afresh, so the tokens and their `iat` values differ.

   ```sh
   curl -s "http://$INGRESS_GW_ADDRESS:80/headers" -H "host: www.example.com" | python3 -c 'import sys,json; print(json.load(sys.stdin)["headers"]["Authorization"][0])'
   sleep 2
   curl -s "http://$INGRESS_GW_ADDRESS:80/headers" -H "host: www.example.com" | python3 -c 'import sys,json; print(json.load(sys.stdin)["headers"]["Authorization"][0])'
   ```

## Troubleshoot

A `jwtSign` policy that the gateway cannot use fails closed. The gateway rejects every request on the route instead of forwarding an unsigned one. Requests return a `500` with a general message, which deliberately does not name the credential that the gateway could not resolve.

{{< version include-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
```
backend authentication failed: jwtSign configuration is invalid
```
{{< /version >}}
{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
```
backend authentication failed
```

The proxy logs record the cause, such as `jwtSign configuration is invalid`.
{{< /version >}}

Check the policy status first. The controller reports the problems that it can see on the `Accepted` condition, which stays `True` with the reason `PartiallyValid`.

```sh
kubectl get {{< reuse "agw-docs/snippets/policy.md" >}} jwt-sign-backend-auth -n httpbin \
  -o jsonpath='{.status.ancestors[0].conditions[?(@.type=="Accepted")].message}'
```

| Status message | Cause |
| -- | -- |
| `failed to resolve jwtSign signing secret <namespace>/<name>` | The Secret that `signingKeyRef` names does not exist in the policy's namespace. |
| `secret <namespace>/<name> missing signingKey value` | The Secret exists, but it has no `signingKey` data key. A key that is stored under any other name, such as `privateKey`, produces this message. |
| `jwtSign claim "iat" is reserved for the signer and cannot be configured` | A reserved claim (`iat`, `exp`, or `nbf`) is set under `claims`. The API server accepts the policy, because the `claims` map is opaque to CRD validation, and the controller rejects it afterwards. |

<!-- TODO troubleshooting

> [!WARNING]
> One failure does not appear in the policy status at all. The controller passes the private key to the gateway without parsing it, so the controller cannot detect an `alg` that disagrees with the key family. A policy that asks for `RS256` while it points at an EC key reports itself completely healthy, with the reason `Valid` and the message `Policy accepted`, while every request on the route returns the `500` that is shown earlier. If `jwtSign` fails on a policy that reads as valid, check `alg` against the key type before anything else.
-->

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} jwt-sign-backend-auth -n httpbin
kubectl delete secret jwt-signing-key -n httpbin
```
