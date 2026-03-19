Use the agentgateway Admin UI to view and manage your standalone proxy configuration in real time.

## About

The agentgateway Admin UI is a built-in web interface that runs alongside the proxy on port 15000 by default. In standalone mode, the UI is fully interactive — you can inspect your current configuration and manage your proxy without restarting agentgateway.

The Admin UI is separate from the [Web UI integrations]({{< link-hextra path="/integrations/web-uis/" >}}), which are third-party AI chat frontends (such as Open WebUI or LibreChat) that you connect to agentgateway as a backend. The Admin UI is the management interface for agentgateway itself.

{{< doc-test paths="ui-standalone-default ui-standalone-custom-port" >}}
# Install agentgateway binary for tests
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/patch-dev.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"
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

   The Admin UI dashboard shows your configured listeners and port bindings.

   {{< reuse-image src="img/agentgateway-ui-landing.png" >}}
   {{< reuse-image-dark srcDark="img/agentgateway-ui-landing-dark.png" >}}

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
