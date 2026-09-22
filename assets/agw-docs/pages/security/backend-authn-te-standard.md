Exchange the caller's credential for a backend-scoped token with the [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693) token exchange grant, configured on an {{< reuse "agw-docs/snippets/policy.md" >}}.

## About

The `TokenExchange` grant is the default grant of the `oauthTokenExchange` backend authentication method. The gateway sends the incoming credential to the authorization server as the `subject_token` and forwards the token that comes back to the backend.

For the JWT bearer grant, which sends the credential as an `assertion` instead, see [JWT bearer grant]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/jwt-bearer/" >}}). For an exchange that crosses a trust boundary between two authorization servers, see [Cross App Access]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/cross-app-access/" >}}).

## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

## Deploy Keycloak

{{< reuse "agw-docs/snippets/keycloak-token-exchange.md" >}}

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


3. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that attaches the `oauthTokenExchange` method to the `httpbin` Service. The `backendRef` field references the {{< reuse "agw-docs/snippets/backend.md" >}}, `path` sets the token endpoint path, and `grantType` selects the RFC 8693 exchange.

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
           backendRef:
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

   {{< reuse "agw-docs/snippets/oauth-token-exchange-fields.md" >}}

## Verify the exchange

Mint an inbound credential, send a request through agentgateway with it, and verify that the forwarded token was exchanged: it is issued for the `target-client` audience with `requester-client` as the authorized party (`azp`), not the client that minted the inbound credential.

1. Port-forward the Keycloak Service so that you can reach its token endpoint locally.

   ```sh
   kubectl port-forward -n httpbin svc/keycloak 8080:8080
   ```

2. In another terminal, mint the inbound credential. Mint a user token from the `backend-oauth` realm as `initial-client`; the gateway sends this as the `subject_token`. Tokens expire, so re-mint if you come back later.

   ```sh
   export INBOUND_TOKEN="$(curl -s http://localhost:8080/realms/backend-oauth/protocol/openid-connect/token \
     -u initial-client:initial-secret -d grant_type=password \
     -d username=testuser -d password=testpass | jq -r .access_token)"
   echo $INBOUND_TOKEN
   ```

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

   The decoded token was issued for the target audience (`aud`), and its authorized party (`azp`) is the gateway's client (`requester-client`), not the client that minted the inbound credential. The JWT bearer grant produces the same exchanged token from a different inbound credential.

   ```json
   {
     "iss": "http://keycloak.httpbin.svc.cluster.local:8080/realms/backend-oauth",
     "aud": "target-client",
     "azp": "requester-client",
     "sub": "4f5b414b-1f66-4251-ae2c-fc7f488ab141"
   }
   ```

## Token types {#token-types}

The `subjectToken.tokenType` and `actorToken.tokenType` fields accept a built-in name (`AccessToken`, `Jwt`, or `IdToken`), or any absolute URI without a fragment for an authorization server that defines its own token exchange profile. The gateway expands a built-in name to its `urn:ietf:params:oauth:token-type:*` form, and passes a custom URI through unchanged.

For example, set `subjectToken.tokenType` to the type that your authorization server expects.

```yaml
subjectToken:
  source:
    header:
      name: authorization
      prefix: "Bearer "
  tokenType: "urn:company:domain:human"
```

The gateway sends that value verbatim as the `subject_token_type` form parameter. An `actorToken.tokenType` value travels the same way, as `actor_token_type`.

An invalid value is rejected after you apply the policy, not by the API server. The policy reports `Accepted: True` with the reason `PartiallyValid` and the following message, and the data plane refuses it, so every request on the route fails with a `400` and the message `invalid request`.

```
oauth subjectToken tokenType "not a uri" must be a built-in token type or an absolute URI without a fragment
```

### Request a token type {#requested-token-type}

Unlike the subject and actor token types, `requestedTokenType` is a closed set. Only `AccessToken`, `Jwt`, and `IdToken` can be requested, and the API server rejects the policy otherwise.

| Value | Result |
| -- | -- |
| A custom URI | `Unsupported value: "urn:company:domain:human": supported values: "AccessToken", "Jwt", "IdToken", "IdJag"` |
| `IdJag` | `requestedTokenType IdJag is only supported by crossAppAccess`. The value appears in the list because the type list is shared with [Cross App Access]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/cross-app-access/" >}}). |
| Any value, with the `JwtBearer` grant type | `requestedTokenType is only valid with TokenExchange grantType` |

When you set `requestedTokenType`, the gateway sends `requested_token_type` on the token request, then compares the `issued_token_type` of the response against it. A mismatch fails the exchange with a `500`, and the request never reaches the backend.

```
backend authentication failed: token exchange returned issued_token_type urn:ietf:params:oauth:token-type:jwt, expected urn:ietf:params:oauth:token-type:access_token
```

> [!NOTE]
> When you omit `requestedTokenType`, the gateway sends no `requested_token_type` parameter, and it does not check `issued_token_type` at all. The authorization server chooses the type, and the gateway accepts whatever the response returns. Set the field when the type of the issued token matters to the backend.

### Support for non-compliant providers {#oauth-warnings}

The gateway accepts the following three settings for compatibility with providers that do not accept the standards-compliant forms. Each one logs a warning in the proxy and still forwards traffic. A future release might reject them, so prefer [RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707) resource URIs, valid scope tokens, and header or cookie placement where your provider allows it.

| Setting | Warning in the proxy log |
| -- | -- |
| A `resources` entry that is not an absolute URI without a fragment | `oauth token exchange resource is not an absolute URI without a fragment` |
| A `scopes` entry with characters outside the [RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749) scope-token grammar, such as a space, a quotation mark, a backslash, a control character, or a non-ASCII character | `oauth token exchange scopes contains an invalid OAuth scope-token` |
| `location.queryParameter`, which carries the exchanged token in a URI query parameter | `oauth token exchange is configured to forward the exchanged bearer token in a URI query parameter` |


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

* **Point at your own authorization server.** Create an {{< reuse "agw-docs/snippets/backend.md" >}} for your IdP (such as Keycloak, Microsoft Entra, Okta, Auth0, or ZITADEL). Use port `443` for automatic backend TLS. Replace the demo realm, client IDs, audiences, and Kubernetes Secret with your own.
* **Attach the policy to the backends that need scoped tokens.** Target the {{< reuse "agw-docs/snippets/policy.md" >}} at the Services or {{< reuse "agw-docs/snippets/backend.md" >}}s that require their own credential, such as MCP servers, upstream APIs, or LLM providers. Pair it with route-level [JWT authentication]({{< link-hextra path="/documentation/security/jwt/" >}}) to validate the inbound credential first.
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
