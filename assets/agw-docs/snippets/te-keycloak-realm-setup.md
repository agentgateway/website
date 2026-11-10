Standard token exchange needs a few settings in the realm: a confidential client for the gateway with token exchange turned on, the gateway in the audience of the user's token, the backend's audience available to the gateway, and a client scope to down-scope the exchanged token. The following steps use the [`kcadm.sh` admin CLI](https://www.keycloak.org/docs/latest/server_admin/#admin-cli), which is in the `bin` directory of the Keycloak distribution. Each step also names the matching setting in the Admin Console.

1. Save the URL of your Keycloak server and the name of your realm in environment variables, and log in to the admin CLI.

   ```sh
   export KEYCLOAK_URL=http://localhost:7080
   export REALM=agentgateway
   kcadm.sh config credentials --server $KEYCLOAK_URL --realm master --user admin
   ```

   When prompted, enter the admin password, such as `admin`.

2. Optional: If you do not have a realm to try the exchange in, create a test realm, and set up the required clients and user. The realm has a client that issues user tokens, `agent`, with direct access grants so that you can get a token with `curl`, a client that represents the backend API, `backend`, and a user, `testuser`. If you use your own realm, replace `agent`, `backend`, and the user in the following steps.

   ```sh
   kcadm.sh create realms -s realm=$REALM -s enabled=true
   kcadm.sh create clients -r $REALM -s clientId=agent -s secret=agent-secret \
     -s publicClient=false -s standardFlowEnabled=false -s directAccessGrantsEnabled=true
   kcadm.sh create clients -r $REALM -s clientId=backend -s publicClient=false -s standardFlowEnabled=false
   kcadm.sh create users -r $REALM -s username=testuser -s enabled=true \
     -s email=testuser@example.com -s emailVerified=true -s firstName=Test -s lastName=User
   kcadm.sh set-password -r $REALM --username testuser --new-password testpass
   ```

3. Create a confidential client for the gateway, `agentgateway`, with standard token exchange turned on. In the Admin Console, turn on **Client authentication** and select **Standard Token Exchange** in the **Capability config** of the client. The gateway does not sign in users, so the standard flow is off.

   ```sh
   kcadm.sh create clients -r $REALM -s clientId=agentgateway \
     -s publicClient=false -s standardFlowEnabled=false \
     -s 'attributes."standard.token.exchange.enabled"=true'
   export GATEWAY_ID=$(kcadm.sh get clients -r $REALM -q clientId=agentgateway --fields id --format csv --noquotes)
   export GATEWAY_CLIENT_SECRET=$(kcadm.sh get clients/$GATEWAY_ID/client-secret -r $REALM --fields value --format csv --noquotes)
   ```

4. Make the user's token name the gateway as a recipient. Keycloak exchanges a token only if the client that asks for the exchange, `agentgateway`, is in the token's `aud` claim. Create a client scope with an audience mapper for `agentgateway`, and make it a default client scope of the `agent` client, which issues the user's token. In the Admin Console, the mapper is an **Audience** mapper with **Included Client Audience** set to `agentgateway`. Tokens from `agent` now include `agentgateway` in `aud`.

   ```sh
   SCOPE_ID=$(kcadm.sh create client-scopes -r $REALM -s name=agentgateway-audience \
     -s protocol=openid-connect -s 'attributes."include.in.token.scope"=false' -i)
   kcadm.sh create client-scopes/$SCOPE_ID/protocol-mappers/models -r $REALM \
     -s name=agentgateway-audience -s protocol=openid-connect -s protocolMapper=oidc-audience-mapper \
     -s 'config."included.client.audience"=agentgateway' -s 'config."access.token.claim"=true'
   AGENT_ID=$(kcadm.sh get clients -r $REALM -q clientId=agent --fields id --format csv --noquotes)
   kcadm.sh update clients/$AGENT_ID/default-client-scopes/$SCOPE_ID -r $REALM
   ```

5. Allow the gateway to request a token for the backend. Keycloak issues the exchanged token only for an audience that the gateway's client can get in its own tokens. Create a client scope with an audience mapper for `backend`, and make it a default client scope of the `agentgateway` client. This step is the counterpart to step 4, which covers the incoming token.

   ```sh
   SCOPE_ID=$(kcadm.sh create client-scopes -r $REALM -s name=backend-audience \
     -s protocol=openid-connect -s 'attributes."include.in.token.scope"=false' -i)
   kcadm.sh create client-scopes/$SCOPE_ID/protocol-mappers/models -r $REALM \
     -s name=backend-audience -s protocol=openid-connect -s protocolMapper=oidc-audience-mapper \
     -s 'config."included.client.audience"=backend' -s 'config."access.token.claim"=true'
   kcadm.sh update clients/$GATEWAY_ID/default-client-scopes/$SCOPE_ID -r $REALM
   ```

6. Create a client scope that the gateway can request in the exchange, such as `backend.read`, and make it an optional client scope of the `agentgateway` client. When the gateway sends the scope, Keycloak adds it to the `scope` claim of the exchanged token. The scope limits what the exchanged token allows, so the backend can check the `scope` claim and grant the request only read access. The gateway configuration in this guide requests `backend.read`.

   ```sh
   SCOPE_ID=$(kcadm.sh create client-scopes -r $REALM -s name=backend.read -s protocol=openid-connect -i)
   kcadm.sh update clients/$GATEWAY_ID/optional-client-scopes/$SCOPE_ID -r $REALM
   ```

7. Get an access token for the test user from the `agent` client, and save it in an environment variable. You use this token as the incoming token that a real client would send to the gateway. Keycloak access tokens expire after 5 minutes by default, so get a new one if you come back to this guide later.

   ```sh
   export INBOUND_TOKEN=$(curl -s $KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token \
     -u agent:agent-secret -d grant_type=password \
     -d username=testuser -d password=testpass | jq -r .access_token)
   ```

8. Exchange the token at Keycloak as the gateway, and decode the result. This request is the same one that agentgateway sends, so it confirms the realm settings before you configure the gateway.

   ```sh
   curl -s $KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token \
     -u agentgateway:$GATEWAY_CLIENT_SECRET \
     -d grant_type=urn:ietf:params:oauth:grant-type:token-exchange \
     -d subject_token_type=urn:ietf:params:oauth:token-type:access_token \
     -d subject_token=$INBOUND_TOKEN \
     -d audience=backend -d scope=backend.read \
     | jq -r .access_token | cut -d. -f2 \
     | jq -R 'gsub("-";"+") | gsub("_";"/") | . + ("=" * ((4 - (length % 4)) % 4)) | @base64d | fromjson | {aud, azp, sub, scope}'
   ```

   Example output:

   ```json
   {
     "aud": "backend",
     "azp": "agentgateway",
     "sub": "d7386852-9a23-44b2-b8ea-a2d81f73a014",
     "scope": "backend.read profile email"
   }
   ```

   The output confirms that the realm is ready for the gateway. The `aud` claim is `backend`, the `azp` claim is `agentgateway`, and the `sub` claim is the same user as in the incoming token. The `scope` claim includes `backend.read`, plus the default client scopes of the `agentgateway` client. If the exchange fails, Keycloak returns an error instead, such as `Client is not within the token audience`. For more errors, see [Troubleshooting](#troubleshooting).
