Exchange the user's Keycloak access token that a client sends to the gateway for a new access token at Keycloak, so that the backend receives a token that is issued for its own audience.

## About

{{< reuse "agw-docs/snippets/te-keycloak-about.md" >}}

### Keycloak settings {#settings}

Keycloak uses the standard RFC 8693 grant, so you configure it with the generic `oauthTokenExchange` method. The following settings are specific to Keycloak.

| Field | Value for Keycloak |
| -- | -- |
| `host`, `path` | The host and port of Keycloak, and `/realms/REALM/protocol/openid-connect/token`. Keycloak checks the `iss` claim of the incoming token against this URL, so the gateway must reach Keycloak through the same hostname that issued the token. |
| `policies.backendTLS` | `{}` if Keycloak serves HTTPS. A `host` port of `443` does not enable TLS by itself. |
| `grantType` | `tokenExchange`, the default. |
| `subjectToken.tokenType` | `urn:ietf:params:oauth:token-type:access_token`, the default. Keycloak accepts only access tokens as the subject token. |
| `requestedTokenType` | Omit, or set `urn:ietf:params:oauth:token-type:access_token`. Keycloak also issues an ID token, but rejects the JWT type. |
| `audiences` | The client IDs of the backends that the exchanged token is for, such as `backend`. Each audience must be available to the gateway's client. If you omit this field, the exchanged token has every audience that is available to the gateway's client. |
| `scopes` | Optional. Default or optional client scopes of the gateway's client. |
| `clientAuth` | Required. The client ID and client secret of the gateway's confidential client. Set `method` to `clientSecretBasic`, the default, or `clientSecretPost`. |

## Before you begin

1. [Install the agentgateway binary]({{< link-hextra path="/documentation/setup/install/binary/" >}}).
2. Get admin access to a Keycloak server, version 26.2 or later. To run one locally for this guide, start Keycloak in development mode on port `7080`.

   ```sh
   docker run -d --name keycloak -p 7080:8080 \
     -e KC_BOOTSTRAP_ADMIN_USERNAME=admin \
     -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
     quay.io/keycloak/keycloak:{{< reuse "agw-docs/versions/keycloak.md" >}} start-dev
   ```

3. Install [`jq`](https://jqlang.org/download/).
4. Download the Keycloak distribution and extract its `bin` directory, which has the [`kcadm.sh` admin CLI](https://www.keycloak.org/docs/latest/server_admin/#admin-cli). Then, add the directory to your `PATH`. The admin CLI requires Java 17 or later.

   ```sh
   export KEYCLOAK_VERSION={{< reuse "agw-docs/versions/keycloak.md" >}}
   curl -sL https://github.com/keycloak/keycloak/releases/download/$KEYCLOAK_VERSION/keycloak-$KEYCLOAK_VERSION.tar.gz \
     | tar xz keycloak-$KEYCLOAK_VERSION/bin
   export PATH="$PWD/keycloak-$KEYCLOAK_VERSION/bin:$PATH"
   ```

## Step 1: Configure the realm {#realm}

{{< reuse "agw-docs/snippets/te-keycloak-realm-setup.md" >}}

## Step 2: Configure token exchange {#token-exchange}

1. Run the httpbin sample app on port `8000`. The app returns the headers of each request, so you can see the token that the gateway forwards.

   ```sh
   docker run -d --name httpbin -p 8000:8080 mccutchen/go-httpbin
   ```

2. Create a configuration file. The route forwards requests to httpbin, and the `oauthTokenExchange` policy on the backend exchanges the incoming token at Keycloak first. The shell fills in your realm and client secret. If your Keycloak is not at `localhost:7080`, change `host`, and add `backendTLS` if it serves HTTPS.

   ```sh
   cat > config.yaml <<EOF
   # yaml-language-server: \$schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 3000
   routes:
   - name: keycloak-backend
     backends:
     - host: localhost:8000
       policies:
         backendAuth:
           oauthTokenExchange:
             host: localhost:7080
             path: /realms/$REALM/protocol/openid-connect/token
             audiences:
             - backend
             scopes:
             - backend.read
             clientAuth:
               method: clientSecretBasic
               clientId: agentgateway
               clientSecret: $GATEWAY_CLIENT_SECRET
   EOF
   ```

   For a description of each setting, see [Keycloak settings](#settings).

3. In a second terminal, change to the directory that has the `config.yaml` file, and run agentgateway with the configuration. Keep the first terminal for the `curl` commands, so that the `INBOUND_TOKEN` variable stays available there.

   ```sh
   agentgateway -f config.yaml
   ```

## Step 3: Verify the exchange {#verify}

In the first terminal, send a request to the httpbin `/headers` endpoint through the gateway, with the user's token, and decode the token that httpbin received. If more than 5 minutes passed since you saved the token in the `$INBOUND_TOKEN` environment variable, get a new token by repeating step 7 of the realm setup.

```sh
curl -s http://localhost:3000/headers \
  -H "authorization: Bearer $INBOUND_TOKEN" \
  | jq -r '.headers.Authorization[0] | sub("^Bearer ";"")' \
  | cut -d. -f2 \
  | jq -R 'gsub("-";"+") | gsub("_";"/") | . + ("=" * ((4 - (length % 4)) % 4)) | @base64d | fromjson | {aud, azp, sub, scope}'
```

The backend received the exchanged token, for the `backend` audience with `agentgateway` as the authorized party, not the token that you sent.

```json
{
  "aud": "backend",
  "azp": "agentgateway",
  "sub": "d7386852-9a23-44b2-b8ea-a2d81f73a014",
  "scope": "backend.read profile email"
}
```

## Next steps

The exchange does not validate the incoming token itself; Keycloak does. To reject an invalid or expired token at the gateway before it calls Keycloak, add a [JWT authentication]({{< link-hextra path="/documentation/configuration/security/jwt-authn/" >}}) policy to the route. Set `preserveToken: true` on that policy, so that the token is still in the request when the exchange runs.

## Troubleshooting {#troubleshooting}

When Keycloak rejects the exchange, the gateway returns `400` with the body `invalid request`. The response from Keycloak is logged at debug level. To see it, run agentgateway with the `RUST_LOG=info,agentgateway::http::auth::oauth=debug` environment variable, and look for `oauth token exchange rejected by authorization server` or `oauth token exchange rejected gateway credentials` in the output.

{{< reuse "agw-docs/snippets/te-keycloak-errors.md" >}}

## Cleanup

1. Stop agentgateway with `Ctrl+C` in its terminal, and remove the httpbin container.

   ```sh
   docker rm -f httpbin
   ```

2. Delete the Keycloak resources. If you created the test realm, delete the realm. Otherwise, delete the `agentgateway` client and the client scopes that you created. If you started the local Keycloak container, remove it instead.

   ```sh
   kcadm.sh delete realms/$REALM
   docker rm -f keycloak
   ```

3. Optional: Remove the Keycloak distribution that you downloaded.

   ```sh
   rm -rf keycloak-$KEYCLOAK_VERSION
   ```
