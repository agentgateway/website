<!--TODO secure UI -->
Agentgateway serves the UI in two places:

- The admin interface on the agentgateway Deployment. You can access the admin UI by port-forwarding the deployment on port `15000` and accessing the `/ui` path.
- A gateway listener that you configure in the `ui` and `gateway` config sections. By default, you have a `default` gateway that serves both the UI and APIs on the same LoadBalancer port `80` as proxy traffic.

{{% steps %}}

## Steps

In this guide, you set up a separate gateway for UI traffic, secure the route to the UI, and expose the UI on your own domain.

### Set up the gateway

Give the UI a gateway of its own so that proxy traffic and UI traffic do not share a port. Keeping them apart lets you publish the proxy port while the UI port stays internal, and it lets you apply different authentication policies to the UI and proxy traffic.

1. Add an `admin` gateway to your Helm values file, and point the `ui` section at it. The following example serves proxy traffic such as httpbin routes on port `4000` of the default gateway and the UI on port `4001` of the admin gateway.

   ```yaml
   cat <<'EOF' > values.yaml
   config:
     gateways:
       default:
         port: 4000
       admin:
         port: 4001
     ui:
       gateways: [admin]
     routes:
     - matches:
       - path:
           pathPrefix: /
       backends:
       - host: httpbin.httpbin.svc.cluster.local:8000
   EOF
   ```

2. Upgrade the release with your values file.

   {{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

3. Confirm that the UI no longer answers on the proxy port.

   1. Port-forward the agentgateway Deployment on port 4000 for proxy traffic.

      ```sh
      kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
        deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} 4000:4000
      ```

   2. Send a request to the `/ui` path. Confirm that the request returns a `404` not found code, because port `4000` now serves only your routes.

      ```sh
      curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/ui
      ```

      Example output:

      ```txt
      404
      ```

4. Confirm that the UI answers on its own port.

   1. Port-forward the agentgateway Deployment on port 4001 for UI traffic.

      ```sh
      kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
        deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} 4001:4001
      ```

   2. Send a request to the `/ui` path. Confirm that the request returns a `200` success code.

      ```sh
      curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/ui
      ```

      Example output:

      ```txt
      200
      ```

### Secure the UI with OIDC

Add an authentication policy before you expose the UI port. The `ui.policies` section takes the same policies that a route takes, so you can use [OIDC]({{< link-hextra path="/configuration/security/oidc/" >}}) for browser logins, or [JWT]({{< link-hextra path="/configuration/security/jwt-authn/" >}}), [basic]({{< link-hextra path="/configuration/security/basic-authn/" >}}), or [API key]({{< link-hextra path="/configuration/security/apikey-authn/" >}}) authentication for programmatic access. To restrict which authenticated users get in, add an [authorization policy]({{< link-hextra path="/configuration/security/http-authz/" >}}).

1. Set up your identity provider (IdP), such as Keycloak or Microsoft Entra ID. Consider creating a separate client specifically for the UI, such as `agentgateway-ui`. For provider-specific setup, see the [identity provider integrations]({{< link-hextra path="/integrations/auth/" >}}). 
   
   Make sure to store the following values as environment variables:

   - The issuer URL.
   - The client ID for the UI.
   - The client secret for the UI.
   - The redirect URI that matches matches the address that you later expose the UI on.

   ```sh
   export ISSUER_URL=<https://keycloak.example.com/realms/agentgateway>
   export UI_CLIENT_ID=<agentgateway-ui>
   export UI_CLIENT_SECRET=<client-secret>
   export REDIRECT_URI=<https://agentgateway.example.com/oauth/callback>
   ```

2. Create a Secret that holds the session cookie encryption key. Agentgateway refuses to start when an `oidc` policy is set and this key is missing.

   ```sh
   kubectl create secret generic agentgateway-ui-oidc \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --from-literal=OIDC_COOKIE_SECRET="$(python3 -c 'import os; print(os.urandom(32).hex())')"
   ```

3. Create a Secret that holds the OIDC client secret.

   ```sh
   kubectl create secret generic agentgateway-ui-client \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --from-literal=UI_CLIENT_SECRET='$UI_CLIENT_SECRET'
   ```

4. Add the OIDC policy to the `ui` section, point the chart at the cookie Secret, and pass the client secret as an environment variable. A `$VARIABLE` reference in the configuration file resolves from the pod environment at startup.

   ```yaml
   cat <<'EOF' > values.yaml
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
           issuer: $ISSUER_URL
           clientId: $UI_CLIENT_ID
           clientSecret: $UI_CLIENT_SECRET
           redirectURI: $REDIRECT_URI
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
     cookieSecretName: agentgateway-ui-oidc
   extraEnv:
   - name: UI_CLIENT_SECRET
     valueFrom:
       secretKeyRef:
         name: agentgateway-ui-client
         key: UI_CLIENT_SECRET
   EOF
   ```

5. Upgrade the release with your values file.

   {{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

6. Confirm that the pod is running.

   ```sh
   kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -l app.kubernetes.io/name=agentgateway-standalone
   ```

> [!IMPORTANT]
> Agentgateway fetches the OIDC discovery document at startup, so the issuer must be reachable from the pod. When the fetch fails, the pod does not start, and the logs report `failed to decode oidc discovery response from uri`. If the pod enters `CrashLoopBackOff` after you add the policy, check the issuer URL and any egress restrictions.

### Expose the UI

After the UI has an authentication policy, expose the UI on a LoadBalancer service.

1. Create a separate Service with `gateway.extraServices` instead of adding the port to the main Service. This way, the UI gets its own LoadBalancer service, with the name `<release name>-<name>`.

   ```yaml
   cat <<'EOF' > values.yaml
   gateway:
     service:
       ports:
       - name: http
         port: 80
         targetPort: 4000
         protocol: TCP
     extraServices:
     - name: ui
       type: LoadBalancer
       ports:
       - name: https
         port: 443
         targetPort: 4001
         protocol: TCP   
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
           issuer: $ISSUER_URL
           clientId: $UI_CLIENT_ID
           clientSecret: $UI_CLIENT_SECRET
           redirectURI: $REDIRECT_URI
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
     cookieSecretName: agentgateway-ui-oidc
   extraEnv:
   - name: UI_CLIENT_SECRET
     valueFrom:
       secretKeyRef:
         name: agentgateway-ui-client
         key: UI_CLIENT_SECRET
   EOF
   ```

2. HOW TO DO THIS? do you have to create a secret for the certificates from the DNS provider for the HTTPS traffic on your domain??? Terminate TLS in front of the UI, and use the resulting external address in both the `redirectURI` value and your identity provider configuration.

3. Upgrade the release with your values file.

   {{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

4. Confirm that the pod is running and note the LoadBalancer hostname or IP address.

   ```sh
   kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -l app.kubernetes.io/name=agentgateway-standalone
   ```

   How to add the service check?


### Log in to the UI

1. Open the UI on the external address.
2. Verify that you are redirected to the IdP to login.
3. Verify that you are in the admin UI.

### Edit config in the UI

Because you are authenticated, you can now edit the agentgateway config directly from the UI.

Add steps

{{% /steps %}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

