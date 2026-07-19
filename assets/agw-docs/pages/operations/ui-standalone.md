Use the agentgateway Admin UI to view and manage your standalone proxy configuration in real time.

## About

The agentgateway Admin UI is a built-in web interface that runs alongside the proxy on port 15000 by default. In standalone mode, the UI is fully interactive — you can inspect your current configuration and manage your proxy without restarting agentgateway.

The Admin UI is separate from the [Web UI integrations]({{< link-hextra path="/integrations/web-uis/" >}}), which are third-party AI chat frontends (such as Open WebUI or LibreChat) that you connect to agentgateway as a backend. The Admin UI is the management interface for agentgateway itself.

{{< doc-test paths="ui-standalone-default,ui-standalone-custom-port" >}}
# Install agentgateway binary for tests
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

## Open the Admin UI {#open-admin-ui}

1. Start agentgateway with a config file.

   ```sh
   agentgateway -f config.yaml
   ```

   Example output:

   ```
   INFO app  serving UI at http://localhost:15000/ui
   ```

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
{{< /doc-test >}}

2. Open [http://localhost:15000/ui/](http://localhost:15000/ui/) in your browser.

   {{< version exclude-if="1.2.x,1.1.x,1.0.x" >}}
   The Admin UI opens on the **Gateway Overview**, which lists the available capabilities (LLM, MCP, and Traffic) and lets you enable the ones you want to operate.

   {{< reuse-image-light src="img/agentgateway-ui-landing.png" >}}
   {{< reuse-image-dark srcDark="img/agentgateway-ui-landing-dark.png" >}}
   {{< /version >}}
   {{< version include-if="1.2.x,1.1.x,1.0.x" >}}
   The Admin UI dashboard shows your configured listeners and port bindings.

   {{< reuse-image-light src="img/1.2-earlier/agentgateway-ui-landing.png" >}}
   {{< reuse-image-dark srcDark="img/1.2-earlier/agentgateway-ui-landing-dark.png" >}}
   {{< /version >}}

{{< doc-test paths="ui-standalone-default" >}}
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

## Customize the Admin UI port {#customize-port}

By default, the Admin UI binds to `localhost:15000`. To use a different address or port, set `adminAddr` in the `config` section of your config file.

1. Add or update the `adminAddr` field in your config file. The value must use `ip:port` format.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   config:
     adminAddr: localhost:9090
   ```

2. Start agentgateway with the updated config.

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

{{< callout type="info" >}}
If you change <code>adminAddr</code>, update any agentgateway admin API commands to use the new address. For example, change <code>curl http://localhost:15000/logging</code> to use the new port.
{{< /callout >}}

{{< version exclude-if="1.3.x,1.2.x,1.1.x" >}}
## Secure the Admin UI {#secure-admin-ui}

By default, the Admin UI is served on the local admin interface (`localhost:15000`) with no authentication. Anyone who can reach the admin address can inspect and manage your configuration. To require users to authenticate, attach the UI to a gateway listener and apply a browser [OIDC]({{< link-hextra path="/configuration/security/oidc" >}}) policy. When you attach the UI to a gateway, it is served on that gateway's port instead of the admin address, and all UI traffic must pass the policies that you attach.

1. Set the `OIDC_COOKIE_SECRET` environment variable. Agentgateway requires this value to encrypt session cookies whenever an `oidc` policy is configured. Set it to a random value before you start the gateway.

   ```bash
   export OIDC_COOKIE_SECRET="$(python3 -c 'import os; print(os.urandom(32).hex())')"
   ```

2. Add a `ui` section to your config file that attaches to a gateway and applies an `oidc` policy. The following example serves the UI on the `default` gateway on port 3000 and redirects unauthenticated users to the OIDC provider to log in. The optional `authorization` policy further restricts access to users whose email address ends in `@example.com`.

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

3. Start agentgateway with the updated config.

   ```sh
   agentgateway -f config.yaml
   ```

4. Open the UI at the gateway's address, such as [http://localhost:3000/ui/](http://localhost:3000/ui/). Instead of loading the UI directly, agentgateway redirects you to the OIDC provider to log in. After you authenticate, you are returned to the UI.

For the full list of `oidc` policy fields and a complete runnable Keycloak setup, see [OIDC browser authentication]({{< link-hextra path="/configuration/security/oidc" >}}) and the [`traffic-unified-gateway` example](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-unified-gateway) in the agentgateway repository. You can attach other policies to UI traffic in the same way, such as `cors`, `jwtAuth`, `basicAuth`, or `apiKey`.
{{< /version >}}
