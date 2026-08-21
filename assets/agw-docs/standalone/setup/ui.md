Use the agentgateway admin UI to view and manage your standalone proxy configuration in real time.

## About

The agentgateway admin UI is a built-in web interface that runs alongside the proxy. It is fully interactive in standalone mode, so you can inspect your current configuration and manage your proxy without restarting agentgateway.

The admin UI is separate from the [Web UI integrations]({{< link-hextra path="/integrations/web-uis/" >}}), which are third-party AI chat frontends (such as Open WebUI or LibreChat) that you connect to agentgateway as a backend. The admin UI is the management interface for agentgateway itself.

### Where the UI is served

Agentgateway serves the UI in one of two places, and which one you get depends on your configuration file.

| Configuration | Where the UI is served | Who can reach it |
| --- | --- | --- |
| No `ui` section | The admin address, which is `localhost:15000` by default. | Anything that can reach the admin address. Loopback only, unless you change `config.adminAddr`. |
| A `ui` section with `gateways` | The port of each gateway that you list, on the `/ui` path. | Anything that can reach that gateway, subject to the policies in `ui.policies`. |

The admin API is served in the same place as the UI, so `/api/config/effective` and the other admin endpoints follow the same rule.

> [!WARNING]
> Neither location requires authentication by default. The admin address is loopback-only, so it is not reachable from another host unless you change it. A gateway listener, on the other hand, is as reachable as your other proxy traffic, so attach an authentication policy before you expose the UI. For more information, see [Secure the UI](#secure-the-ui).

{{< doc-test paths="ui-standalone-default,ui-standalone-custom-port" >}}
# Install agentgateway binary for tests
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

## Open the UI {#open-admin-ui}

{{< tabs >}}
{{% tab name="Binary" %}}
1. Start agentgateway with a configuration file.

   ```sh
   agentgateway -f config.yaml
   ```

   Agentgateway logs where it serves the UI.

   ```
   INFO app  serving UI at http://localhost:15000/ui
   ```

2. Open [http://localhost:15000/ui/](http://localhost:15000/ui/) in your browser.

   The admin UI opens on the **Gateway Overview**, which lists the available capabilities (LLM, MCP, and Traffic) and lets you enable the ones you want to operate.

   {{< reuse-image-light src="img/agentgateway-ui-landing.png" >}}
   {{< reuse-image-dark srcDark="img/agentgateway-ui-landing-dark.png" >}}

If you started agentgateway with no arguments instead, the generated configuration attaches the UI to the `default` gateway, so the UI is served at [http://localhost:4000/ui/](http://localhost:4000/ui/).
{{% /tab %}}
{{% tab name="Docker" %}}
The generated configuration that agentgateway writes into a mounted `/config` directory attaches the UI to the `default` gateway, so the UI is served on the gateway port that you published.

1. Confirm where the container serves the UI.

   ```sh
   docker logs <container-name> | grep "serving UI"
   ```

   Example output:

   ```txt
   INFO app  serving UI at http://localhost:4000/ui
   ```

2. Open [http://localhost:4000/ui/](http://localhost:4000/ui/) in your browser.

If you mounted your own configuration file that has no `ui` section, the UI is served on the admin address instead, which is not reachable from your host. See [Reach the admin UI in a container](#docker-admin-addr).
{{% /tab %}}
{{% tab name="Helm" %}}
The chart creates no Service for the admin port, so you reach the UI by port-forwarding the Deployment.

1. Port-forward the admin address.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} 15000:15000
   ```

2. In your browser, open the `/ui` path.

   ```sh
   open http://localhost:15000/ui
   ```

To serve the UI on its own gateway and hostname instead of a port-forward, see [Secure and expose the UI with Helm](#helm-expose).
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="ui-standalone-default" >}}
pkill -f "agentgateway -f" 2>/dev/null || true
sleep 1
cat > /tmp/agw-ui-default.yaml <<'EOF'
config:
  adminAddr: localhost:15000
EOF
agentgateway -f /tmp/agw-ui-default.yaml &
AGW_DEFAULT_PID=$!
sleep 3
YAMLTest -f - <<'EOF'
- name: Admin UI returns HTTP 200 on default port
  http:
    url: "http://localhost:15000/ui/"
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
  retries: 3
EOF
kill $AGW_DEFAULT_PID 2>/dev/null || true
{{< /doc-test >}}

## Change the admin address {#customize-port}

By default, the admin address is `localhost:15000`. To use a different address or port, set `adminAddr` in the `config` section of your configuration file. The value must use `ip:port` format, and also accepts `unix:/path/to/socket` or `off`.

1. Add or update the `adminAddr` field in your configuration file.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   config:
     adminAddr: localhost:9090
   ```

2. Start agentgateway with the updated config. Because `adminAddr` is in the `config` section, a running instance keeps the previous address until you restart it.

   ```sh
   agentgateway -f config.yaml
   ```

   Example output:

   ```
   INFO app  serving UI at http://localhost:9090/ui
   ```

{{< doc-test paths="ui-standalone-custom-port" >}}
pkill -f "agentgateway -f" 2>/dev/null || true
sleep 1
cat > /tmp/agw-ui-custom.yaml <<'EOF'
config:
  adminAddr: localhost:9090
EOF
agentgateway -f /tmp/agw-ui-custom.yaml &
AGW_CUSTOM_PID=$!
sleep 3
{{< /doc-test >}}

3. Open the UI at the new address. In this example, navigate to [http://localhost:9090/ui/](http://localhost:9090/ui/).

{{< doc-test paths="ui-standalone-custom-port" >}}
YAMLTest -f - <<'EOF'
- name: Admin UI returns HTTP 200 on custom port
  http:
    url: "http://localhost:9090/ui/"
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
  retries: 3
EOF
kill $AGW_CUSTOM_PID 2>/dev/null || true
{{< /doc-test >}}

> [!NOTE]
> If you change <code>adminAddr</code>, update any agentgateway admin API commands to use the new address. For example, change <code>curl http://localhost:15000/logging</code> to use the new port.

### Reach the admin UI in a container {#docker-admin-addr}

The default admin address binds to the container's own loopback interface, so publishing port 15000 with `-p 15000:15000` does not make it reachable from your host. You have two options.

* **Serve the UI on a gateway instead**, which is what the generated configuration does. This is the better option, because you can attach authentication policies to the gateway.
* **Bind the admin address to all interfaces** by setting `config.adminAddr` to `0.0.0.0:15000`, then publish that port. The admin address has no authentication. Do this only on a host where nothing untrusted can reach the published port.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   config:
     adminAddr: 0.0.0.0:15000
   gateways:
     default:
       port: 4000
   ```

   ```sh
   docker run \
     --user "$(id -u):$(id -g)" \
     -v "$PWD/config.yaml:/config.yaml" \
     -p 4000:4000 -p 15000:15000 \
     cr.agentgateway.dev/agentgateway:v{{< reuse "agw-docs/versions/n-patch.md" >}} \
     -f /config.yaml
   ```

## Generate LLM client settings {#client-setup}

The **LLM > Client Setup** page generates connection settings and snippets for curl, Claude Code, Claude Desktop, Codex CLI, OpenCode, Cursor, GitHub Copilot, Windsurf, and the OpenAI JavaScript and Python SDKs.

1. Configure at least one LLM model and, if the gateway requires client authentication, a [virtual API key]({{< link-hextra path="/llm/cost-controls/virtual-keys/" >}}).
2. Open the **LLM** > **Client Setup** page in the UI, such as [http://localhost:15000/ui/llm/client-setup](http://localhost:15000/ui/llm/client-setup).
3. Review the **Gateway base URL**, and select a model and virtual API key.
4. Select the client from the **Integration** dropdown, and copy the generated settings or snippet.

Client Setup does not create a route, model, authentication policy, or provider credential. It generates client-side values from the configuration that already exists. For client-specific prerequisites, see [LLM clients]({{< link-hextra path="/integrations/llm-clients/" >}}).

The selected model appears only in recipes that accept a model setting. For example, the Claude Desktop recipe outputs a gateway URL and API key, but does not configure a model name in Claude Desktop.

## Secure the UI {#secure-the-ui}

To require users to authenticate, attach the UI to a gateway listener and apply a browser [OIDC]({{< link-hextra path="/configuration/security/oidc/" >}}) policy. When you attach the UI to a gateway, it is served on that gateway's port instead of the admin address, and all UI traffic must pass the policies that you attach.

The `ui.policies` section takes the same policies that a route takes, so you can also use [JWT]({{< link-hextra path="/configuration/security/jwt-authn/" >}}), [basic]({{< link-hextra path="/configuration/security/basic-authn/" >}}), or [API key]({{< link-hextra path="/configuration/security/apikey-authn/" >}}) authentication for programmatic access. To restrict which authenticated users get in, add an [authorization policy]({{< link-hextra path="/configuration/security/http-authz/" >}}) alongside the authentication policy.

### Binary and Docker {#secure-binary-docker}

1. Set the `OIDC_COOKIE_SECRET` environment variable. Agentgateway requires this value to encrypt session cookies whenever an `oidc` policy is configured, and refuses to start without it. The key is an AES-256-GCM key, which is 32 random bytes encoded as 64 hexadecimal characters. It is a random value that you generate, not a value that your identity provider gives you.

   ```bash
   export OIDC_COOKIE_SECRET="$(openssl rand -hex 32)"
   ```

2. Add a `ui` section to your configuration file that attaches to a gateway and applies an `oidc` policy. The following example serves the UI on the `default` gateway on port 3000 and redirects unauthenticated users to the OIDC provider to log in. The optional `authorization` policy further restricts access to users whose email address ends in `@example.com`.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 3000
   ui:
     policies:
       oidc:
         issuer: http://localhost:7080/realms/agentgateway
         clientId: agentgateway-browser
         clientSecret: agentgateway-secret
         redirectURI: http://localhost:3000/oauth/callback
         scopes:
         - profile
         - email
       authorization:
         rules:
         - allow: jwt.email.endsWith("@example.com")
   ```

3. Start agentgateway with the updated config. In Docker, pass the environment variable to the container with `-e OIDC_COOKIE_SECRET`.

   ```sh
   agentgateway -f config.yaml
   ```

4. Open the UI at the gateway's address, such as [http://localhost:3000/ui/](http://localhost:3000/ui/). Instead of loading the UI directly, agentgateway redirects you to the OIDC provider to log in. After you authenticate, you are returned to the UI.

For the full list of `oidc` policy fields and a complete runnable Keycloak setup, see [OIDC browser authentication]({{< link-hextra path="/configuration/security/oidc" >}}) and the [`traffic-unified-gateway` example](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-unified-gateway) in the agentgateway repository.

### Secure and expose the UI with Helm {#helm-expose}

In a Helm installation, the UI needs a gateway of its own, an OIDC policy, TLS, and a Service, because the chart's defaults put the UI and your proxy traffic on the same address.

> [!WARNING]
> The `ui` section attaches to a gateway named `default` when you omit `ui.gateways`. Because the chart's default values include an empty `ui` section, a `default` gateway, and a `LoadBalancer` Service on port `80`, a default installation serves the UI and its APIs, including `/api/config`, on the same address as your proxy traffic. Complete this guide, or set `gateway.service.type` to `ClusterIP`, before you install the chart on a cluster that assigns external addresses.

#### Before you begin

1. [Install the standalone Helm chart]({{< link-hextra path="/setup/install/helm/" >}}).
2. Set up an identity provider (IdP), such as Keycloak or Microsoft Entra ID. Consider creating a client specifically for the UI, such as `agentgateway-ui`. For provider-specific setup instructions, see the [identity provider integrations]({{< link-hextra path="/integrations/auth/" >}}).
3. Get a TLS certificate and key for the hostname that you plan to serve the UI on, such as from your DNS provider or your organization's certificate authority.

#### Set up the gateway

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

   2. Send a request to the `/ui` path. Confirm that the request fails, because port `4000` now serves only your routes.

      ```sh
      curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/ui
      ```

      Example output:

      ```txt
      503
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

#### Secure the UI with OIDC

Add an authentication policy before you publicly expose the UI.

1. Save the details of the UI client that you created in your IdP as environment variables. The redirect URI must match the address that you expose the UI on in a later step, and it must be registered as a valid redirect URI in your IdP.

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
     -l app.kubernetes.io/name=agentgateway-standalone
   ```

6. Port-forward the UI port again, and confirm that an unauthenticated request is redirected to your IdP.

   ```sh
   curl -s -o /dev/null -D- http://localhost:4001/ui | grep -i location
   ```

   Example output:

   ```txt
   location: https://keycloak.example.com/realms/agentgateway/protocol/openid-connect/auth?response_type=code&client_id=agentgateway-ui&...
   ```

> [!IMPORTANT]
> Agentgateway fetches the OIDC discovery document at startup, so the issuer must be reachable from the pod. When the fetch fails, the pod does not start, and the logs report `failed to decode oidc discovery response from uri`. If the pod enters `CrashLoopBackOff` after you add the policy, check the issuer URL and any egress restrictions.

#### Expose the UI

Now that the UI requires a login, terminate TLS on the admin gateway and expose it on its own LoadBalancer Service.

Agentgateway reads the certificate and key from the file system, so you mount them into the pod from a Kubernetes Secret. Because the UI usually needs different exposure than proxy traffic, give it a separate Service instead of adding the port to the main Service.

1. Create a TLS Secret from the certificate and key for your UI hostname. This guide assumes that you already have a certificate for that hostname, such as one that you issued through your DNS provider or your organization's certificate authority. The certificate must be valid for the hostname that you create a DNS record for in a later step.

   ```sh
   kubectl create secret tls agentgateway-ui-tls \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --cert=ui-cert.pem --key=ui-key.pem
   ```

2. Mount the TLS Secret as a volume and configure the admin gateway to terminate TLS traffic on the gateway by using the certs from that Secret. You also expose the UI with a separate Service so that the UI and proxy traffic do not share the same service address. The chart names the extra Service `<release name>-<name>`, such as `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}-ui`.

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
   > A `kubernetes.io/tls` Secret stores the certificate as `tls.crt` and the key as `tls.key`, which is why the `cert` and `key` paths end with those file names. Setting `tls` on a gateway also switches the gateway protocol to HTTPS. For more certificate options, see [Gateways]({{< link-hextra path="/configuration/gateways/" >}}).

3. Upgrade the release with your values file.

   {{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

4. Confirm that the pod is running.

   ```sh
   kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -l app.kubernetes.io/name=agentgateway-standalone
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
   agentgateway-standalone-ui   LoadBalancer   10.xx.xxx.xx   34.xx.xxx.xx   443:31820/TCP   30s
   ```

6. In your DNS provider, create a DNS record that points your UI hostname, such as `agentgateway.example.com`, at the external address. The hostname must match both the certificate and the `REDIRECT_URI` value that you set earlier.

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

#### Log in to the UI

Now that the UI is securely exposed, log in.

1. In your browser, open the UI on your hostname, such as `https://agentgateway.example.com/ui`.
2. Verify that agentgateway redirects you to your IdP to log in.
3. Log in with a user from your IdP.
4. Verify that your IdP returns you to the UI, and that the admin UI opens on the **Gateway Overview**. The overview lists the available capabilities for LLM, MCP, and Traffic.

   {{< reuse-image src="img/agentgateway-ui-landing.png" srcDark="img/agentgateway-ui-landing-dark.png" >}}

To save the configuration changes that you make in the UI, see [Configuration storage]({{< link-hextra path="/setup/storage/" >}}). In the Helm chart's default read-only storage mode, the UI shows the running configuration, but a save fails because the chart mounts the configuration file read-only.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Return the UI to the admin address only, and remove the extra Service.

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

## Next steps

* [Configuration storage]({{< link-hextra path="/setup/storage/" >}}) to let the UI save your changes.
* [Update your configuration]({{< link-hextra path="/setup/update/" >}}) by editing the configuration file directly.
