## About

To require users to authenticate, apply a browser [OIDC]({{< link-hextra path="/documentation/configuration/security/oidc/" >}}) policy to the gateway that serves the UI. Unauthenticated requests are redirected to your identity provider (IdP) to log in, and only requests that pass the policies in `ui.policies` reach the UI.

The `ui.policies` section takes the same policies that a route takes, so you can also use [JWT]({{< link-hextra path="/documentation/configuration/security/jwt-authn/" >}}), [basic]({{< link-hextra path="/documentation/configuration/security/basic-authn/" >}}), or [API key]({{< link-hextra path="/documentation/configuration/security/apikey-authn/" >}}) authentication for programmatic access. To restrict which authenticated users get in, add an [authorization policy]({{< link-hextra path="/documentation/configuration/security/http-authz/" >}}) alongside the authentication policy. To send the access decision to your own policy service, such as Open Policy Agent (OPA), use an [external authorization]({{< link-hextra path="/documentation/configuration/security/external-authz/" >}}) (`extAuthz`) policy. The `ui.policies` section also accepts [cross-origin resource sharing (CORS)]({{< link-hextra path="/documentation/configuration/security/cors/" >}}) and [cross-site request forgery (CSRF)]({{< link-hextra path="/documentation/configuration/security/csrf/" >}}) policies.

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}
The `oidc` policy in `ui.policies` also accepts bearer ID tokens, so CLI clients can call the UI's API without a browser session. The client sends an ID token from the same identity provider and client in the `Authorization: Bearer <token>` header. This default is `credentials: sessionOrBearer`. To accept only browser sessions, set `credentials: session`. For more information, see [Bearer tokens for API clients]({{< link-hextra path="/documentation/configuration/security/oidc/#bearer-id-tokens" >}}).
{{< /version >}}

> [!NOTE]
> A policy in `ui.policies` applies only to the gateways that the `ui` section lists. It does not apply to the copy of the UI on the admin interface, which stays unauthenticated. That is safe by default, because the admin address is loopback-only, but it is a reason not to move it. For more information, see [The UI and the admin interface are not the same thing]({{< link-hextra path="/documentation/setup/ui/#admin-interface" >}}).

## Before you begin

1. [Install standalone agentgateway]({{< link-hextra path="/documentation/setup/install/" >}}).
2. [Serve the UI on its own gateway]({{< link-hextra path="/documentation/setup/ui/gateway-ui/" >}}). The examples on this page apply the OIDC policy to the `ui-gateway` on port `4001` that you created in that guide.
3. Set up an IdP, such as Keycloak or Microsoft Entra ID. Consider creating a client specifically for the UI, such as `agentgateway-ui`. For provider-specific setup instructions, see the [identity provider integrations]({{< link-hextra path="/integrations/auth/" >}}).

## Binary and Docker {#secure-binary-docker}

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
You can add the policies in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}). UI access policies also require the UI to be on a gateway, such as the `ui-gateway` from [Serve the UI on its own gateway]({{< link-hextra path="/documentation/setup/ui/gateway-ui/" >}}).

1. Set the environment variables for the session cookie key and the UI client that you created in your IdP.
   * `OIDC_COOKIE_SECRET` is an AES-256-GCM key that agentgateway uses to encrypt session cookies. Generate 32 random bytes, encoded as 64 hexadecimal characters. If this key is missing, agentgateway does not start with an `oidc` policy.
   * `REDIRECT_URI` must match the address that you serve the UI on, and it must be registered as a valid redirect URI in your IdP.

   ```sh
   export OIDC_COOKIE_SECRET="$(openssl rand -hex 32)"
   export ISSUER_URL=https://keycloak.example.com/realms/agentgateway
   export UI_CLIENT_ID=agentgateway-ui
   export UI_CLIENT_SECRET=<client-secret>
   export REDIRECT_URI=http://localhost:4001/oauth/callback
   ```

2. Restart agentgateway from the same shell, so that agentgateway has these variables in its environment. In Docker, add `-e OIDC_COOKIE_SECRET -e ISSUER_URL -e UI_CLIENT_ID -e UI_CLIENT_SECRET -e REDIRECT_URI` to your `docker run` command. For the full command, see the **Docker** tab in the **Config file** tab.
3. Open the **Settings** > **UI** page on the admin interface, such as [http://localhost:15000/ui/settings/ui](http://localhost:15000/ui/settings/ui). The policies do not apply to the admin interface, so you keep access while you edit them. Confirm that the **Public gateway** dropdown shows `ui-gateway`.
4. In the **UI access policies** section, click the **OIDC** card, and configure the following fields. You can enter environment variable references, which agentgateway expands when it loads the configuration. This way, the client secret is not written into the file.
   1. **Issuer**: `${ISSUER_URL}`
   2. **Client ID**: `${UI_CLIENT_ID}`
   3. **Client secret**: `${UI_CLIENT_SECRET}`
   4. **Redirect URI**: `${REDIRECT_URI}`
   5. **Additional scopes**: Click the `profile` and `email` suggestions.

   {{< reuse-image src="img/ui-settings-oidc.png" srcDark="img/ui-settings-oidc-dark.png" alt="UI OIDC settings drawer with the issuer URL from the ISSUER_URL environment variable" >}}

   {{< reuse-image src="img/ui-settings-oidc-client.png" srcDark="img/ui-settings-oidc-client-dark.png" alt="UI OIDC settings drawer scrolled to the client ID, client secret, and redirect URI environment variables and the profile and email scopes" >}}

5. Click **Save policy**. The save fails if agentgateway cannot fetch the OIDC discovery document from the issuer, or if a referenced environment variable is not set.
6. Optional: Restrict access to users whose email address ends in `@example.com`.
   1. Click the **Authorization** card, and click **Add rule**.
   2. Keep **Allow** as the effect, and replace the example expression with `jwt.email.endsWith("@example.com")`.
   3. Click **Save policy**.
7. Open the UI at the gateway's address, such as [http://localhost:4001/ui/](http://localhost:4001/ui/). Instead of loading the UI, agentgateway shows a **Sign in** page. Click **Sign in with SSO** to log in with your OIDC provider. After you authenticate, you are returned to the UI.
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/standalone/setup/ui/secure-config.md" >}}
{{% /tab %}}
{{< /tabs >}}
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< reuse "agw-docs/standalone/setup/ui/secure-config.md" >}}
{{% /version %}}

## Helm {#secure-helm}

1. Save the details of the UI client that you created in your IdP as environment variables. The redirect URI must match the address that you expose the UI on, and it must be registered as a valid redirect URI in your IdP. If you plan to [expose the UI]({{< link-hextra path="/documentation/setup/ui/expose-ui/" >}}) on a hostname, use that hostname now so that you do not have to register a second redirect URI later.

   ```sh
   export ISSUER_URL=https://keycloak.example.com/realms/agentgateway
   export UI_CLIENT_ID=agentgateway-ui
   export UI_CLIENT_SECRET=<client-secret>
   export REDIRECT_URI=https://agentgateway.example.com/oauth/callback
   ```

2. Create a Secret that holds the session cookie encryption key and the OIDC client secret.

   After a user logs in, agentgateway keeps the session in a browser cookie that it encrypts with the session cookie encryption key. The key is a random value that you generate, not a value that your IdP gives you. Agentgateway requires an AES-256-GCM key, which is 32 random bytes that are encoded as 64 hexadecimal characters. Agentgateway refuses to start when an `oidc` policy is set and this key is missing or is not that length.

   ```sh
   kubectl create secret generic agentgateway-ui-secrets \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --from-literal=OIDC_COOKIE_SECRET="$(openssl rand -hex 32)" \
     --from-literal=UI_CLIENT_SECRET="${UI_CLIENT_SECRET}"
   ```

   > [!NOTE]
   > You choose the Secret's name, and you pass it to the chart in the `oidc.cookieSecretName` value in the next step. However, the key within the Secret must be named `OIDC_COOKIE_SECRET`, because the chart reads that exact key. The client secret key can have any name, as long as the `extraEnv` entry that you add in the next step refers to the same name. This example keeps both values in one Secret, but you can also keep them in separate Secrets. In that case, set `oidc.cookieSecretName` to the Secret that holds the cookie key, and point the `extraEnv` entry at the Secret that holds the client secret.

3. Add the OIDC policy to the `ui` section, point the chart at the Secret, and pass the client secret to the pod as an environment variable.

   {{< version exclude-if="1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
   Set the chart value `oidc.enabled: true` to inject `OIDC_COOKIE_SECRET` from the named Secret. Setting only `oidc.cookieSecretName` does not inject the key, and agentgateway cannot start with an OIDC policy without it.
   {{< /version >}}

   The heredoc in this step is unquoted, so your shell substitutes the issuer, client ID, and redirect URI as it writes the file. The `\$UI_CLIENT_SECRET` reference is escaped, so it stays in the file as a literal `$UI_CLIENT_SECRET` that agentgateway resolves from the pod environment at startup. This way, the client secret stays in the Secret instead of the ConfigMap.

   ```yaml
   cat <<EOF > values.yaml
   config:
     gateways:
       default:
         port: 4000
       ui-gateway:
         port: 4001
     ui:
       gateways: [ui-gateway]
       policies:
         oidc:
           issuer: ${ISSUER_URL}
           clientId: ${UI_CLIENT_ID}
           clientSecret: \$UI_CLIENT_SECRET
           redirectURI: ${REDIRECT_URI}
           scopes:
           - profile
           - email
     routes:
     - matches:
       - path:
           pathPrefix: /
       backends:
       - host: httpbin.httpbin.svc.cluster.local:8000
   oidc:{{< version exclude-if="1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
     enabled: true{{< /version >}}
     cookieSecretName: agentgateway-ui-secrets
   extraEnv:
   - name: UI_CLIENT_SECRET
     valueFrom:
       secretKeyRef:
         name: agentgateway-ui-secrets
         key: UI_CLIENT_SECRET
   EOF
   ```

4. Upgrade the release with your values file.

   {{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

5. Confirm that the pod is running.

   ```sh
   kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -l app.kubernetes.io/name={{< reuse "agw-docs/standalone/helm-standalone-chart-name.md" >}}
   ```

6. Port-forward the UI port again, and confirm that an unauthenticated request is redirected to your IdP.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} 4001:4001
   ```

   ```sh
   curl -s -o /dev/null -D- http://localhost:4001/ui | grep -i location
   ```

   Example output:

   ```txt
   location: https://keycloak.example.com/realms/agentgateway/protocol/openid-connect/auth?response_type=code&client_id=agentgateway-ui&...
   ```

> [!IMPORTANT]
> Agentgateway fetches the OIDC discovery document at startup, so the issuer must be reachable from the pod. When the fetch fails, the pod does not start, and the logs report `failed to decode oidc discovery response from uri`. If the pod enters `CrashLoopBackOff` after you add the policy, check the issuer URL and any egress restrictions.

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}
## Choose what users can do {#access-model}

The policies in `ui.policies` decide what users can do after they log in, so you can match UI access to the teams in your IdP. Each request to a UI page or the UI API passes through the policies. By default, a user who logs in gets full access, which suits a small team of administrators. Full access includes saving configuration changes, managing all virtual keys, and editing `ui.policies`.

To give different users different access, choose one of the following options.

| Option | Effect |
| -- | -- |
| Authorization rules | Define your own roles from IdP claims, the request method, and the request path. For example, one group can save changes, and every other user can view. For more information, see [Give some users read-only access](#read-only-users). |
| [`extAuthz` policy]({{< link-hextra path="/documentation/configuration/security/external-authz/" >}}) | Your own authorization service, such as OPA, decides each UI request with any per-user rules that you write. |
| `readOnly` storage mode | Every user can view the UI, and your configuration file stays the source of truth. For more information, see [Configuration storage]({{< link-hextra path="/documentation/setup/storage/#binary-readonly" >}}). |

### Give some users read-only access {#read-only-users}

Add `allow` rules to the `authorization` policy in `ui.policies` to let one group of users save changes while every other user can view. The following example gives members of the `agentgateway-admins` group full access. The example assumes that your IdP adds a `groups` claim to the ID token. The claim name and the group names depend on your IdP configuration.

1. Open the **Settings** > **UI** page on the admin interface, such as [http://localhost:15000/ui/settings/ui](http://localhost:15000/ui/settings/ui). In a Helm installation, port-forward port `15000` first. The admin interface is the best place to edit UI policies, because the policies do not apply to it. You keep access while you try out rules, and you can always return there to adjust them.
2. Add the rules to the `ui.policies` section that has your authentication policy. In the UI, add the rules on the **Authorization** card. In a Helm installation, the section is `config.ui.policies` in your values file.

   ```yaml
   ui:
     policies:
       authorization:
         rules:
         - allow: '"agentgateway-admins" in jwt.groups'
         - allow: 'request.method == "GET"'
         - allow: 'request.path.startsWith("/api/logs/") || request.path == "/api/cel"'
   ```

   | Rule | Effect |
   | -- | -- |
   | `"agentgateway-admins" in jwt.groups` | Members of the group have full access, including saving changes. |
   | `request.method == "GET"` | Every other user can open the UI pages and read the configuration. |
   | `request.path.startsWith("/api/logs/") \|\| request.path == "/api/cel"` | Every other user can also search and stream request logs, view analytics, and use the Common Expression Language (CEL) playground. These pages query data with `POST` requests, so this rule includes them in view access. |

3. Log in to the UI as a user outside the group, and verify that you can browse the UI. When you save a change, the gateway returns a `403` response, because only members of the group can save changes, including changes to `ui.policies`. You can still log out with **Sign out**.

## Check which user is logged in {#signed-in-user}

The account menu in the top bar of the UI shows the user of each request. The account menu and the request logs use the same value, the `agentgateway.user` attribute. By default, the value comes from the first of the following sources that has a value:

1. The metadata of a virtual key, in this order: `agentgateway.dev/owner`, `user`, `name`, then `owner`
2. The `sub` claim, then the `email` claim, of a JWT or an OIDC session
3. The username of a basic authentication request
4. The client identity of a mutual TLS (mTLS) connection, such as the workload identity or the common name of the client certificate

You choose which value identifies your users. Many IdPs set the `sub` claim to a stable ID, such as the UUID `1ed4bac1-9a81-4867-a81f-04cfc58bf0b2` in Keycloak. To show the email address instead, set the `standardAttributes.user` field in the `config` section of your configuration file to `jwt.email`. In a Helm installation, the field is `config.config.standardAttributes.user` in your values file, because the `config` value holds the whole configuration file.

```yaml
config:
  standardAttributes:
    user: jwt.email
```

You can set the field to any CEL expression that returns a string. For an OIDC session, when your expression returns no value, the account menu uses the `sub` claim instead. This fallback keeps **Sign out** available. The menu shows the user's name from the `name` or `preferred_username` claim. It shows the email address from the `email` claim.

To check the user of your requests, open the `/api/runtime` endpoint in the browser where you are logged in to the UI, such as [http://localhost:4001/api/runtime](http://localhost:4001/api/runtime).

The response includes a `user` object, such as the following example.

```json
"user": {
  "subject": "1ed4bac1-9a81-4867-a81f-04cfc58bf0b2",
  "name": "Alice Admin",
  "email": "alice@example.com",
  "canLogout": true
}
```

The `canLogout` field is `true` for a browser OIDC session, which users can end with **Sign out** in the account menu. The field is `false` for other credentials, such as a bearer token or basic authentication.

When a user creates a virtual key in the UI{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}} or with `agctl`{{< /version >}}, agentgateway records this user as the owner of the key. For more information, see [Key owners]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/#key-owners" >}}).
{{< /version >}}

{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
## Authenticate CLI access {#agctl}

To call the resource API of the UI from the command line, configure an [agctl connection profile]({{< link-hextra path="/documentation/operations/config-resources/#save-connection-profiles" >}}) with an exec credential plugin. The authentication policy of the API must accept the credential that the plugin returns, such as a JWT bearer token. A browser OIDC session does not authenticate CLI requests.

To verify the connection, run `agctl standalone --gateway <profile-name> get all`. Set the URL of the profile to the authenticated gateway, without `/ui` or `/api`. The admin address remains a separate access path without authentication, as described earlier on this page.
{{< /version >}}

## Next steps

* [Expose the UI]({{< link-hextra path="/documentation/setup/ui/expose-ui/" >}}) on your own HTTPS hostname, now that a login is required.
* [Choose where configuration is stored]({{< link-hextra path="/documentation/setup/storage/" >}}) so that the UI can save your changes.
{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}
* [See who owns each virtual key]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/#key-owners" >}}) and how the owner affects request logs.
{{< /version >}}
