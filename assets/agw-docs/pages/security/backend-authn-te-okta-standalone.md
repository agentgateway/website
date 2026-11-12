Exchange the user's Okta access token that a client sends to the gateway for a new access token at an Okta custom authorization server, so that the backend receives a token that is issued for its own audience and scopes.

## About

{{< reuse "agw-docs/snippets/te-okta-about.md" >}}

### Okta settings {#settings}

Okta uses the standard RFC 8693 grant, so you configure it with the generic `oauthTokenExchange` method. The following settings are specific to Okta.

| Field | Value for Okta |
| -- | -- |
| `host`, `path` | `OKTA_DOMAIN:443` and `/oauth2/AUTH_SERVER_ID/v1/token`, the token endpoint of a custom authorization server. Okta supports on-behalf-of token exchange on custom authorization servers only. The org authorization server, at `/oauth2/v1/token`, does not accept this exchange. |
| `policies.backendTLS` | `{}`. A `host` port of `443` does not enable TLS by itself, so set `backendTLS` to originate TLS to Okta. |
| `grantType` | `tokenExchange`, the default. |
| `subjectToken.tokenType` | `urn:ietf:params:oauth:token-type:access_token`, the default. The subject token is a user's access token from the same custom authorization server, or from another custom authorization server in the same org that this server lists as a trusted server. |
| `requestedTokenType` | Omit. Okta returns an access token. |
| `audiences` | Required by Okta. The audience of the custom authorization server, such as `api://agentgateway-backend`. |
| `scopes` | Scopes that exist on the custom authorization server, and that its access policy allows for the gateway's app. OIDC scopes such as `openid` and `offline_access` are not allowed. |
| `clientAuth` | Required. The client ID and client secret of an API Services app with the Token Exchange grant. Set `method` to `clientSecretBasic`, the default, or `clientSecretPost`. |

## Before you begin

1. [Install the agentgateway binary]({{< link-hextra path="/documentation/setup/install/binary/" >}}).
2. Install [Docker](https://docs.docker.com/get-started/get-docker/) to run a sample backend.
3. Get administrator access to an Okta org that has the NHI Authentication Tokens SKU, which is required for on-behalf-of token exchange. Note that the free Okta Integrator plan does not include access to this feature. 
4. Install [`jq`](https://jqlang.org/download/).

## Step 1: Set up Okta {#okta}

{{< reuse "agw-docs/snippets/te-okta-setup.md" >}}

## Step 2: Get a user token {#user-token}

{{< reuse "agw-docs/snippets/te-okta-user-token.md" >}}

## Step 3: Configure token exchange {#token-exchange}

1. Run the httpbin sample app on port `8000`. The app returns the headers of each request, so you can see the token that the gateway forwards.

   ```sh
   docker run -d --name httpbin -p 8000:8080 mccutchen/go-httpbin
   ```

2. Create a configuration file. The route forwards requests to httpbin, and the `oauthTokenExchange` policy on the backend exchanges the incoming token at your Okta authorization server first. The shell fills in your Okta domain, authorization server ID, client ID, and client secret.

   ```sh
   cat > config.yaml <<EOF
   # yaml-language-server: \$schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 3000
   routes:
   - name: okta-backend
     backends:
     - host: localhost:8000
       policies:
         backendAuth:
           oauthTokenExchange:
             host: $OKTA_DOMAIN:443
             path: /oauth2/$AUTH_SERVER_ID/v1/token
             policies:
               backendTLS: {}
             audiences:
             - api://agentgateway-backend
             scopes:
             - backend.read
             clientAuth:
               method: clientSecretBasic
               clientId: $GATEWAY_CLIENT_ID
               clientSecret: $GATEWAY_CLIENT_SECRET
   EOF
   ```

   For a description of each setting, see [Okta settings](#settings). The file has the client secret in plain text. To keep the secret out of the file, set `clientSecret` to `{file: <path>}` instead.

3. In a second terminal, change to the directory that has the `config.yaml` file, and run agentgateway with the configuration. Keep the first terminal for the `curl` commands, so that the `INBOUND_TOKEN` variable stays available there.

   ```sh
   agentgateway -f config.yaml
   ```

## Step 4: Verify the exchange {#verify}

1. In the first terminal, send a request to the httpbin `/headers` endpoint through the gateway, with the user's token. The gateway exchanges the token at Okta, and forwards the request to httpbin with the exchanged token. If more than an hour passed since Step 2, get a new user token first.

   ```sh
   curl -s http://localhost:3000/headers \
     -H "authorization: Bearer $INBOUND_TOKEN"
   ```

   If the response is `invalid request` instead of the request headers, Okta rejected the exchange. In an org without the NHI Authentication Tokens SKU, Okta always rejects it. For other causes, see [Troubleshooting](#troubleshooting).

2. Decode the payload of the exchanged token.

   ```sh
   curl -s http://localhost:3000/headers \
     -H "authorization: Bearer $INBOUND_TOKEN" \
     | jq -r '.headers.Authorization[0] | sub("^Bearer ";"")' \
     | cut -d. -f2 \
     | jq -R 'gsub("-";"+") | gsub("_";"/") | . + ("=" * ((4 - (length % 4)) % 4)) | @base64d | fromjson | {iss, aud, sub, cid, scp, act}'
   ```

   Compared to the token that you sent, the `sub` claim still identifies the test user, so the backend sees the same end user. The `cid` claim is now the client ID of the `agentgateway` app, the `scp` claim has the `backend.read` scope that the gateway requested, and the `act` claim names the `agentgateway` app as the actor.

   ```json
   {
     "iss": "https://integrator-1234567.okta.com/oauth2/aus1a2b3c4d5e6f7g8h9",
     "aud": "api://agentgateway-backend",
     "sub": "testuser@example.com",
     "cid": "0oa1gateway2client3h9",
     "scp": [
       "backend.read"
     ],
     "act": {
       "sub": "0oa1gateway2client3h9",
       "sub_profile": "service"
     }
   }
   ```

3. Send a request without a token. The gateway has no subject token to exchange, so it rejects the request with a `400` response and does not call Okta.

   ```sh
   curl -s -w " %{http_code}\n" http://localhost:3000/headers
   ```

   Example output:

   ```
   invalid request 400
   ```

The exchange does not validate the incoming token itself; Okta does. To reject an invalid or expired token at the gateway before it calls Okta, add a [JWT authentication]({{< link-hextra path="/documentation/configuration/security/jwt-authn/" >}}) policy to the route. Set `preserveToken: true` on that policy, so that the token is still in the request when the exchange runs.

## Troubleshooting {#troubleshooting}

When Okta rejects the exchange, the gateway returns `400` with the body `invalid request`. When Okta rejects the gateway's client credentials, the gateway returns `500` with the body `backend authentication failed`. The response from Okta is logged at debug level. To see it, run agentgateway with the `RUST_LOG=info,agentgateway::http::auth::oauth=debug` environment variable, and look for `oauth token exchange rejected by authorization server` or `oauth token exchange rejected gateway credentials` in the output.

| Error | Cause |
| -- | -- |{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}
| `502` with `backend authentication failed` | The gateway connects to Okta over plain HTTP, and Okta resets the connection. The gateway logs show `Connection reset by peer`. Set `policies.backendTLS: {}` on the `oauthTokenExchange` method. |{{< /version >}}{{< version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}
| `502` with `Connection reset by peer` | The gateway connects to Okta over plain HTTP. Set `policies.backendTLS: {}` on the `oauthTokenExchange` method. |{{< /version >}}
| `invalid_grant`: The NHI Authentication Tokens SKU is not enabled. | Your Okta org does not have the SKU that on-behalf-of token exchange requires. The free Okta Integrator plan does not include it. Contact Okta to enable it. |
| `invalid_request`: The required parameter 'actor_token' is missing. | The `path` points to the org authorization server, `/oauth2/v1/token`, or the configuration has no `audiences`. Use the token endpoint of a custom authorization server, and set `audiences` to the server's audience. |
| `invalid_scope`: One or more scopes are not configured for the authorization server resource. | A value in `scopes` does not exist on the custom authorization server. |
| `unauthorized_client`: The client is not authorized to use the provided grant type. | The app that `clientId` names does not have the Token Exchange grant. Edit the app's general settings, and select **Token Exchange** in the **Advanced** grant types. |
| `invalid_client`: The client secret supplied for a confidential client is invalid. | The `clientSecret` does not match the `agentgateway` app. The gateway returns `500` with `backend authentication failed`. |
| `invalid_client`: A client_id must be provided in the request. | The configuration has no `clientAuth`. Okta authenticates the caller of the exchange, so set `clientAuth` with the client ID and client secret of the `agentgateway` app. |

## Cleanup

1. Stop agentgateway with `Ctrl+C` in its terminal, and remove the httpbin container.

   ```sh
   docker rm -f httpbin
   ```

2. Delete the Okta resources that you created.

   {{< reuse "agw-docs/snippets/te-okta-cleanup.md" >}}
