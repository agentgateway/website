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

3. Add an `oidc` policy to the `ui` section of your configuration file. The following example redirects unauthenticated users on the `ui-gateway` to the OIDC provider to log in. The optional `authorization` policy further restricts access to users whose email address ends in `@example.com`.

   Agentgateway expands environment variables in the configuration file when it loads the file, so you can refer to the values that you exported in the previous step instead of writing the client secret into the file.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
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
   > For the full list of `oidc` policy fields and a complete runnable Keycloak setup, see [OIDC browser authentication]({{< link-hextra path="/documentation/configuration/security/oidc" >}}) and the [`traffic-unified-gateway` example](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-unified-gateway) in the agentgateway repository.

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
