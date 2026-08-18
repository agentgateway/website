---
title: OAuth token exchange
weight: 10
description: Exchange the incoming request credential for a per-backend token at an OAuth authorization server before forwarding the request.
test:
  client-auth:
  - path: client-auth
---

Attaches to: {{< badge content="Backend" path="/configuration/backends/" >}}

## About

Instead of attaching a fixed credential to backend requests, the `oauthTokenExchange` backend authentication method exchanges the incoming request's credential for a new, backend-specific token at an OAuth authorization server, then forwards that token to the backend. Token exchange is useful when a client authenticates to the gateway with one identity, but the backend requires a different, narrowly scoped token.

Because the gateway performs the exchange, backend credentials are injected by the infrastructure and are never exposed to the AI models or agents that send requests through the gateway. The user's identity is preserved end-to-end, and the exchange can optionally carry an agent identity acting on behalf of the user (see `actorToken`), which keeps a consistent identity chain for auditing. This is a single-leg exchange, in which the gateway calls one authorization server.

By default, the proxy reads the incoming credential from the `Authorization: Bearer` header, exchanges it at the configured token endpoint, and attaches the returned token to the backend request in the `Authorization: Bearer` header.

Validation of the incoming credential is the job of a route-level policy, such as [JWT authentication]({{< link-hextra path="/configuration/security/jwt-authn/" >}}) or [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn/" >}}), not the exchange itself. The exchange only reads the credential and presents it to the authorization server.

Authorization servers that implement these grants include Keycloak, Microsoft Entra ID, Okta, Auth0, and ZITADEL.

The `oauthTokenExchange` method supports two grants:

| Grant | `grantType` | Standard | The incoming credential is sent as |
| -- | -- | -- | -- |
| Token exchange (default) | `tokenExchange` | [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693) | `subject_token` |
| JWT bearer | `jwtBearer` | [RFC 7523](https://datatracker.ietf.org/doc/html/rfc7523) | `assertion` |

The token endpoint is configured as a backend reference: a `host` in `host:port` form and, optionally, connection `policies` such as `backendTLS`. A `host` port of `443` automatically enables backend TLS.

## Before you begin

The following examples run against local Keycloak stacks from the agentgateway repository. Make sure that you have the following tools installed:

- [agentgateway](https://github.com/agentgateway/agentgateway/releases)
- [Docker](https://docs.docker.com/get-started/get-docker/) and [Docker Compose](https://docs.docker.com/compose/)
- [`jq`](https://jqlang.org/) for reading token responses
- A local clone of the [agentgateway repository](https://github.com/agentgateway/agentgateway), which contains the example stacks:

  ```sh
  git clone https://github.com/agentgateway/agentgateway.git
  cd agentgateway
  ```

## Exchange a token with the RFC 8693 grant

In this example, a user authenticates to Keycloak as one client, and the gateway exchanges that token for a token scoped to a different backend client.

1. Start the example stack. The stack runs Keycloak on port `7080` with the `backend-oauth` realm pre-seeded, and an echo upstream on port `18080` that reflects the request headers it receives.

   ```sh
   docker compose -f examples/traffic-token-exchange/oauth-rfc8693/docker-compose.yaml up -d
   ```

2. Review the gateway configuration. The `oauthTokenExchange` method points at the Keycloak token endpoint, authenticates as the confidential client `requester-client`, and requests a token for `audience=target-client`. Because `grantType` is omitted, the gateway uses the default RFC 8693 token exchange grant. For the full set of fields, see the [configuration reference]({{< link-hextra path="/reference/configuration/" >}}).

   {{% github-yaml url="https://agentgateway.dev/examples/traffic-token-exchange/oauth-rfc8693/config.yaml" %}}

3. Save the configuration to a file and run agentgateway.

   ```sh
   agentgateway -f config.yaml
   ```

4. In another terminal, mint a user token from Keycloak to use as the incoming credential.

   ```sh
   SUBJECT_TOKEN="$(curl -s http://localhost:7080/realms/backend-oauth/protocol/openid-connect/token \
     -u initial-client:initial-secret -d grant_type=password \
     -d username=testuser -d password=testpass | jq -r .access_token)"
   ```

5. Send a request to the gateway with the token. The gateway exchanges the token and forwards the request to the echo upstream, which reflects the headers it received.

   ```sh
   curl -s http://localhost:3000/exchange -H "authorization: Bearer $SUBJECT_TOKEN"
   ```

   In the response, note that the `Authorization` header forwarded to the upstream contains a *different* token than the one you sent.

   ```console
   ...
   URL=/exchange
   Method=GET
   RequestHeader=Authorization:Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUI...
   ...
   ```

6. Copy the forwarded token from the `Authorization` header in the previous response, and save it to an environment variable.

   ```sh
   export FORWARDED_TOKEN=eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUI...
   ```

7. Decode the token's payload to confirm the exchange. This command splits off the JWT payload segment and decodes it with `jq`.

   ```sh
   echo "$FORWARDED_TOKEN" | cut -d. -f2 | jq -R 'gsub("-";"+") | gsub("_";"/") | . + ("=" * ((4 - (length % 4)) % 4)) | @base64d | fromjson'
   ```

   The forwarded token is issued by the `backend-oauth` realm for `aud=target-client`, and its authorized party (`azp`) is the gateway's `requester-client`, not the original `initial-client`.

   ```json
   {
     "exp": 1783970031,
     "iat": 1783969731,
     "jti": "ntrtte:de1c05c3-64bb-999c-80ce-a5f165570c14",
     "iss": "http://localhost:7080/realms/backend-oauth",
     "aud": "target-client",
     "sub": "92e9b475-282b-4ec9-97f3-cc115ab69b70",
     "typ": "Bearer",
     "azp": "requester-client",
     "sid": "17cbdd1f-d8f0-48b8-9c7f-460fda591c69",
     "scope": ""
   }
   ```

8. Stop the gateway and clean up the stack.

   ```sh
   docker compose -f examples/traffic-token-exchange/oauth-rfc8693/docker-compose.yaml down
   ```

## Exchange a token with the RFC 7523 JWT bearer grant

Set `grantType: jwtBearer` to use the RFC 7523 JWT bearer grant, which sends the incoming credential as the `assertion` instead of the `subject_token`. This grant requires the authorization server to trust the issuer that signed the incoming token. The following example uses a two-realm Keycloak stack, where realm `idp` issues the assertion and realm `backend-oauth` trusts it and mints the upstream token.

1. Start the example stack. It runs Keycloak 26.5 with two realms and an echo upstream on port `18080`.

   ```sh
   docker compose -f examples/traffic-token-exchange/jwt-authz-grant/docker-compose.yaml up -d
   ```

2. Review the gateway configuration. The `/jwt-bearer-kc` route runs a full exchange against real Keycloak; the `/jwt-bearer` and `/obo` routes point at a mock token endpoint that logs the exact request the gateway sends. For the full set of fields, see the [configuration reference]({{< link-hextra path="/reference/configuration/" >}}).

   {{% github-yaml url="https://agentgateway.dev/examples/traffic-token-exchange/jwt-authz-grant/config.yaml" %}}

3. Save the configuration to a file and run agentgateway.

   ```sh
   agentgateway -f config.yaml
   ```

4. Mint an assertion from realm `idp`.

   ```sh
   ASSERTION="$(curl -s http://localhost:7080/realms/idp/protocol/openid-connect/token \
     -u idp-app:idp-secret -d grant_type=password \
     -d username=idpuser -d password=idppass | jq -r .access_token)"
   ```

5. Send a request to the `/jwt-bearer-kc` route. The gateway presents the assertion to realm `backend-oauth` with the JWT bearer grant and forwards the minted token upstream.

   ```sh
   curl -s http://localhost:3000/jwt-bearer-kc -H "authorization: Bearer $ASSERTION"
   ```

   In the response, note that the `Authorization` header forwarded to the upstream contains a *different* token than the assertion you sent.

6. Copy the forwarded token from the `Authorization` header in the previous response, and save it to an environment variable.

   ```sh
   export FORWARDED_TOKEN=eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUI...
   ```

7. Decode the token's payload to confirm the exchange. This command splits off the JWT payload segment and decodes it with `jq`.

   ```sh
   echo "$FORWARDED_TOKEN" | cut -d. -f2 | jq -R 'gsub("-";"+") | gsub("_";"/") | . + ("=" * ((4 - (length % 4)) % 4)) | @base64d | fromjson'
   ```

   The assertion was issued by realm `idp`, but the forwarded token is issued by realm `backend-oauth` for `aud=target-client`.

   ```json
   {
     "exp": 1783970287,
     "iat": 1783969987,
     "jti": "trrtag:51429e75-075b-df43-fa76-b3d913d71847",
     "iss": "http://localhost:7080/realms/backend-oauth",
     "aud": "target-client",
     "sub": "e2afe4ff-bf5d-45fb-bf44-9ec346fd0818",
     "typ": "Bearer",
     "azp": "requester-client",
     "scope": ""
   }
   ```

8. Stop the gateway and clean up the stack.

   ```sh
   docker compose -f examples/traffic-token-exchange/jwt-authz-grant/docker-compose.yaml down
   ```

## More examples

The [`traffic-token-exchange` examples](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-token-exchange) in the agentgateway repository also include an `extauthz` example that performs a token exchange by building the token request by hand with [external authorization]({{< link-hextra path="/configuration/security/external-authz/" >}}) and CEL, as an alternative to the built-in `oauthTokenExchange` method.

### Custom headers

To read the incoming credential from a custom location and place the exchanged token somewhere other than the `Authorization` header, update the source header.

```yaml
backendAuth:
  oauthTokenExchange:
    host: idp.example.com:443
    path: /token
    # Read the incoming credential from a custom header and declare its token type.
    subjectToken:
      tokenType: urn:ietf:params:oauth:token-type:jwt
      source:
        header:
          name: x-subject-token
          prefix: "Bearer "
    # Place the exchanged token in a custom header instead of Authorization.
    authorizationLocation:
      header:
        name: x-upstream-auth
        prefix: "Bearer "
```

### Actor tokens

For the RFC 8693 token exchange grant only, an actor token can be sent for [delegation](https://datatracker.ietf.org/doc/html/rfc8693#section-1.1) (`actor_token` / `actor_token_type`). Unlike the subject token, the actor token has no default source, so a `source` must be set.

```yaml
backendAuth:
  oauthTokenExchange:
    host: idp.example.com:443
    path: /token
    actorToken:
      tokenType: urn:ietf:params:oauth:token-type:access_token
      source:
        header:
          name: x-actor-token
          prefix: "Bearer "
```

### Microsoft Entra on-behalf-of

The JWT bearer grant is also the shape used by the [Microsoft Entra on-behalf-of flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-on-behalf-of-flow). Use `clientSecretPost` to send the client credentials in the request body, and `additionalParams` for the vendor-specific `requested_token_use` parameter. Values in `additionalParams` are CEL expressions, so a literal string requires inner quotes.

```yaml
backendAuth:
  oauthTokenExchange:
    host: login.microsoftonline.com:443
    path: /<TENANT_ID>/oauth2/v2.0/token
    grantType: jwtBearer
    clientAuth:
      clientId: $CLIENT_ID
      clientSecret: $CLIENT_SECRET
      method: clientSecretPost
    scopes:
    - https://graph.microsoft.com/.default
    additionalParams:
      requested_token_use: '"on_behalf_of"'
```

The `jwt-authz-grant` example includes an `/obo` route and a mock token endpoint so that you can inspect the exact on-behalf-of request the gateway sends. For details, see the [example README](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-token-exchange/jwt-authz-grant).

## Authenticate the gateway to the token endpoint

The `clientAuth` field decides how agentgateway identifies itself to the token endpoint. Set `method` to one of three values. Omit `clientAuth` entirely and agentgateway sends no client authentication fields, which suits a public client or a token endpoint that authenticates by other means.

{{< tabs >}}
{{% tab name="clientSecretBasic" %}}
Send the client ID and secret in the HTTP Basic `Authorization` header ([RFC 6749 §2.3.1](https://datatracker.ietf.org/doc/html/rfc6749#section-2.3.1)). This is the default method, and the one most authorization servers expect.

```yaml
clientAuth:
  method: clientSecretBasic
  clientId: $CLIENT_ID
  clientSecret: $CLIENT_SECRET
```
{{% /tab %}}
{{% tab name="clientSecretPost" %}}
Send the client ID and secret in the form body of the request. Some servers accept this method only, and the Microsoft Entra on-behalf-of flow is one of them.

```yaml
clientAuth:
  method: clientSecretPost
  clientId: $CLIENT_ID
  clientSecret: $CLIENT_SECRET
```
{{% /tab %}}
{{% tab name="privateKeyJwt" %}}
Send a signed client assertion instead of a shared secret ([RFC 7523](https://datatracker.ietf.org/doc/html/rfc7523)). Agentgateway signs a short-lived JWT with your private key on each token request, so no secret is stored in the configuration or transmitted to the authorization server.

```yaml
clientAuth:
  method: privateKeyJwt
  clientId: $CLIENT_ID
  signingKey:
    file: /path/to/client-assertion-key.pem
  alg: ES256
  kid: my-client-key
  assertionAudience: https://idp.example.com/oauth2/v1/token
```
{{% /tab %}}
{{< /tabs >}}

### Sign the client assertion with a private key

Use `privateKeyJwt` when the authorization server registers your client with a public key rather than a secret. Okta and Microsoft Entra both support the method, and it is often required for a confidential client that must not hold a shared secret.

Register the matching public key or certificate with the authorization server first, then point `signingKey` at the private half.

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Field | Description |
| -- | -- |
| `clientId` | Required client ID that identifies agentgateway at the authorization server. |
| `signingKey` | Required PEM-encoded RSA or EC private key, either the PEM text or `{file: <path>}`. |
| `assertionAudience` | Required `aud` claim of the assertion. Most servers require the URL of the token endpoint itself. |
| `alg` | JWS signing algorithm: `RS256` (default), `RS384`, `RS512`, `PS256`, `ES256`, or `ES384`. The algorithm must match the key family. The `RS` and `PS` algorithms need an RSA key, and the `ES` algorithms need an EC key. |
| `kid` | Optional `kid` header that agentgateway stamps on the assertion. Set it when the authorization server registers more than one key for the client. |
| `certificate` | Optional PEM-encoded X.509 certificate chain, leaf first. Set it for a server that validates the assertion against a certificate rather than a bare key. |
| `certificateHeader` | JWS certificate header that agentgateway emits from `certificate`. Required when `certificate` is set. |

{{< doc-test paths="client-auth" >}}
# WHAT THIS TEST VALIDATES:
#   * All three clientAuth methods from the tabs above are accepted as complete standalone configs,
#     and privateKeyJwt is accepted with a real EC signing key.
#   * privateKeyJwt requires assertionAudience.
#   * The method names really are camelCase here: the PascalCase spelling that the Kubernetes CRDs
#     use is rejected, which is what the first bullet below claims.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That an authorization server accepts the assertion -- external dependency: needs a real IdP
#     with the matching public key registered for the client. The docker-compose walkthroughs
#     earlier on this page cover a live exchange with clientSecretBasic instead.
#   * The certificate and certificateHeader fields -- external dependency: the failure mode the
#     page describes (a mismatch is logged and does not stop loading) is only observable at a token
#     endpoint that validates the assertion.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
export CLIENT_ID="${CLIENT_ID:-my-gateway}"
export CLIENT_SECRET="${CLIENT_SECRET:-not-a-real-secret}"
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out client-assertion-key.pem
{{< /doc-test >}}

{{< doc-test paths="client-auth" >}}
# The tabs above show the clientAuth block only, so wrap each one in the config it belongs to.
client_auth_case() {
  local name="$1" expect="$2"
  { cat <<'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: backend.example.com:443
    policies:
      backendAuth:
        oauthTokenExchange:
          host: idp.example.com:443
          path: /oauth2/v1/token
          audiences:
          - api://my-backend
          clientAuth:
EOF
    sed 's/^/            /'
  } > "config-client-auth-$name.yaml"
  if agentgateway -f "config-client-auth-$name.yaml" --validate-only > "client-auth-$name.log" 2>&1; then
    [ "$expect" = ok ] || { echo "FAIL: $name was accepted but should be rejected"; exit 1; }
    echo "ok       $name"
  else
    [ "$expect" = fail ] || { echo "FAIL: $name was rejected"; cat "client-auth-$name.log"; exit 1; }
    echo "rejected $name (as expected)"
  fi
}

client_auth_case secret-basic ok <<'EOF'
method: clientSecretBasic
clientId: $CLIENT_ID
clientSecret: $CLIENT_SECRET
EOF

client_auth_case secret-post ok <<'EOF'
method: clientSecretPost
clientId: $CLIENT_ID
clientSecret: $CLIENT_SECRET
EOF

client_auth_case private-key-jwt ok <<'EOF'
method: privateKeyJwt
clientId: $CLIENT_ID
signingKey:
  file: client-assertion-key.pem
alg: ES256
kid: my-client-key
assertionAudience: https://idp.example.com/oauth2/v1/token
EOF

# assertionAudience is required.
client_auth_case private-key-jwt-no-audience fail <<'EOF'
method: privateKeyJwt
clientId: $CLIENT_ID
signingKey:
  file: client-assertion-key.pem
EOF

# The Kubernetes spelling must not be accepted here.
client_auth_case pascal-method fail <<'EOF'
method: PrivateKeyJwt
clientId: $CLIENT_ID
signingKey:
  file: client-assertion-key.pem
assertionAudience: https://idp.example.com/oauth2/v1/token
EOF

echo "clientAuth methods verified"
{{< /doc-test >}}

Two details are worth knowing before you rely on the method.

* **The method names are camelCase here.** The Kubernetes custom resources spell the same values in PascalCase, as `ClientSecretBasic`, `ClientSecretPost`, and `PrivateKeyJwt`. Agentgateway rejects the PascalCase spelling.
* **The leaf public key of `certificate` must match `signingKey`.** A mismatch is logged and does not stop the configuration from loading, so the failure appears as a rejected assertion at the token endpoint rather than as a startup error.

{{< version exclude-if="1.4.x" >}}
> [!NOTE]
> The `privateKeyJwt` method is not the same as the `jwtSign` backend authentication method. Both sign a JWT with your private key, and they share the implementation, but `privateKeyJwt` authenticates agentgateway to the token endpoint, while [`jwtSign`]({{< link-hextra path="/configuration/security/backend-authn/" >}}) sends a signed JWT to the backend itself.
{{< /version >}}

## Configuration reference

The following table describes the most common `oauthTokenExchange` fields. For the full set of fields, see the [configuration reference]({{< link-hextra path="/reference/configuration/" >}}).

| Field | Description |
| -- | -- |
| `host`, `policies` | The token endpoint, referenced as a backend. A `host` port of `443` automatically enables backend TLS. |
| `path` | Path of the token endpoint on the backend. Must start with `/`. Defaults to `/`. |
| `grantType` | `tokenExchange` (default, RFC 8693) or `jwtBearer` (RFC 7523). |
| `clientAuth` | Client authentication for the token endpoint: `clientSecretBasic` (default), `clientSecretPost`, or `privateKeyJwt`. Omit the field and agentgateway sends no client authentication. See [Authenticate the gateway to the token endpoint](#authenticate-the-gateway-to-the-token-endpoint). |
| `audiences`, `scopes`, `resources` | The `audience`, `scope`, and `resource` parameters sent to the token endpoint. `resources` are [RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707) resource indicators. |
| `subjectToken` | Where to read the incoming credential and its token type. Defaults to the `Authorization: Bearer` header with token type `access_token`. |
| `actorToken` | Optional RFC 8693 delegation actor token (`tokenExchange` grant only). Has no default source. |
| `authorizationLocation` | Where to place the exchanged token in the backend request. Defaults to the `Authorization` header with a `Bearer ` prefix. |
| `additionalParams` | Extra form parameters appended to the token request. Values are CEL expressions. |
| `cache` | In-memory token cache. Defaults to 8192 entries with a 300-second TTL when the response omits `expires_in`. Set `maxEntries: 0` to disable. |

## Next steps

- Read the [Shielding AI agents from sensitive credentials](https://agentgateway.dev/blog/2026-07-12-agentgateway-token-exchange-jwt-assertion-entra-obo/) blog post for a walkthrough of token exchange, JWT assertion, and Entra on-behalf-of.
- Validate incoming JWTs with the [JWT authentication]({{< link-hextra path="/configuration/security/jwt-authn/" >}}) policy.
