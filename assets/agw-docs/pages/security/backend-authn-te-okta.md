Exchange the user's Okta access token that a client sends to the gateway for a new access token at an Okta custom authorization server, so that the backend receives a token that is issued for its own audience and scopes.

## About

{{< reuse "agw-docs/snippets/te-okta-about.md" >}}

### Okta settings {#settings}

Okta uses the standard RFC 8693 grant, so you configure it with the generic `oauthTokenExchange` method. The following settings are specific to Okta.

| Field | Value for Okta |
| -- | -- |
| `url` | `https://OKTA_DOMAIN/oauth2/AUTH_SERVER_ID/v1/token`, the token endpoint of a custom authorization server. Okta supports on-behalf-of token exchange on custom authorization servers only. The org authorization server, at `/oauth2/v1/token`, does not accept this exchange. Because the scheme is `https`, the gateway originates TLS to Okta. |
| `grantType` | `TokenExchange`, the default. |
| `subjectToken.tokenType` | `AccessToken`, the default. The subject token is a user's access token from the same custom authorization server, or from another custom authorization server in the same org that this server lists as a trusted server. |
| `requestedTokenType` | Omit. Okta returns an access token. |
| `audiences` | Required by Okta. The audience of the custom authorization server, such as `api://agentgateway-backend`. |
| `scopes` | Scopes that exist on the custom authorization server, and that its access policy allows for the gateway's app. OIDC scopes such as `openid` and `offline_access` are not allowed. |
| `clientAuth` | Required. The client ID and client secret of an API Services app with the Token Exchange grant. Set `method` to `ClientSecretBasic`, the default, or `ClientSecretPost`. |

{{< reuse "agw-docs/snippets/te-okta-preset-intro.md" >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

4. Get administrator access to an Okta org that supports on-behalf-of token exchange. Okta requires the NHI Authentication Tokens SKU for the exchange, which the free Okta Integrator plan does not include.

5. Install [`jq`](https://jqlang.org/download/).

## Step 1: Set up Okta {#okta}

{{< reuse "agw-docs/snippets/te-okta-setup.md" >}}

## Step 2: Get a user token {#user-token}

{{< reuse "agw-docs/snippets/te-okta-user-token.md" >}}

## Step 3: Configure token exchange {#token-exchange}

1. Create a Kubernetes Secret with the client secret of the `agentgateway` app. The policy reads the secret from the `clientSecret` key.

   ```sh
   kubectl create secret generic okta-client -n httpbin \
     --from-literal=clientSecret=$GATEWAY_CLIENT_SECRET
   ```

2. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that exchanges the incoming token at your Okta authorization server for every request to the httpbin app. The shell fills in your Okta domain, authorization server ID, and client ID.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: okta-token-exchange
     namespace: httpbin
   spec:
     targetRefs:
     - group: ""
       kind: Service
       name: httpbin
     backend:
       auth:
         oauthTokenExchange:
           url: https://$OKTA_DOMAIN/oauth2/$AUTH_SERVER_ID/v1/token
           grantType: TokenExchange
           audiences:
           - api://agentgateway-backend
           scopes:
           - backend.read
           clientAuth:
             clientId: $GATEWAY_CLIENT_ID
             method: ClientSecretBasic
             secretRef:
               name: okta-client
   EOF
   ```

   For a description of each setting, see [Okta settings](#settings).

3. Confirm that the policy is accepted and attached.

   ```sh
   kubectl get {{< reuse "agw-docs/snippets/policy.md" >}} okta-token-exchange -n httpbin \
     -o jsonpath='{range .status.ancestors[0].conditions[*]}{.type}={.status}{"\n"}{end}'
   ```

   Example output:

   ```
   Accepted=True
   Attached=True
   ```

{{< reuse "agw-docs/snippets/te-okta-preset.md" >}}

## Step 4: Verify the exchange {#verify}

1. Send a request to the httpbin `/headers` endpoint through the gateway, with the user's token. The gateway exchanges the token at Okta, and forwards the request to httpbin with the exchanged token. Because httpbin returns the request headers, the response shows the token that the gateway forwarded. If more than an hour passed since Step 2, get a new user token first.

   ```sh
   curl -s http://$INGRESS_GW_ADDRESS/headers \
     -H "host: www.example.com" \
     -H "authorization: Bearer $INBOUND_TOKEN"
   ```

2. Decode the payload of the exchanged token.

   ```sh
   curl -s http://$INGRESS_GW_ADDRESS/headers \
     -H "host: www.example.com" \
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
   curl -s -w " %{http_code}\n" http://$INGRESS_GW_ADDRESS/headers \
     -H "host: www.example.com"
   ```

   Example output:

   ```
   invalid request 400
   ```

The exchange does not validate the incoming token itself; Okta does. To reject an invalid or expired token at the gateway before it calls Okta, add a JWT authentication policy, as described in [Validate the incoming token at the edge]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/standard/#edge-validation" >}}). Set `preserveToken: true` on that policy, so that the token is still in the request when the exchange runs.

## Troubleshooting {#troubleshooting}

When Okta rejects the exchange, the gateway returns `400` with the body `invalid request`. When Okta rejects the gateway's client credentials, the gateway returns `500` with the body `backend authentication failed`. The response from Okta is logged at debug level. To see it, raise the log level of the token exchange module on the proxy, send the request again, and check the proxy logs.

```sh
kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000 &
curl -X POST "http://localhost:15000/logging?level=info,agentgateway::http::auth::oauth=debug"
kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} | grep "oauth token exchange"
```

The change lasts until the proxy restarts. Look for a message such as `oauth token exchange rejected by authorization server` or `oauth token exchange rejected gateway credentials`, which includes the error from Okta.

| Error from Okta | Cause |
| -- | -- |
| `invalid_grant`: The NHI Authentication Tokens SKU is not enabled. | Your Okta org does not have the SKU that on-behalf-of token exchange requires. Contact Okta to enable it. |
| `invalid_request`: The required parameter 'actor_token' is missing. | The `url` points to the org authorization server, `/oauth2/v1/token`, or the policy has no `audiences`. Use the token endpoint of a custom authorization server, and set `audiences` to the server's audience. |
| `invalid_scope`: One or more scopes are not configured for the authorization server resource. | A value in `scopes` does not exist on the custom authorization server. |
| `unauthorized_client`: The client is not authorized to use the provided grant type. | The app that `clientId` names does not have the Token Exchange grant. Edit the app's general settings, and select **Token Exchange** in the **Advanced** grant types. |
| `invalid_client`: The client secret supplied for a confidential client is invalid. | The client secret in the `okta-client` Secret does not match the `agentgateway` app. The gateway returns `500` with `backend authentication failed`. |
| `invalid_client`: A client_id must be provided in the request. | The policy has no `clientAuth`. Okta authenticates the caller of the exchange, so set `clientAuth` with the client ID and client secret of the `agentgateway` app. |

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Delete the Kubernetes resources.

   ```sh
   kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} okta-token-exchange -n httpbin
   kubectl delete secret okta-client -n httpbin
   ```

   {{< reuse "agw-docs/snippets/te-okta-preset-cleanup.md" >}}

2. If you ran the admin port-forward in the troubleshooting section, stop it.

   ```sh
   pkill -f "port-forward deployment/agentgateway-proxy" || true
   ```

3. In the Okta Admin Console, delete the resources that you created: the `agentgateway-test-password-only` authentication policy, the `agentgateway-backend` authorization server, the `agentgateway` and `agentgateway-test-client` apps, and the test user. Deactivate each app and the user before you delete them.
