## About

Now that the UI requires a login, serve it over HTTPS on a hostname of your own so that people outside the machine or cluster can reach it. Agentgateway terminates TLS on the gateway that serves the UI, and it reads the certificate and key from the file system.

How the address becomes reachable depends on your installation method.

* **Kubernetes** gives the UI an external address through a LoadBalancer Service. Because the UI usually needs different exposure than proxy traffic, give it a Service of its own instead of adding the port to the main Service.
* **A binary or a container** has no equivalent, so you provide the network path yourself. Gateway listeners bind to all network interfaces, unlike the admin interface, so a UI gateway is already reachable from other hosts that can route to the machine. To publish it more widely, do the following:
   * Run agentgateway on a host that has the address you want to serve the UI on, such as a VM with a public IP address.
   * Allow the gateway port through the host's firewall. In Docker, publish the port with `-p`.
   * Create a DNS record that points your UI hostname at that host. The hostname must match your TLS certificate and the `redirectURI` value in the `oidc` policy.

   You can also put your own reverse proxy or cloud load balancer in front of the host. In that case, terminate TLS on the proxy instead of on the gateway, and forward traffic to the gateway port.

## Before you begin

1. [Serve the UI on its own gateway]({{< link-hextra path="/documentation/setup/ui/gateway-ui/" >}}). The examples on this page expose the `ui-gateway` on port `4001` that you created in that guide.
2. [Secure the UI]({{< link-hextra path="/documentation/setup/ui/secure-ui/" >}}) with an authentication policy. Add the policy before you expose the UI, because a gateway listener is as reachable as your other proxy traffic.
3. Get a TLS certificate and key for the hostname that you plan to serve the UI on, such as from your DNS provider or your organization's certificate authority.
4. Create a DNS record that points that hostname at the address you expose in the steps on this page. The hostname must match both the certificate and the `redirectURI` value in your `oidc` policy.

## Binary and Docker

1. Add a `tls` section to the gateway that the UI is attached to. Agentgateway reads the certificate and key from the file system, and setting `tls` also switches the gateway protocol to HTTPS. Use the certificate for the hostname that you created a DNS record for.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 4000
     ui-gateway:
       port: 4001
       tls:
         cert: /etc/agentgateway/tls/tls.crt
         key: /etc/agentgateway/tls/tls.key
   ```

2. Start agentgateway with the updated configuration.

   {{< tabs >}}
   {{% tab name="Binary" %}}
   The `cert` and `key` paths are paths on the host that agentgateway runs on, so put the files at those paths, or change the paths in the configuration to where your files already are. No mount is involved.

   ```sh
   agentgateway -f config.yaml
   ```
   {{% /tab %}}
   {{% tab name="Docker" %}}
   The `cert` and `key` paths are paths inside the container, so mount the directory that holds the certificate and key at the parent path. The following example mounts a local `tls` directory that holds `tls.crt` and `tls.key` at `/etc/agentgateway/tls`.

   ```sh
   docker run -d \
     --name agentgateway \
     --user "$(id -u):$(id -g)" \
     -v "$PWD/config.yaml:/config.yaml" \
     -v "$PWD/tls:/etc/agentgateway/tls:ro" \
     -p 4000:4000 -p 4001:4001 \
     -e OIDC_COOKIE_SECRET \
     -e ISSUER_URL -e UI_CLIENT_ID -e UI_CLIENT_SECRET -e REDIRECT_URI \
     {{< reuse "agw-docs/standalone/image-ref.md" >}}:{{< reuse "agw-docs/versions/image-tag.md" >}} \
     -f /config.yaml
   ```
   {{% /tab %}}
   {{< /tabs >}}

3. Confirm that the gateway serves your certificate.

   ```sh
   echo | openssl s_client -connect agentgateway.example.com:4001 \
     -servername agentgateway.example.com 2>/dev/null | openssl x509 -noout -subject -dates
   ```

   Example output:

   ```txt
   subject=CN=agentgateway.example.com
   notBefore=Aug 24 17:20:56 2026 GMT
   notAfter=Sep 23 17:20:56 2026 GMT
   ```

For more certificate options, see [Gateways]({{< link-hextra path="/documentation/configuration/gateways/" >}}).

## Helm

1. Create a TLS Secret from the certificate and key for your UI hostname. The certificate must be valid for the hostname that you created a DNS record for.

   ```sh
   kubectl create secret tls agentgateway-ui-tls \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --cert=ui-cert.pem --key=ui-key.pem
   ```

2. Mount the TLS Secret as a volume and configure the `ui-gateway` to terminate TLS traffic on the gateway by using the certs from that Secret. You also expose the UI with a separate Service so that the UI and proxy traffic do not share the same service address. The chart names the extra Service `<release name>-<name>`, such as `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}-ui`.

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
       ui-gateway:
         port: 4001
         tls:
           cert: /etc/agentgateway/tls/tls.crt
           key: /etc/agentgateway/tls/tls.key
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
   oidc:
     cookieSecretName: agentgateway-ui-secrets
   extraEnv:
   - name: UI_CLIENT_SECRET
     valueFrom:
       secretKeyRef:
         name: agentgateway-ui-secrets
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
   > A `kubernetes.io/tls` Secret stores the certificate as `tls.crt` and the key as `tls.key`, which is why the `cert` and `key` paths end with those file names. Setting `tls` on a gateway also switches the gateway protocol to HTTPS. For more certificate options, see [Gateways]({{< link-hextra path="/documentation/configuration/gateways/" >}}).

3. Upgrade the release with your values file.

   {{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

4. Confirm that the pod is running.

   ```sh
   kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -l app.kubernetes.io/name={{< reuse "agw-docs/standalone/helm-standalone-chart-name.md" >}}
   ```

5. Get the external address of the UI Service, such as `34.xx.xxx.xx` in the following example.

   {{< reuse "agw-docs/snippets/kind-loadbalancer-tip.md" >}}

   ```sh
   kubectl get svc {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}-ui \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Example output:

   ```txt
   NAME                         TYPE           CLUSTER-IP     EXTERNAL-IP    PORT(S)         AGE
   {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}-ui   LoadBalancer   10.xx.xxx.xx   34.xx.xxx.xx   443:31820/TCP   30s
   ```

6. In your DNS provider, point your UI hostname, such as `agentgateway.example.com`, at the external address.

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

   Example output:

   ```
   location: https://keycloak.example.com/realms/agentgateway/protocol/openid-connect/auth?response_type=code&client_id=agentgateway-ui&...
   ```

## Log in to the UI

The login flow is the same in every installation method, because the `oidc` policy is on the gateway and not on the installation. Use your UI hostname if you exposed the UI on one, or the local gateway address if you are still testing on your own machine.

1. In your browser, open the UI on your hostname, such as `https://agentgateway.example.com/ui`. In a local binary or Docker setup, use the gateway address instead, such as `http://localhost:4001/ui`.
2. Verify that agentgateway redirects you to your IdP to log in.
3. Log in with a user from your IdP.
4. Verify that your IdP returns you to the UI, and that the UI opens on the **Gateway Overview**. The overview lists the available capabilities for LLM, MCP, and Traffic.

   {{< reuse-image src="img/agentgateway-ui-landing.png" srcDark="img/agentgateway-ui-landing-dark.png" >}}

For what you can do from here, see [Launch the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}).

To save the configuration changes that you make in the UI, see [Configuration storage]({{< link-hextra path="/documentation/setup/storage/" >}}). In the Helm chart's default read-only storage mode, the UI shows the running configuration, but a save fails because the chart mounts the configuration file read-only.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

{{< tabs >}}
{{% tab name="Binary and Docker" %}}
1. Remove the `tls` section and the `ui.policies` section from your configuration file, and remove the `ui-gateway` if you no longer want a separate UI port.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 4000
   ui:
     gateways: default
   ```

2. Restart agentgateway with the updated configuration.

3. Remove the DNS record that you created for the UI hostname, and remove the UI client from your IdP.
{{% /tab %}}
{{% tab name="Helm" %}}
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
   kubectl delete secret agentgateway-ui-secrets agentgateway-ui-tls \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

4. Remove the DNS record that you created for the UI hostname, and remove the UI client from your IdP.
{{% /tab %}}
{{< /tabs >}}

## Next steps

* [Choose where configuration is stored]({{< link-hextra path="/documentation/setup/storage/" >}}) so that the UI can save your changes.
* [Update your configuration]({{< link-hextra path="/documentation/setup/update/" >}}) by editing the configuration file directly.
