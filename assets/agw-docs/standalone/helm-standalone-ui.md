Agentgateway serves the UI in two places:

- The admin interface on the agentgateway Deployment. You can access the admin UI by port-forwarding the deployment on port `15000` and accessing the `/ui` path.
- A gateway listener that you configure in the `ui` and `gateway` config sections. By default, you have a `default` gateway that serves both the UI and APIs on the same LoadBalancer port `80` as proxy traffic.

> [!WARNING]
> The `ui` section attaches to a gateway named `default` when you omit `ui.gateways`. Because the chart's default values include an empty `ui` section, a `default` gateway, and a `LoadBalancer` Service on port `80`, a default installation serves the UI and its APIs, including `/api/config`, on the same address as your proxy traffic. Complete this guide, or set `gateway.service.type` to `ClusterIP`, before you install the chart on a cluster that assigns external addresses.

## Before you begin

1. [Install the standalone Helm chart]({{< link-hextra path="/deployment/helm/install/" >}}).
2. Set up an identity provider (IdP), such as Keycloak or Microsoft Entra ID. Consider creating a client specifically for the UI, such as `agentgateway-ui`. For provider-specific setup, see the [identity provider integrations]({{< link-hextra path="/integrations/auth/" >}}).
3. Get a TLS certificate and key for the hostname that you plan to serve the UI on.

## Steps

In this guide, you set up a separate gateway for UI traffic, secure the route to the UI, and expose the UI on your own domain.

{{% steps %}}

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
      curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4001/ui
      ```

      Example output:

      ```txt
      200
      ```

### Secure the UI with OIDC

Add an authentication policy before you expose the UI port. The `ui.policies` section takes the same policies that a route takes, so you can use [OIDC]({{< link-hextra path="/configuration/security/oidc/" >}}) for browser logins, or [JWT]({{< link-hextra path="/configuration/security/jwt-authn/" >}}), [basic]({{< link-hextra path="/configuration/security/basic-authn/" >}}), or [API key]({{< link-hextra path="/configuration/security/apikey-authn/" >}}) authentication for programmatic access. To restrict which authenticated users get in, add an [authorization policy]({{< link-hextra path="/configuration/security/http-authz/" >}}).

1. Save the details of the UI client that you created in your IdP as environment variables. The redirect URI must match the address that you expose the UI on in a later step, and it must be registered as a valid redirect URI in your IdP.

   ```sh
   export ISSUER_URL=https://keycloak.example.com/realms/agentgateway
   export UI_CLIENT_ID=agentgateway-ui
   export UI_CLIENT_SECRET=<client-secret>
   export REDIRECT_URI=https://agentgateway.example.com/oauth/callback
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
     --from-literal=UI_CLIENT_SECRET="${UI_CLIENT_SECRET}"
   ```

4. Add the OIDC policy to the `ui` section, point the chart at the cookie Secret, and pass the client secret to the pod as an environment variable.

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

7. Port-forward the UI port again, and confirm that an unauthenticated request is redirected to your IdP.

   ```sh
   curl -s -o /dev/null -D- http://localhost:4001/ui | grep -i location
   ```

   Example output:

   ```txt
   location: https://keycloak.example.com/realms/agentgateway/protocol/openid-connect/auth?response_type=code&client_id=agentgateway-ui&...
   ```

> [!IMPORTANT]
> Agentgateway fetches the OIDC discovery document at startup, so the issuer must be reachable from the pod. When the fetch fails, the pod does not start, and the logs report `failed to decode oidc discovery response from uri`. If the pod enters `CrashLoopBackOff` after you add the policy, check the issuer URL and any egress restrictions.

### Expose the UI

Now that the UI requires a login, terminate TLS on the admin gateway and expose it on its own LoadBalancer Service.

Agentgateway reads the certificate and key from the file system, so you mount them into the pod from a Kubernetes Secret. Because the UI usually needs different exposure than proxy traffic, give it a separate Service instead of adding the port to the main Service.

1. Create a TLS Secret from the certificate and key for your UI hostname.

   ```sh
   kubectl create secret tls agentgateway-ui-tls \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --cert=ui-cert.pem --key=ui-key.pem
   ```

2. Mount the Secret, add the `tls` settings to the admin gateway, and add a separate Service for the UI. The chart names the extra Service `<release name>-<name>`, such as `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}-ui`.

   ```yaml
   cat <<EOF > values.yaml
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
         tls:
           cert: /etc/agentgateway/tls/tls.crt
           key: /etc/agentgateway/tls/tls.key
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
     cookieSecretName: agentgateway-ui-oidc
   extraEnv:
   - name: UI_CLIENT_SECRET
     valueFrom:
       secretKeyRef:
         name: agentgateway-ui-client
         key: UI_CLIENT_SECRET
   extraVolumes:
   - name: ui-tls
     secret:
       secretName: agentgateway-ui-tls
   extraVolumeMounts:
   - name: ui-tls
     mountPath: /etc/agentgateway/tls
     readOnly: true
   EOF
   ```

   > [!NOTE]
   > A `kubernetes.io/tls` Secret stores the certificate as `tls.crt` and the key as `tls.key`, which is why the `cert` and `key` paths end with those file names. Setting `tls` on a gateway also switches the gateway protocol to HTTPS. For more certificate options, see [Gateways]({{< link-hextra path="/configuration/gateways/" >}}).

3. Upgrade the release with your values file.

   {{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

4. Confirm that the pod is running.

   ```sh
   kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -l app.kubernetes.io/name=agentgateway-standalone
   ```

5. Get the external address of the UI Service.

   ```sh
   kubectl get svc {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}-ui \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Example output:

   ```txt
   NAME                         TYPE           CLUSTER-IP     EXTERNAL-IP    PORT(S)         AGE
   agentgateway-standalone-ui   LoadBalancer   10.xx.xxx.xx   34.xx.xxx.xx   443:31820/TCP   30s
   ```

6. Create a DNS record that points your UI hostname, such as `agentgateway.example.com`, at the external address. The hostname must match both the certificate and the `REDIRECT_URI` value that you set earlier.

7. Confirm that the gateway serves your certificate.

   ```sh
   echo | openssl s_client -connect agentgateway.example.com:443 \
     -servername agentgateway.example.com 2>/dev/null | openssl x509 -noout -subject -dates
   ```

   Example output:

   ```txt
   subject=CN=agentgateway.example.com
   notBefore=Aug 20 14:34:40 2026 GMT
   notAfter=Sep 19 14:34:40 2026 GMT
   ```

8. Confirm that HTTPS requests are redirected to your IdP.

   ```sh
   curl -s -o /dev/null -D- https://agentgateway.example.com/ui | grep -i location
   ```

### Log in to the UI

Now that the UI is securely exposed, log in.

1. In your browser, open the UI on your hostname, such as `https://agentgateway.example.com/ui`.
2. Verify that agentgateway redirects you to your IdP to log in.
3. Log in with a user from your IdP.
4. Verify that your IdP returns you to the UI, and that the Admin UI opens on the **Gateway Overview**. The overview lists the available capabilities for LLM, MCP, and Traffic.

   {{< reuse-image-light src="img/agentgateway-ui-landing.png" >}}
   {{< reuse-image-dark srcDark="img/agentgateway-ui-landing-dark.png" >}}

For more information about what you can do in the UI, see [Admin UI]({{< link-hextra path="/operations/ui/" >}}).

To save the configuration changes that you make in the UI, [store config in a database]({{< link-hextra path="/deployment/helm/storage/" >}}). In the default read-only storage mode, the UI shows the running configuration, but a save fails because the chart mounts the configuration file read-only.

{{% /steps %}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Return the UI to the admin interface only, and remove the extra Service.

   ```yaml
   cat <<'EOF' > values.yaml
   config:
     gateways:
       default:
         port: 4000
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

3. Delete the Secrets that you created.

   ```sh
   kubectl delete secret agentgateway-ui-oidc agentgateway-ui-client agentgateway-ui-tls \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

4. Remove the DNS record that you created for the UI hostname, and remove the UI client from your IdP.
