Exchange the incoming token for a backend-scoped token with the [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693) token exchange grant.

## About

The `tokenExchange` grant is the default grant of the `oauthTokenExchange` backend authentication method. The gateway sends the incoming token to the authorization server as the `subject_token` and forwards the exchanged token to the backend.

For the JWT bearer grant, which sends the incoming token as an `assertion` instead, see [JWT bearer grant]({{< link-hextra path="/documentation/configuration/security/backend-authn/token-exchange/jwt-bearer/" >}}). For an exchange that crosses a trust boundary between two authorization servers, see [Cross App Access]({{< link-hextra path="/documentation/configuration/security/backend-authn/token-exchange/cross-app-access/" >}}).

## Before you begin

{{< reuse "agw-docs/snippets/oauth-te-prereq-standalone.md" >}}

## Exchange a token

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

4. In another terminal, mint a user token from Keycloak to use as the incoming token.

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

6. Copy the exchanged token from the `Authorization` header in the previous response, and save it to an environment variable.

   ```sh
   export FORWARDED_TOKEN=eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUI...
   ```

7. Decode the token's payload to confirm the exchange. This command splits off the JWT payload segment and decodes it with `jq`.

   ```sh
   echo "$FORWARDED_TOKEN" | cut -d. -f2 | jq -R 'gsub("-";"+") | gsub("_";"/") | . + ("=" * ((4 - (length % 4)) % 4)) | @base64d | fromjson'
   ```

   The exchanged token is issued by the `backend-oauth` realm for `aud=target-client`, and its authorized party (`azp`) is the gateway's `requester-client`, not the original `initial-client`.

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

## More examples

The [`traffic-token-exchange` examples](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-token-exchange) in the agentgateway repository also include an `extauthz` example that performs a token exchange by building the token request by hand with [external authorization]({{< link-hextra path="/documentation/configuration/security/external-authz/" >}}) and CEL, as an alternative to the built-in `oauthTokenExchange` method.

### Custom headers

To read the incoming token from a custom location and place the exchanged token somewhere other than the `Authorization` header, update the source header.

```yaml
backendAuth:
  oauthTokenExchange:
    host: idp.example.com:443
    path: /token
    # Read the incoming token from a custom header and declare its token type.
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

## Authenticate the gateway to the token endpoint

{{< reuse "agw-docs/snippets/oauth-te-client-auth-standalone.md" >}}

## Configuration reference

{{< reuse "agw-docs/snippets/oauth-te-fields-standalone.md" >}}

## Next steps

- Read the [Shielding AI agents from sensitive credentials](https://agentgateway.dev/blog/2026-07-12-agentgateway-token-exchange-jwt-assertion-entra-obo/) blog post for a walkthrough of token exchange, JWT assertion, and Entra on-behalf-of.
- Validate incoming JWTs with the [JWT authentication]({{< link-hextra path="/documentation/configuration/security/jwt-authn/" >}}) policy.

## Cleanup

Stop the gateway with `Ctrl+C`, then remove the example stack.

```sh
docker compose -f examples/traffic-token-exchange/oauth-rfc8693/docker-compose.yaml down
```
