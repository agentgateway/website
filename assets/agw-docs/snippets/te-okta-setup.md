Create a custom authorization server for the backend, an API Services app for the gateway, and a test app and user that get the incoming token. You can create these resources in the Okta Admin Console, or script them with the Okta management API.

{{< tabs >}}
{{% tab name="Admin Console" %}}

1. Open the Okta Admin Console. Sign in to your Okta org, such as `https://<your-org>.okta.com`, and click **Admin** in the upper-right corner. You can also go to the Admin Console URL directly, `https://<your-org>-admin.okta.com`.

2. Save your Okta domain in an environment variable, without the `https://` scheme or the `-admin` suffix of the Admin Console URL.

   ```sh
   export OKTA_DOMAIN=<your-org>.okta.com
   ```

3. Create a custom authorization server for the backend. Go to **Security** > **API** > **Authorization Servers**, and click **Add Authorization Server**.
   * **Name**: `agentgateway-backend`
   * **Audience**: `api://agentgateway-backend`. Okta sets this value as the `aud` claim of the tokens that the server issues.

   Okta shows the issuer URL of the new server, in the form `https://<your-org>.okta.com/oauth2/<id>`. Save the ID at the end of the URL.

   ```sh
   export AUTH_SERVER_ID=<authorization-server-id>
   ```

4. On the **Scopes** tab of the authorization server, click **Add Scope**, and create a scope named `backend.read`. The gateway requests this scope in the exchange, so that the exchanged token grants only read access to the backend. The backend can check the `scp` claim of the token to enforce it. The exchanged token can carry only scopes that exist on the authorization server.

5. Create the API Services app that the gateway authenticates as. Go to **Applications** > **Applications**, click **Create App Integration**, select **API Services**, and name the app `agentgateway`.
   1. In the **General Settings** section, click **Edit**. In the **Grant type** section, expand **Advanced**, select **Token Exchange**, and save. Keep **Client Credentials** selected. Okta requires it for an API Services app.
   2. In the **Client Credentials** section, keep **Client secret** as the client authentication method. Copy the client ID and the client secret, and save them in environment variables.

   ```sh
   export GATEWAY_CLIENT_ID=<agentgateway-client-id>
   export GATEWAY_CLIENT_SECRET=<agentgateway-client-secret>
   ```

6. Create a test app that gets a user's access token, as an agent or web app does in production. Click **Create App Integration**, select **OIDC - OpenID Connect** and **Native Application**, and name the app `agentgateway-test-client`.
   1. In the **Grant type** section, select **Resource Owner Password** in addition to **Authorization Code**. This guide uses the password grant to get a user token with `curl`. In production, use the authorization code flow with PKCE instead.
   2. In the **Assignments** section, select **Skip group assignment for now**, and save.
   3. Copy the client ID, and save it in an environment variable. A native app has no client secret.

   ```sh
   export TEST_CLIENT_ID=<agentgateway-test-client-client-id>
   ```

7. Create an access policy on the authorization server that lets both apps get tokens. Go back to **Security** > **API** > **Authorization Servers**, select `agentgateway-backend`, and on the **Access Policies** tab, click **Add New Access Policy**.
   1. Name the policy `agentgateway`. For **Assign to**, select **The following clients**, add `agentgateway` and `agentgateway-test-client`, and create the policy.
   2. Click **Add rule**, and name the rule `agentgateway`. In **Grant type is**, select **Resource Owner Password** and, under **Advanced**, **Token Exchange**. Keep the default of any user and any scope, and create the rule.

8. Create a test user. Go to **Directory** > **People**, and click **Add person**. Enter a name and a username, such as `testuser@example.com`, select **I will set password**, enter a password, and clear **User must change password on first login**. Then assign the user to the `agentgateway-test-client` app: go to **Applications** > **Applications** > `agentgateway-test-client` > **Assignments**, click **Assign** > **Assign to People**, and assign the user.

   ```sh
   export OKTA_USERNAME=testuser@example.com
   export OKTA_PASSWORD='<password>'
   ```

9. Let the test user sign in to the test app with a password only. By default, Okta requires two factors to sign in to an app, and rejects the password grant. Go to **Security** > **Authentication Policies**, click **Add a policy**, and name it `agentgateway-test-password-only`. Add a rule that applies to the test user, and set **User must authenticate with** to **Password / IdP**. Then on the **Applications** tab of the policy, add `agentgateway-test-client`. Use this policy for testing only.

{{% /tab %}}
{{% tab name="Okta API" %}}
1. Open the Okta Admin Console. Sign in to your Okta org, such as `https://<your-org>.okta.com`, and click **Admin** in the upper-right corner. You can also go to the Admin Console URL directly, `https://<your-org>-admin.okta.com`.

2. Create an API token for the [Okta management API](https://developer.okta.com/docs/api/). Go to **Security** > **API** > **Tokens**, and click **Create token**. The API token has the permissions of the admin who creates it, so create it as a super administrator, who can manage authorization servers, apps, users, and authentication policies. Okta shows the token value only once.

3. Save your Okta domain and the API token in environment variables. Use the domain without the `https://` scheme or the `-admin` suffix of the Admin Console URL.

   ```sh
   export OKTA_DOMAIN=<your-org>.okta.com
   export OKTA_API_TOKEN=<api-token>
   ```

4. Create a custom authorization server for the backend, and save its ID. Okta sets the audience, `api://agentgateway-backend`, as the `aud` claim of the tokens that the server issues.

   ```sh
   export AUTH_SERVER_ID=$(curl -s -X POST https://$OKTA_DOMAIN/api/v1/authorizationServers \
     -H "Authorization: SSWS $OKTA_API_TOKEN" -H "Content-Type: application/json" \
     -d '{
       "name": "agentgateway-backend",
       "description": "Backend for agentgateway token exchange",
       "audiences": ["api://agentgateway-backend"]
     }' | jq -r .id)
   echo $AUTH_SERVER_ID
   ```

   Example output:

   ```console
   abc123...
   ```

5. Create the `backend.read` scope on the authorization server. The gateway requests this scope in the exchange, so that the exchanged token grants only read access to the backend. The backend can check the `scp` claim of the token to enforce it. The exchanged token can carry only scopes that exist on the authorization server.

   ```sh
   curl -s -X POST https://$OKTA_DOMAIN/api/v1/authorizationServers/$AUTH_SERVER_ID/scopes \
     -H "Authorization: SSWS $OKTA_API_TOKEN" -H "Content-Type: application/json" \
     -d '{"name": "backend.read", "description": "Read access to the backend"}' | jq '{id, name}'
   ```

   Example output:

   ```json
   {
     "id": "abc123",
     "name": "backend.read"
   }
   ```

6. Create the API Services app that the gateway authenticates as, and save its app ID, client ID, and client secret. The app has the Token Exchange grant, and the Client Credentials grant that Okta requires for an API Services app. It authenticates with a client secret.

   ```sh
   GATEWAY_APP=$(curl -s -X POST https://$OKTA_DOMAIN/api/v1/apps \
     -H "Authorization: SSWS $OKTA_API_TOKEN" -H "Content-Type: application/json" \
     -d '{
       "name": "oidc_client",
       "label": "agentgateway",
       "signOnMode": "OPENID_CONNECT",
       "credentials": {"oauthClient": {"token_endpoint_auth_method": "client_secret_basic"}},
       "settings": {"oauthClient": {
         "application_type": "service",
         "grant_types": ["client_credentials", "urn:ietf:params:oauth:grant-type:token-exchange"],
         "response_types": ["token"]
       }}
     }')
   export GATEWAY_APP_ID=$(echo "$GATEWAY_APP" | jq -r .id)
   export GATEWAY_CLIENT_ID=$(echo "$GATEWAY_APP" | jq -r .credentials.oauthClient.client_id)
   export GATEWAY_CLIENT_SECRET=$(echo "$GATEWAY_APP" | jq -r .credentials.oauthClient.client_secret)
   echo $GATEWAY_CLIENT_ID
   ```

   Example output:

   ```console
   abc123...
   ```

7. Create a test app that gets a user's access token, as an agent or web app does in production, and save its app ID and client ID. The native app has the Resource Owner Password grant, so that this guide can get a user token with `curl`. In production, use the authorization code flow with PKCE instead. A native app has no client secret.

   ```sh
   TEST_APP=$(curl -s -X POST https://$OKTA_DOMAIN/api/v1/apps \
     -H "Authorization: SSWS $OKTA_API_TOKEN" -H "Content-Type: application/json" \
     -d '{
       "name": "oidc_client",
       "label": "agentgateway-test-client",
       "signOnMode": "OPENID_CONNECT",
       "credentials": {"oauthClient": {"token_endpoint_auth_method": "none"}},
       "settings": {"oauthClient": {
         "application_type": "native",
         "grant_types": ["authorization_code", "password"],
         "response_types": ["code"],
         "redirect_uris": ["com.example.agentgateway:/callback"]
       }}
     }')
   export TEST_APP_ID=$(echo "$TEST_APP" | jq -r .id)
   export TEST_CLIENT_ID=$(echo "$TEST_APP" | jq -r .credentials.oauthClient.client_id)
   echo $TEST_CLIENT_ID
   ```

   Example output:

   ```console
   abc123...
   ```

8. Create an access policy on the authorization server that lets both apps get tokens. Then add a rule that allows the Resource Owner Password and Token Exchange grants for any user and any scope.

   ```sh
   ACCESS_POLICY_ID=$(curl -s -X POST https://$OKTA_DOMAIN/api/v1/authorizationServers/$AUTH_SERVER_ID/policies \
     -H "Authorization: SSWS $OKTA_API_TOKEN" -H "Content-Type: application/json" \
     -d @- <<EOF | jq -r .id
   {
     "type": "OAUTH_AUTHORIZATION_POLICY",
     "name": "agentgateway",
     "description": "agentgateway token exchange",
     "priority": 1,
     "conditions": {"clients": {"include": ["$GATEWAY_CLIENT_ID", "$TEST_CLIENT_ID"]}}
   }
   EOF
   )
   curl -s -X POST https://$OKTA_DOMAIN/api/v1/authorizationServers/$AUTH_SERVER_ID/policies/$ACCESS_POLICY_ID/rules \
     -H "Authorization: SSWS $OKTA_API_TOKEN" -H "Content-Type: application/json" \
     -d '{
       "type": "RESOURCE_ACCESS",
       "name": "agentgateway",
       "priority": 1,
       "conditions": {
         "people": {"groups": {"include": ["EVERYONE"]}},
         "grantTypes": {"include": ["password", "urn:ietf:params:oauth:grant-type:token-exchange"]},
         "scopes": {"include": ["*"]}
       }
     }' | jq '{name, status, grantTypes: .conditions.grantTypes.include}'
   ```

   Example output:

   ```json
   {
     "name": "agentgateway",
     "status": "ACTIVE",
     "grantTypes": [
       "password",
       "urn:ietf:params:oauth:grant-type:token-exchange"
     ]
   }
   ```

9. Create and activate a test user, and assign the user to the test app. 
   
   > [!NOTE]
   > Replace the sample `Password1` in the following example a password that meets your org's password policy. By default, the password must have at least 8 characters, with a lowercase letter, an uppercase letter, and a number, and must not include parts of the username.

   ```sh
   export OKTA_USERNAME=testuser@example.com
   export OKTA_PASSWORD='Password1'
   export TEST_USER_ID=$(curl -s -X POST "https://$OKTA_DOMAIN/api/v1/users?activate=true" \
     -H "Authorization: SSWS $OKTA_API_TOKEN" -H "Content-Type: application/json" \
     -d @- <<EOF | jq -r .id
   {
     "profile": {"firstName": "Test", "lastName": "User", "email": "$OKTA_USERNAME", "login": "$OKTA_USERNAME"},
     "credentials": {"password": {"value": "$OKTA_PASSWORD"}}
   }
   EOF
   )
   curl -s -X POST https://$OKTA_DOMAIN/api/v1/apps/$TEST_APP_ID/users \
     -H "Authorization: SSWS $OKTA_API_TOKEN" -H "Content-Type: application/json" \
     -d "{\"id\": \"$TEST_USER_ID\"}" | jq '{id, status}'
   ```

   Example output:

   ```json
   {
     "id": "123abc",
     "status": "ACTIVE"
   }
   ```

   If the `TEST_USER_ID` variable is `null`, the password does not meet the password policy. Run the `curl` command without `| jq -r .id` to see the error.

10. Let the test user sign in to the test app with a password only. By default, Okta requires two factors to sign in to an app, and rejects the password grant. Create an authentication policy with a password-only rule for the test user, and assign the policy to the test app. Use this policy for testing only.

    ```sh
    export AUTHN_POLICY_ID=$(curl -s -X POST https://$OKTA_DOMAIN/api/v1/policies \
      -H "Authorization: SSWS $OKTA_API_TOKEN" -H "Content-Type: application/json" \
      -d '{"type": "ACCESS_POLICY", "name": "agentgateway-test-password-only", "description": "Testing only"}' \
      | jq -r .id)
    curl -s -X POST https://$OKTA_DOMAIN/api/v1/policies/$AUTHN_POLICY_ID/rules \
      -H "Authorization: SSWS $OKTA_API_TOKEN" -H "Content-Type: application/json" \
      -d @- <<EOF | jq '{name, status}'
    {
      "type": "ACCESS_POLICY",
      "name": "password-only",
      "priority": 1,
      "conditions": {"people": {"users": {"include": ["$TEST_USER_ID"]}}},
      "actions": {"appSignOn": {
        "access": "ALLOW",
        "verificationMethod": {
          "type": "ASSURANCE",
          "factorMode": "1FA",
          "constraints": [{"knowledge": {"types": ["password"]}}]
        }
      }}
    }
    EOF
    curl -s -X PUT https://$OKTA_DOMAIN/api/v1/apps/$TEST_APP_ID/policies/$AUTHN_POLICY_ID \
      -H "Authorization: SSWS $OKTA_API_TOKEN" -w "%{http_code}\n"
    ```

    The last command returns `204` when Okta assigns the policy to the app.

    Example output:

    ```json
    {
      "name": "password-only",
      "status": "ACTIVE"
    }
    204
    ```

{{% /tab %}}
{{< /tabs >}}
