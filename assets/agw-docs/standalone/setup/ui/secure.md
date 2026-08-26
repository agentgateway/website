## About

To require users to authenticate, apply a browser [OIDC]({{< link-hextra path="/configuration/security/oidc/" >}}) policy to the gateway that serves the UI. Unauthenticated requests are redirected to your identity provider (IdP) to log in, and only requests that pass the policies in `ui.policies` reach the UI.

The `ui.policies` section takes the same policies that a route takes, so you can also use [JWT]({{< link-hextra path="/configuration/security/jwt-authn/" >}}), [basic]({{< link-hextra path="/configuration/security/basic-authn/" >}}), or [API key]({{< link-hextra path="/configuration/security/apikey-authn/" >}}) authentication for programmatic access. To restrict which authenticated users get in, add an [authorization policy]({{< link-hextra path="/configuration/security/http-authz/" >}}) alongside the authentication policy.

> [!NOTE]
> A policy in `ui.policies` applies only to the gateways that the `ui` section lists. It does not apply to the admin address, which stays unauthenticated. The admin address is loopback-only by default. To turn it off, see [Change the admin address]({{< link-hextra path="/setup/ui/gateway-ui/#customize-port" >}}).

## Before you begin

1. [Install standalone agentgateway]({{< link-hextra path="/setup/install/" >}}).
2. [Serve the UI on its own gateway]({{< link-hextra path="/setup/ui/gateway-ui/" >}}). The examples on this page apply the OIDC policy to the `admin` gateway on port `4001` that you created in that guide.
3. Set up an IdP, such as Keycloak or Microsoft Entra ID. Consider creating a client specifically for the UI, such as `agentgateway-ui`. For provider-specific setup instructions, see the [identity provider integrations]({{< link-hextra path="/integrations/auth/" >}}).

## Binary and Docker {#secure-binary-docker}

1. Set the `OIDC_COOKIE_SECRET` environment variable. Agentgateway requires this value to encrypt session cookies whenever an `oidc` policy is configured, and refuses to start without it. The key is an AES-256-GCM key, which is 32 random bytes encoded as 64 hexadecimal characters. It is a random value that you generate, not a value that your identity provider gives you.

   ```bash
   export OIDC_COOKIE_SECRET="$(openssl rand -hex 32)"
   ```

2. Save the details of the UI client that you created in your IdP as environment variables. The redirect URI must match the address that you serve the UI on, and it must be registered as a valid redirect URI in your IdP. The following example uses a local address so that you can test the login flow first. When you expose the UI on a hostname, change this value to that hostname and register it in your IdP.

   ```sh
   export ISSUER_URL=https://keycloak.example.com/realms/agentgateway
   export UI_CLIENT_ID=agentgateway-ui
   export UI_CLIENT_SECRET=<client-secret>
   export REDIRECT_URI=http://localhost:4001/oauth/callback
   ```

3. Add an `oidc` policy to the `ui` section of your configuration file. The following example redirects unauthenticated users on the `admin` gateway to the OIDC provider to log in. The optional `authorization` policy further restricts access to users whose email address ends in `@example.com`.

   Agentgateway expands environment variables in the configuration file when it loads the file, so you can refer to the values that you exported in the previous step instead of writing the client secret into the file.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 4000
     admin:
       port: 4001
   ui:
     gateways: [admin]
     policies:
       oidc:
         issuer: ${ISSUER_URL}
         clientId: ${UI_CLIENT_ID}
         clientSecret: ${UI_CLIENT_SECRET}
         redirectURI: ${REDIRECT_URI}
         scopes:
         - profile
         - email
       authorization:
         rules:
         - allow: jwt.email.endsWith("@example.com")
   ```

   > [!TIP]
   > For the full list of `oidc` policy fields and a complete runnable Keycloak setup, see [OIDC browser authentication]({{< link-hextra path="/configuration/security/oidc" >}}) and the [`traffic-unified-gateway` example](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-unified-gateway) in the agentgateway repository.

4. Start agentgateway with the updated config.

   {{< tabs >}}
   {{% tab name="Binary" %}}
   ```sh
   agentgateway -f config.yaml
   ```
   {{% /tab %}}
   {{% tab name="Docker" %}}
   Pass each environment variable to the container with `-e`. The container gets its own environment, so the values that you exported in your shell are not available inside it unless you pass them.

   ```sh
   docker run -d \
     --name agentgateway \
     --user "$(id -u):$(id -g)" \
     -v "$PWD/config.yaml:/config.yaml" \
     -p 4000:4000 -p 4001:4001 \
     -e OIDC_COOKIE_SECRET \
     -e ISSUER_URL \
     -e UI_CLIENT_ID \
     -e UI_CLIENT_SECRET \
     -e REDIRECT_URI \
     {{< reuse "agw-docs/standalone/image-ref.md" >}}:{{< reuse "agw-docs/versions/image-tag.md" >}} \
     -f /config.yaml
   ```

   > [!IMPORTANT]
   > The container must be able to resolve and reach the `ISSUER_URL` value, and so must the browser, because agentgateway redirects the browser to that address to log in. An issuer on `localhost` refers to the container itself, not to your host. Use the IdP's routable address in both places.
   {{% /tab %}}
   {{< /tabs >}}

5. Open the UI at the gateway's address, such as [http://localhost:4001/ui/](http://localhost:4001/ui/). Instead of loading the UI directly, agentgateway redirects you to the OIDC provider to log in. After you authenticate, you are returned to the UI.

## Helm {#secure-helm}

1. Save the details of the UI client that you created in your IdP as environment variables. The redirect URI must match the address that you expose the UI on, and it must be registered as a valid redirect URI in your IdP. If you plan to [expose the UI]({{< link-hextra path="/setup/ui/expose-ui/" >}}) on a hostname, use that hostname now so that you do not have to register a second redirect URI later.

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

   The heredoc in this step is unquoted, so your shell substitutes the issuer, client ID, and redirect URI as it writes the file. The `\$UI_CLIENT_SECRET` reference is escaped, so it stays in the file as a literal `$UI_CLIENT_SECRET` that agentgateway resolves from the pod environment at startup. This way, the client secret stays in the Secret instead of the ConfigMap.

   ```yaml
   cat <<EOF > values.yaml
   config:
     gateways:
       default:
         port: 4000
       admin:
         port: 4001
     ui:
       gateways: [admin]
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
   oidc:
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

## Next steps

* [Expose the UI]({{< link-hextra path="/setup/ui/expose-ui/" >}}) on your own HTTPS hostname, now that a login is required.
* [Choose where configuration is stored]({{< link-hextra path="/setup/storage/" >}}) so that the UI can save your changes.
