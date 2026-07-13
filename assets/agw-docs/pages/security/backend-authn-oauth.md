Exchange the incoming request's credential for a per-backend token at an OAuth authorization server before forwarding the request, by using an {{< reuse "agw-docs/snippets/policy.md" >}} with the `oauthTokenExchange` backend authentication method.

## About

Instead of attaching a fixed credential to backend requests, the `oauthTokenExchange` method exchanges the incoming request's credential for a new, backend-specific token at an OAuth authorization server, then forwards that token to the backend. Token exchange is useful when a client authenticates to the gateway with one identity, but the backend requires a different, narrowly scoped token.

Because the gateway performs the exchange, backend credentials are injected by the infrastructure and are never exposed to the AI models or agents that send requests through the gateway. The user's identity is preserved end-to-end, and the exchange can optionally carry an agent identity acting on behalf of the user, which keeps a consistent identity chain for auditing.

### Grant types

The method supports two grants:

| Grant | `grantType` | Standard | The incoming credential is sent as |
| -- | -- | -- | -- |
| Token exchange (default) | `TokenExchange` | [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693) | `subject_token` |
| JWT bearer | `JwtBearer` | [RFC 7523](https://datatracker.ietf.org/doc/html/rfc7523) | `assertion` |

Both grants are configured on the same policy. You choose the grant with the `grantType` field, as shown in the [Configure token exchange](#configure-token-exchange) tabs. Validation of the incoming credential is the job of a route-level policy, such as [JWT authentication]({{< link-hextra path="/security/jwt/" >}}), not the exchange itself.

### Configuration

In Kubernetes mode, the token endpoint (authorization server) is configured as its own {{< reuse "agw-docs/snippets/backend.md" >}}, which the {{< reuse "agw-docs/snippets/policy.md" >}} then references through `tokenEndpoint`. The gateway's OAuth client secret is read from a Kubernetes Secret through `clientAuth.secretRef`. The policy attaches to the backend workload with `targetRefs`, so the exchange runs whenever the gateway forwards a request to that backend.

The following guide walks through a complete, reproducible example: it deploys a Keycloak authorization server into your cluster, attaches an `oauthTokenExchange` policy to the httpbin sample app, and verifies that the token forwarded to httpbin is the exchanged token rather than the one the client sent.

## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

## Deploy Keycloak

Deploy a Keycloak authorization server into your cluster to act as the token endpoint. This example uses the same pre-seeded `backend-oauth` realm as the [standalone token exchange guide]({{< link-hextra path="/configuration/security/backend-authn/oauth-token-exchange/" >}}): it has an `initial-client` that mints the user's inbound token, a confidential `requester-client` (the gateway's client, with token exchange enabled), a `target-client` audience, and a `testuser` / `testpass` user.

{{% steps %}}

### Step 1: Import the realm

1. Download the realm definition and load it into a ConfigMap in the `httpbin` namespace, alongside the sample app.

   ```sh
   curl -sL https://agentgateway.dev/examples/traffic-token-exchange/oauth-rfc8693/backend-oauth-realm.json -o backend-oauth-realm.json

   kubectl create configmap backend-oauth-realm -n httpbin --from-file=backend-oauth-realm.json
   ```

### Step 2: Deploy Keycloak

1. Deploy Keycloak and its Service into the `httpbin` namespace. The `KC_HOSTNAME` variable pins the token issuer to the in-cluster DNS name, so that tokens minted through a port-forward and the gateway's token-exchange call agree on the issuer (`iss`). Without this, Keycloak rejects the `subject_token` with an issuer mismatch.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: keycloak
     namespace: httpbin
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: keycloak
     template:
       metadata:
         labels:
           app: keycloak
       spec:
         containers:
         - name: keycloak
           image: quay.io/keycloak/keycloak:26.3
           args: ["start-dev", "--import-realm", "--http-port=8080"]
           env:
           - name: KEYCLOAK_ADMIN
             value: admin
           - name: KEYCLOAK_ADMIN_PASSWORD
             value: admin
           - name: KC_HOSTNAME
             value: "http://keycloak.httpbin.svc.cluster.local:8080"
           - name: KC_HOSTNAME_STRICT
             value: "false"
           - name: KC_HOSTNAME_BACKCHANNEL_DYNAMIC
             value: "false"
           ports:
           - containerPort: 8080
           volumeMounts:
           - name: realm
             mountPath: /opt/keycloak/data/import
             readOnly: true
         volumes:
         - name: realm
           configMap:
             name: backend-oauth-realm
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: keycloak
     namespace: httpbin
   spec:
     selector:
       app: keycloak
     ports:
     - name: http
       port: 8080
       targetPort: 8080
   EOF
   ```

2. Wait for Keycloak to be ready.

   ```sh
   kubectl rollout status deployment/keycloak -n httpbin --timeout=180s
   ```

{{% /steps %}}

## Configure token exchange

{{% steps %}}

### Step 1: Create the token endpoint backend

Create an {{< reuse "agw-docs/snippets/backend.md" >}} for the token endpoint, pointing at the in-cluster Keycloak Service. Because Keycloak serves plain HTTP on port `8080` in this example, no backend TLS is configured. For an external authorization server on port `443`, backend TLS is enabled automatically.

```yaml
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: keycloak-token-endpoint
  namespace: httpbin
spec:
  static:
    host: keycloak.httpbin.svc.cluster.local
    port: 8080
EOF
```

### Step 2: Create the client secret

Create a Kubernetes Secret with the gateway client's secret. This matches the `requester-client` secret from the imported realm.

```yaml
kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: oauth-client
  namespace: httpbin
type: Opaque
stringData:
  clientSecret: requester-secret
EOF
```

### Step 3: Attach the token exchange policy

Create an {{< reuse "agw-docs/snippets/policy.md" >}} that attaches the `oauthTokenExchange` method to the `httpbin` Service. The `tokenEndpoint` field references the {{< reuse "agw-docs/snippets/backend.md" >}} from Step 1, and `path` sets the token endpoint path.

Choose the tab for the grant you want. All three tabs define the *same single policy* with a different `grantType` (and, for Entra, different client authentication and parameters). The [verification steps](#verify-the-exchange) that follow use the default **RFC 8693** grant against the local Keycloak.

{{< tabs >}}
{{% tab name="RFC 8693 (default)" %}}

The default token exchange grant sends the incoming credential as the `subject_token`.

```yaml
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: backend-token-exchange
  namespace: httpbin
spec:
  targetRefs:
  - group: ""
    kind: Service
    name: httpbin
  backend:
    auth:
      oauthTokenExchange:
        tokenEndpoint:
          group: agentgateway.dev
          kind: {{< reuse "agw-docs/snippets/backend.md" >}}
          name: keycloak-token-endpoint
          path: /realms/backend-oauth/protocol/openid-connect/token
        grantType: TokenExchange
        audiences:
        - target-client
        clientAuth:
          clientId: requester-client
          method: ClientSecretBasic
          secretRef:
            name: oauth-client
EOF
```

{{% /tab %}}
{{% tab name="JWT bearer" %}}

The RFC 7523 JWT bearer grant sends the incoming credential as the `assertion` instead of the `subject_token`. Set `grantType: JwtBearer`; the rest of the policy is the same.

```yaml
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: backend-token-exchange
  namespace: httpbin
spec:
  targetRefs:
  - group: ""
    kind: Service
    name: httpbin
  backend:
    auth:
      oauthTokenExchange:
        tokenEndpoint:
          group: agentgateway.dev
          kind: {{< reuse "agw-docs/snippets/backend.md" >}}
          name: keycloak-token-endpoint
          path: /realms/backend-oauth/protocol/openid-connect/token
        grantType: JwtBearer
        audiences:
        - target-client
        clientAuth:
          clientId: requester-client
          method: ClientSecretBasic
          secretRef:
            name: oauth-client
EOF
```

{{< callout type="info" >}}
The imported `backend-oauth` realm is configured for the RFC 8693 grant. To run the JWT bearer grant end to end, use an authorization server and client configured for RFC 7523.
{{< /callout >}}

{{% /tab %}}
{{% tab name="Microsoft Entra OBO" %}}

The [Microsoft Entra on-behalf-of (OBO)](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-on-behalf-of-flow) flow is a vendor-specific variant of the JWT bearer grant. Point the token endpoint at your Entra tenant, use `ClientSecretPost` client authentication, and add the `requested_token_use=on_behalf_of` parameter through `additionalParams`. Values in `additionalParams` are CEL expressions, so the literal string is quoted.

```yaml
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: backend-token-exchange
  namespace: httpbin
spec:
  targetRefs:
  - group: ""
    kind: Service
    name: httpbin
  backend:
    auth:
      oauthTokenExchange:
        tokenEndpoint:
          group: agentgateway.dev
          kind: {{< reuse "agw-docs/snippets/backend.md" >}}
          name: entra-token-endpoint
          path: /<TENANT_ID>/oauth2/v2.0/token
        grantType: JwtBearer
        clientAuth:
          clientId: <CLIENT_ID>
          method: ClientSecretPost
          secretRef:
            name: oauth-client
        scopes:
        - https://graph.microsoft.com/.default
        additionalParams:
          requested_token_use: '"on_behalf_of"'
EOF
```

{{% /tab %}}
{{< /tabs >}}

{{% /steps %}}

The following table describes the most common `oauthTokenExchange` fields.

| Field | Description |
| -- | -- |
| `tokenEndpoint` | Reference to the {{< reuse "agw-docs/snippets/backend.md" >}} for the token endpoint, with an optional `path`. |
| `tokenEndpointPath` | Path of the token endpoint. Alternative to `tokenEndpoint.path`. Defaults to `/`. |
| `grantType` | `TokenExchange` (default, RFC 8693) or `JwtBearer` (RFC 7523). |
| `clientAuth` | Client authentication for the token endpoint. `method` is `ClientSecretBasic` (default), `ClientSecretPost`, or `PrivateKeyJwt`. Use `secretRef` to read the client secret from a Kubernetes Secret. |
| `audiences`, `scopes`, `resources` | The `audience`, `scope`, and `resource` parameters sent to the token endpoint. `resources` are [RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707) resource indicators. |
| `subjectToken` | Where to read the incoming credential and its `tokenType` (`AccessToken`, `Jwt`, and so on). Defaults to the `Authorization: Bearer` header. |
| `actorToken` | Optional RFC 8693 delegation actor token (`TokenExchange` grant only). |
| `location` | Where to place the exchanged token in the backend request. Defaults to the `Authorization` header. |
| `additionalParams` | Extra form parameters appended to the token request. Values are CEL expressions. |
| `cache` | In-memory token cache. Defaults to 8192 entries. Set `inMemory.maxEntries: 0` to disable. |

## Verify the exchange

{{% steps %}}

### Step 1: Mint an inbound token

1. Port-forward the Keycloak Service so that you can reach its token endpoint locally.

   ```sh
   kubectl port-forward -n httpbin svc/keycloak 8080:8080
   ```

2. In another terminal, mint a user token from Keycloak as `initial-client`, and save it as the inbound credential. Tokens expire, so re-mint if you come back later.

   ```sh
   export SUBJECT_TOKEN="$(curl -s http://localhost:8080/realms/backend-oauth/protocol/openid-connect/token \
     -u initial-client:initial-secret -d grant_type=password \
     -d username=testuser -d password=testpass | jq -r .access_token)"
   echo $SUBJECT_TOKEN
   ```

### Step 2: Send a request through the gateway

1. Send a request to the httpbin `/headers` endpoint through the gateway, with the inbound token. The gateway exchanges the token at Keycloak and forwards the request to httpbin with the *exchanged* token. Because httpbin reflects the request headers, you can see the token that the gateway forwarded.

   ```sh
   curl -s http://$INGRESS_GW_ADDRESS:80/headers \
     -H "host: www.example.com" \
     -H "authorization: Bearer $SUBJECT_TOKEN"
   ```

   In the response, note that the `Authorization` header reflected by httpbin contains a *different* token than the one you sent.

2. Copy the forwarded token from the `Authorization` header in the response, and save it to an environment variable.

   ```sh
   export FORWARDED_TOKEN=eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUI...
   ```

3. Decode the token's payload to confirm the exchange.

   ```sh
   echo "$FORWARDED_TOKEN" | cut -d. -f2 | jq -R 'gsub("-";"+") | gsub("_";"/") | . + ("=" * ((4 - (length % 4)) % 4)) | @base64d | fromjson'
   ```

   The decoded token was issued for the target audience (`aud`), and its authorized party (`azp`) is the gateway's client (`requester-client`), not the original `initial-client`.

   ```json
   {
     "iss": "http://keycloak.httpbin.svc.cluster.local:8080/realms/backend-oauth",
     "aud": "target-client",
     "azp": "requester-client",
     "sub": "4f5b414b-1f66-4251-ae2c-fc7f488ab141"
   }
   ```

{{% /steps %}}

<!--

## Troubleshooting

### subject_token validation failure

**What's happening:**

The token endpoint returns an `invalid_token` or `invalid_request` error, and the gateway responds with `HTTP 400`. The authorization server logs a `subject_token validation failure`.

**Why it's happening:**

The authorization server cannot validate the incoming credential, often because the credential's issuer (`iss`) does not match the issuer that the authorization server expects when the gateway reaches it. With Keycloak, this happens when the token is minted through one hostname (for example, a port-forward) but the gateway calls the token endpoint through a different in-cluster hostname.

**How to fix it:**

Make sure the incoming credential's issuer matches the token endpoint's issuer as the gateway reaches it. For Keycloak in a cluster, pin the issuer with the `KC_HOSTNAME` environment variable so it is stable regardless of how Keycloak is reached.

-->

## Cleanup

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} backend-token-exchange -n httpbin
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} keycloak-token-endpoint -n httpbin
kubectl delete secret oauth-client -n httpbin
kubectl delete deployment keycloak -n httpbin
kubectl delete service keycloak -n httpbin
kubectl delete configmap backend-oauth-realm -n httpbin
```
