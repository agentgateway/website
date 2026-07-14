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

Deploy a Keycloak authorization server into your cluster to act as the token endpoint. This example imports two realms so that you can exercise both grants:

* `backend-oauth`: The resource realm that performs the exchange. It has an `initial-client` (mints the user's inbound token for the RFC 8693 grant), a confidential `requester-client` (the gateway's client, with token exchange enabled), a `target-client` audience, and `testuser` / `testpass` user credentials.
* `idp`: A separate identity provider realm that issues the `assertion` for the RFC 7523 JWT bearer grant. The `backend-oauth` realm trusts it through a JWT Authorization Grant identity provider.

1. Download the realm definitions and load them into a ConfigMap in the `httpbin` namespace, alongside the sample app. The `sed` command rewrites the issuer host in the import (which is pinned to `localhost:7080` for local Docker use) to the in-cluster Keycloak address, so that the realms trust each other when Keycloak runs in the cluster.

   ```sh
   BASE=https://agentgateway.dev/examples/traffic-token-exchange/jwt-authz-grant/jwtbearer-import
   for realm in backend-oauth-realm idp-realm; do
     curl -sL "$BASE/$realm.json" \
       | sed 's#http://localhost:7080#http://keycloak.httpbin.svc.cluster.local:8080#g' \
       > "$realm.json"
   done

   kubectl create configmap backend-oauth-realm -n httpbin \
     --from-file=backend-oauth-realm.json \
     --from-file=idp-realm.json
   ```

2. Deploy Keycloak and its Service into the `httpbin` namespace. The `--features=preview` flag enables Keycloak's JWT Authorization Grant, which the RFC 7523 JWT bearer grant requires. The `KC_HOSTNAME` variable pins the token issuer to the in-cluster DNS name, so that tokens minted through a port-forward and the gateway's token-exchange call agree on the issuer (`iss`). Without this, Keycloak rejects the token with an issuer mismatch.

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
           image: quay.io/keycloak/keycloak:26.5
           args: ["start-dev", "--import-realm", "--http-port=8080", "--features=preview"]
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

3. Wait for Keycloak to be ready.

   ```sh
   kubectl rollout status deployment/keycloak -n httpbin --timeout=180s
   ```

## Configure token exchange

Configure agentgateway to exchange tokens.

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} for the token endpoint, pointing at the in-cluster Keycloak Service.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
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

2. Create a Kubernetes Secret with the gateway client's secret. This matches the `requester-client` secret from the imported realm.

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

3. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that attaches the `oauthTokenExchange` method to the `httpbin` Service. The `tokenEndpoint` field references the {{< reuse "agw-docs/snippets/backend.md" >}}, and `path` sets the token endpoint path.

   Choose the tab for the grant you want. All three tabs define the same single policy with a different `grantType` (and, for Entra, different client authentication and parameters). The [verification steps](#verify-the-exchange) that follow cover both the **RFC 8693** and **JWT bearer** grants against the local Keycloak.

   {{< tabs >}}
{{% tab name="RFC 8693 (default)" %}}

The default token exchange grant sends the incoming credential as the `subject_token`.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
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
          group: {{< reuse "agw-docs/snippets/group.md" >}}
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

> [!NOTE]
> In this example, the assertion is a token from the `idp` realm, which the `backend-oauth` realm trusts through its JWT Authorization Grant identity provider. [Verify the exchange](#verify-the-exchange) shows how to mint it.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
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
          group: {{< reuse "agw-docs/snippets/group.md" >}}
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

{{% /tab %}}
{{% tab name="Microsoft Entra OBO" %}}

The [Microsoft Entra on-behalf-of (OBO)](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-on-behalf-of-flow) flow is a vendor-specific variant of the JWT bearer grant. Point the token endpoint at your Entra tenant, use `ClientSecretPost` client authentication, and add the `requested_token_use=on_behalf_of` parameter through `additionalParams`. Values in `additionalParams` are CEL expressions, so the literal string is quoted. Make sure to include your Entra `<TENANT_ID>` and `<CLIENT_ID>` values.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
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
          group: {{< reuse "agw-docs/snippets/group.md" >}}
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

   {{< reuse "agw-docs/snippets/review-table.md" >}} For more information, see the [API docs]({{< link-hextra path="/reference/api-kubespec/policies/#spec.backend.auth.oauthTokenExchange" >}}).

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

Mint an inbound credential, send a request through agentgateway with it, and verify that the forwarded token was exchanged: it is issued for the `target-client` audience with `requester-client` as the authorized party (`azp`), not the client that minted the inbound credential.

1. Port-forward the Keycloak Service so that you can reach its token endpoint locally.

   ```sh
   kubectl port-forward -n httpbin svc/keycloak 8080:8080
   ```

2. In another terminal, mint the inbound credential. Use the tab for the grant that you configured. Tokens expire, so re-mint if you come back later.

   {{< tabs >}}
{{% tab name="RFC 8693 (default)" %}}

Mint a user token from the `backend-oauth` realm as `initial-client`. The gateway sends this as the `subject_token`.

```sh
export INBOUND_TOKEN="$(curl -s http://localhost:8080/realms/backend-oauth/protocol/openid-connect/token \
  -u initial-client:initial-secret -d grant_type=password \
  -d username=testuser -d password=testpass | jq -r .access_token)"
echo $INBOUND_TOKEN
```

{{% /tab %}}
{{% tab name="JWT bearer" %}}

Mint a token from the `idp` realm as `idp-app`. The gateway presents this as the RFC 7523 `assertion` to the `backend-oauth` realm, which trusts the `idp` realm.

```sh
export INBOUND_TOKEN="$(curl -s http://localhost:8080/realms/idp/protocol/openid-connect/token \
  -u idp-app:idp-secret -d grant_type=password \
  -d username=idpuser -d password=idppass | jq -r .access_token)"
echo $INBOUND_TOKEN
```

{{% /tab %}}
   {{< /tabs >}}

3. Send a request to the httpbin `/headers` endpoint through the gateway, with the inbound credential. The gateway exchanges the credential at Keycloak and forwards the request to httpbin with the *exchanged* token. Because httpbin reflects the request headers, you can see the token that the gateway forwarded.

   ```sh
   curl -s http://$INGRESS_GW_ADDRESS:80/headers \
     -H "host: www.example.com" \
     -H "authorization: Bearer $INBOUND_TOKEN"
   ```

   In the response, note that the `Authorization` header reflected by httpbin contains a *different* token than the one you sent.

4. Copy the forwarded token from the `Authorization` header in the response, and save it to an environment variable.

   ```sh
   export FORWARDED_TOKEN=eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUI...
   ```

5. Decode the token's payload to confirm the exchange.

   ```sh
   echo "$FORWARDED_TOKEN" | cut -d. -f2 | jq -R 'gsub("-";"+") | gsub("_";"/") | . + ("=" * ((4 - (length % 4)) % 4)) | @base64d | fromjson'
   ```

   The decoded token was issued for the target audience (`aud`), and its authorized party (`azp`) is the gateway's client (`requester-client`), not the client that minted the inbound credential. Both grants produce the same exchanged token.

   ```json
   {
     "iss": "http://keycloak.httpbin.svc.cluster.local:8080/realms/backend-oauth",
     "aud": "target-client",
     "azp": "requester-client",
     "sub": "4f5b414b-1f66-4251-ae2c-fc7f488ab141"
   }
   ```

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

## Next steps

This guide uses a demo Keycloak and the httpbin sample app. To use token exchange in production:

* **Point at your own authorization server.** Create an {{< reuse "agw-docs/snippets/backend.md" >}} for your IdP (such as Keycloak, Microsoft Entra, Okta, Auth0, or ZITADEL). Use port `443` for automatic backend TLS. Replace the demo realm, client IDs, audiences, and Kubernetes Secret with your own. The JWT bearer walkthrough relies on a Keycloak preview feature, so confirm that your provider supports the grant you need (for example, Microsoft Entra on-behalf-of is generally available).
* **Attach the policy to the backends that need scoped tokens.** Target the {{< reuse "agw-docs/snippets/policy.md" >}} at the Services or {{< reuse "agw-docs/snippets/backend.md" >}}s that require their own credential, such as MCP servers, upstream APIs, or LLM providers. Pair it with route-level [JWT authentication]({{< link-hextra path="/security/jwt/" >}}) to validate the inbound credential first.
* **Use token exchange to preserve agent and user identity.** Token exchange lets the gateway hand each backend a narrowly scoped, per-backend token while preserving the caller's identity end-to-end. In agentic flows, the exchange can carry an agent acting on behalf of a user, so every downstream call keeps an auditable, least-privilege identity chain instead of sharing one broad credential.

## Cleanup

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} backend-token-exchange -n httpbin
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} keycloak-token-endpoint -n httpbin
kubectl delete secret oauth-client -n httpbin
kubectl delete deployment keycloak -n httpbin
kubectl delete service keycloak -n httpbin
kubectl delete configmap backend-oauth-realm -n httpbin
```
