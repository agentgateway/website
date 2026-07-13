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

Validation of the incoming credential is the job of a route-level policy, such as [JWT authentication]({{< link-hextra path="/security/jwt/" >}}), not the exchange itself.

### Configuration

In Kubernetes mode, agentgateway configures the token endpoint (authorization server) in its own {{< reuse "agw-docs/snippets/backend.md" >}}, which an {{< reuse "agw-docs/snippets/backend.md" >}} can then reference. The client secret is read from a Kubernetes Secret through `clientAuth.secretRef`.

## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

4. Have an OAuth authorization server that supports token exchange (such as Keycloak, Microsoft Entra ID, Okta, Auth0, or ZITADEL), and an OAuth client registered for the gateway.

## Configure token exchange

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} for the token endpoint (the authorization server). A `port` of `443` automatically enables backend TLS.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: token-endpoint
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     static:
       host: keycloak.example.com
       port: 443
   EOF
   ```

2. Create a Kubernetes Secret with the gateway's OAuth client secret.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: oauth-client
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     clientSecret: my-client-secret
   EOF
   ```

3. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that attaches the `oauthTokenExchange` method to your backend. The `tokenEndpoint` field references the {{< reuse "agw-docs/snippets/backend.md" >}} from step 1, and `tokenEndpointPath` (or the `path` on the reference) sets the token endpoint path.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: backend-token-exchange
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: ""
       kind: Service
       name: my-backend
     backend:
       auth:
         oauthTokenExchange:
           tokenEndpoint:
             group: agentgateway.dev
             kind: {{< reuse "agw-docs/snippets/backend.md" >}}
             name: token-endpoint
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

## JWT bearer grant

To use the RFC 7523 JWT bearer grant, set `grantType: JwtBearer`. The incoming credential is sent as the `assertion` instead of the `subject_token`. This grant is also the shape used by the Microsoft Entra on-behalf-of flow, in which case you set `method: ClientSecretPost` and add the vendor-specific `requested_token_use` parameter through `additionalParams`.

```yaml
backend:
  auth:
    oauthTokenExchange:
      tokenEndpoint:
        group: agentgateway.dev
        kind: {{< reuse "agw-docs/snippets/backend.md" >}}
        name: token-endpoint
        path: /<TENANT_ID>/oauth2/v2.0/token
      grantType: JwtBearer
      clientAuth:
        clientId: my-client-id
        method: ClientSecretPost
        secretRef:
          name: oauth-client
      scopes:
      - https://graph.microsoft.com/.default
      additionalParams:
        requested_token_use: '"on_behalf_of"'
```

## Verify the exchange

1. Send a request to the gateway with an incoming credential. The gateway exchanges the credential and forwards the request to the backend with the exchanged token.

   ```sh
   curl -s http://$GATEWAY_ADDRESS/exchange -H "authorization: Bearer $SUBJECT_TOKEN"
   ```

2. Confirm that the token forwarded to the backend is the exchanged token, not the one you sent. For example, decoding the forwarded token from a Keycloak exchange shows the token was issued for the target audience (`aud`), and its authorized party (`azp`) is the gateway's client, not the original client:

   ```console
   {
     "iss": "http://keycloak.example.com/realms/backend-oauth",
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

## Cleanup

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} backend-token-exchange -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} token-endpoint -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete secret oauth-client -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
