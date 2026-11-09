In the Okta Admin Console, create a custom authorization server for the backend, an API Services app for the gateway, and a test app and user that get the incoming token.

1. Save your Okta domain in an environment variable, without the `https://` scheme or the `-admin` suffix of the Admin Console URL.

   ```sh
   export OKTA_DOMAIN=<your-org>.okta.com
   ```

2. Create a custom authorization server for the backend. Go to **Security** > **API** > **Authorization Servers**, and click **Add Authorization Server**.
   * **Name**: `agentgateway-backend`
   * **Audience**: `api://agentgateway-backend`. Okta sets this value as the `aud` claim of the tokens that the server issues.

   Okta shows the issuer URL of the new server, in the form `https://<your-org>.okta.com/oauth2/<id>`. Save the ID at the end of the URL.

   ```sh
   export AUTH_SERVER_ID=<authorization-server-id>
   ```

3. On the **Scopes** tab of the authorization server, click **Add Scope**, and create a scope named `backend.read`. The exchanged token can carry only scopes that exist on the authorization server.

4. Create the API Services app that the gateway authenticates as. Go to **Applications** > **Applications**, click **Create App Integration**, select **API Services**, and name the app `agentgateway`.
   1. In the **General Settings** section, click **Edit**. In the **Grant type** section, expand **Advanced**, select **Token Exchange**, and save. Keep **Client Credentials** selected. Okta requires it for an API Services app.
   2. In the **Client Credentials** section, keep **Client secret** as the client authentication method. Copy the client ID and the client secret, and save them in environment variables.

   ```sh
   export GATEWAY_CLIENT_ID=<agentgateway-client-id>
   export GATEWAY_CLIENT_SECRET=<agentgateway-client-secret>
   ```

5. Create a test app that gets a user's access token, as an agent or web app does in production. Click **Create App Integration**, select **OIDC - OpenID Connect** and **Native Application**, and name the app `agentgateway-test-client`.
   1. In the **Grant type** section, select **Resource Owner Password** in addition to **Authorization Code**. This guide uses the password grant to get a user token with `curl`. In production, use the authorization code flow with PKCE instead.
   2. In the **Assignments** section, select **Skip group assignment for now**, and save.
   3. Copy the client ID, and save it in an environment variable. A native app has no client secret.

   ```sh
   export TEST_CLIENT_ID=<agentgateway-test-client-client-id>
   ```

6. Create an access policy on the authorization server that lets both apps get tokens. Go back to **Security** > **API** > **Authorization Servers**, select `agentgateway-backend`, and on the **Access Policies** tab, click **Add New Access Policy**.
   1. Name the policy `agentgateway`. For **Assign to**, select **The following clients**, add `agentgateway` and `agentgateway-test-client`, and create the policy.
   2. Click **Add rule**, and name the rule `agentgateway`. In **Grant type is**, select **Resource Owner Password** and, under **Advanced**, **Token Exchange**. Keep the default of any user and any scope, and create the rule.

7. Create a test user. Go to **Directory** > **People**, and click **Add person**. Enter a name and a username, such as `testuser@example.com`, select **I will set password**, enter a password, and clear **User must change password on first login**. Then assign the user to the `agentgateway-test-client` app: go to **Applications** > **Applications** > `agentgateway-test-client` > **Assignments**, click **Assign** > **Assign to People**, and assign the user.

   ```sh
   export OKTA_USERNAME=testuser@example.com
   export OKTA_PASSWORD='<password>'
   ```

8. Let the test user sign in to the test app with a password only. By default, Okta requires two factors to sign in to an app, and rejects the password grant. Go to **Security** > **Authentication Policies**, click **Add a policy**, and name it `agentgateway-test-password-only`. Add a rule that applies to the test user, and set **User must authenticate with** to **Password / IdP**. Then on the **Applications** tab of the policy, add `agentgateway-test-client`. Use this policy for testing only.
