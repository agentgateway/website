<!--TODO secure UI -->
Agentgateway serves the UI in two places, and the difference decides how you reach it and how you secure it.

| Served on | Port | Published by the chart | Reach it by |
| --- | --- | --- | --- |
| Admin interface | `15000` | No. The chart creates no Service for this port. | Port-forwarding the Deployment. |
| Gateway listener | Any port that a gateway in your configuration listens on | Only if you add the port to `gateway.service.ports`. | The gateway Service. |

The `ui` section of your configuration decides which gateway serves the UI. For the full set of options, see [Gateways]({{< link-hextra path="/configuration/gateways/" >}}). For what you can do after the UI opens, see [Admin UI]({{< link-hextra path="/operations/ui/" >}}).

> [!WARNING]
> The chart's default configuration includes an empty `ui` section and a gateway named `default`. Because the UI attaches to a gateway named `default` when `ui.gateways` is omitted, a default installation serves the UI and its APIs, including `/api/config`, on the same port as your proxy traffic. That port is a `LoadBalancer` Service on port `80` by default. Set `gateway.service.type` to `ClusterIP`, or complete the steps in this section, before you install the chart on a cluster that assigns external addresses.

### How this differs from exposing listeners

The two settings solve different halves of the same problem, and reaching the UI from outside the cluster takes both.

* **Your agentgateway configuration decides what a port serves.** The `ui` section attaches the UI to a gateway. Until you attach it, no gateway port serves the UI, no matter how the Service is configured.
* **The `gateway.service.ports` value decides which container ports the Service publishes.** Publishing a port does not change what agentgateway serves on it.

The admin interface on port `15000` sits outside both settings. The chart never publishes it, so port-forwarding is the only way to reach it.

### Serve the UI on its own gateway

Give the UI a gateway of its own so that proxy traffic and UI traffic do not share a port. Keeping them apart lets you publish the proxy port while the UI port stays internal, and it lets you apply an authentication policy to the UI alone.

1. Add a second gateway to your Helm values, and point the `ui` section at it. The following example serves proxy traffic on port `4000` and the UI on port `4001`.

   ```yaml
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
   ```

2. Upgrade the release with your values file.

3. Confirm that the UI no longer answers on the proxy port. The following request returns `404`, because port `4000` now serves only your routes.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} 4000:4000
   ```

   ```sh
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/ui
   ```

4. Confirm that the UI answers on its own port.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} 4001:4001
   ```

   ```sh
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4001/ui
   ```

   Example output:

   ```txt
   200
   ```

### Secure the UI with OIDC

Add an authentication policy before you publish the UI port. The `ui.policies` section takes the same policies that a route takes, so you can use [OIDC]({{< link-hextra path="/configuration/security/oidc/" >}}) for browser logins, or [JWT]({{< link-hextra path="/configuration/security/jwt-authn/" >}}), [basic]({{< link-hextra path="/configuration/security/basic-authn/" >}}), or [API key]({{< link-hextra path="/configuration/security/apikey-authn/" >}}) authentication for programmatic access. To restrict which authenticated users get in, add an [authorization policy]({{< link-hextra path="/configuration/security/http-authz/" >}}).

For provider-specific setup, see the identity provider integrations, such as [Keycloak]({{< link-hextra path="/integrations/auth/keycloak/" >}}), [Microsoft Entra ID]({{< link-hextra path="/integrations/auth/entra/" >}}), [Auth0]({{< link-hextra path="/integrations/auth/auth0/" >}}), and [Descope]({{< link-hextra path="/integrations/auth/descope/" >}}).

1. Create a Secret that holds the session cookie encryption key. Agentgateway refuses to start when an `oidc` policy is set and this key is missing.

   ```sh
   kubectl create secret generic agentgateway-ui-oidc \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --from-literal=OIDC_COOKIE_SECRET="$(python3 -c 'import os; print(os.urandom(32).hex())')"
   ```

2. Create a Secret that holds the OIDC client secret.

   ```sh
   kubectl create secret generic agentgateway-ui-client \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --from-literal=UI_CLIENT_SECRET='<client-secret>'
   ```

3. Add the OIDC policy to the `ui` section, point the chart at the cookie Secret, and pass the client secret as an environment variable. A `$VARIABLE` reference in the configuration file resolves from the pod environment at startup.

   ```yaml
   oidc:
     cookieSecretName: agentgateway-ui-oidc
   extraEnv:
   - name: UI_CLIENT_SECRET
     valueFrom:
       secretKeyRef:
         name: agentgateway-ui-client
         key: UI_CLIENT_SECRET
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
           issuer: https://keycloak.example.com/realms/agentgateway
           clientId: agentgateway-ui
           clientSecret: $UI_CLIENT_SECRET
           redirectURI: https://agentgateway.example.com/oauth/callback
           scopes:
           - profile
           - email
   ```

4. Register the `redirectURI` value as a valid redirect URI in your identity provider, and make sure that the URL matches the address that users open in the browser.

5. Upgrade the release, then confirm that the pod is running.

   ```sh
   kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -l app.kubernetes.io/name=agentgateway-standalone
   ```

> [!IMPORTANT]
> Agentgateway fetches the OIDC discovery document at startup, so the issuer must be reachable from the pod. When the fetch fails, the pod does not start, and the logs report `failed to decode oidc discovery response from uri`. If the pod enters `CrashLoopBackOff` after you add the policy, check the issuer URL and any egress restrictions before you look at the policy itself.

### Publish the UI port

After the UI has an authentication policy, publish its port. Because the UI usually needs different exposure than proxy traffic, add a separate Service with `gateway.extraServices` instead of adding the port to the main Service. The chart names the Service `<release name>-<name>`.

```yaml
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
```

Terminate TLS in front of the UI, and use the resulting external address in both the `redirectURI` value and your identity provider configuration.
