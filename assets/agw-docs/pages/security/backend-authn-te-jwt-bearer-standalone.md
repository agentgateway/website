Exchange the caller's credential for a backend-scoped token with the [RFC 7523](https://datatracker.ietf.org/doc/html/rfc7523) JWT bearer grant.

## About

The `jwtBearer` grant sends the incoming credential to the authorization server as the `assertion` rather than as the `subject_token`. Use it when the credential is a JWT issued by an identity provider that the authorization server trusts, but that did not itself issue the backend token.

For the default RFC 8693 exchange, see [Standard token exchange]({{< link-hextra path="/documentation/configuration/security/backend-authn/token-exchange/standard/" >}}). For an exchange that crosses a trust boundary between two authorization servers, see [Cross App Access]({{< link-hextra path="/documentation/configuration/security/backend-authn/token-exchange/cross-app-access/" >}}).

## Before you begin

{{< reuse "agw-docs/snippets/oauth-te-prereq-standalone.md" >}}

## Exchange a token

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

## Microsoft Entra on-behalf-of {#entra-obo}

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

{{< reuse "agw-docs/snippets/oauth-te-client-auth-standalone.md" >}}

## Configuration reference

{{< reuse "agw-docs/snippets/oauth-te-fields-standalone.md" >}}

## Next steps

- Read the [Shielding AI agents from sensitive credentials](https://agentgateway.dev/blog/2026-07-12-agentgateway-token-exchange-jwt-assertion-entra-obo/) blog post for a walkthrough of token exchange, JWT assertion, and Entra on-behalf-of.
- Validate incoming JWTs with the [JWT authentication]({{< link-hextra path="/documentation/configuration/security/jwt-authn/" >}}) policy.
