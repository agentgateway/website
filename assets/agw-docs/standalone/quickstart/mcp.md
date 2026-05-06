Use the agentgateway binary to proxy requests to an open source MCP test server, `server-everything`. Then, try a tool in the built-in agentgateway playground.

## Before you begin

{{< doc-test paths="mcp" >}}
# Install agentgateway binary
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/n-patch.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"
{{< /doc-test >}}

1. [Install the agentgateway binary]({{< link-hextra path="/deployment/binary" >}}).

   ```sh
   curl -sL https://agentgateway.dev/install | bash
   ```

## Steps

{{% steps %}}

### Step 1: Create the configuration

Create a `config.yaml` that defines an MCP target for the `server-everything` test server. This configuration uses the simplified MCP format.

```yaml {paths="mcp"}
cat > config.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

mcp:
  port: 3000
  targets:
  - name: server-everything
    stdio:
      cmd: npx
      args:
      - -y
      - "@modelcontextprotocol/server-everything"
EOF
```

You can also connect to a remote MCP server by using the `mcp` transport instead of `stdio`:

```yaml
mcp:
  port: 3000
  targets:
  - name: remote-mcp
    mcp:
      host: http://localhost:3005/mcp/
```

### Step 2: Review the configuration

Inspect the file to see how the simplified `mcp` field defines the port and targets.

```sh {paths="mcp"}
cat config.yaml
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

{{< reuse "agw-docs/snippets/example-basic-mcp.md" >}}

### Step 3: Start agentgateway

Run agentgateway with the config file.

```sh
agentgateway -f config.yaml
```

{{< doc-test paths="mcp" >}}
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3
{{< /doc-test >}}

Example output:

```
info  state_manager  loaded config from File("config.yaml")
info  app            serving UI at http://localhost:15000/ui
info  proxy::gateway started bind  bind="bind/3000"
```

### Step 4: Explore the UI

Open the [agentgateway UI on the default port 15000](http://localhost:15000/ui) in your browser.

- **Port**: Review the listening port (3000).
- **Targets**: Review the MCP target (`server-everything`).
- **Policies**: Review configured policies.

You can change the target and port configurations in the UI. Any updates you make apply immediately without restarting agentgateway.

{{< reuse-image src="img/agentgateway-ui-home.png" >}}

### Step 5: Connect and list tools in the Playground

1. Go to the [Playground](http://localhost:15000/ui/playground/).
2. In the **Testing** card, check the **Connection** URL (such as `http://localhost:3000/`) and click **Connect**. The UI connects to the MCP target and lists its tools.
3. Confirm that **Available Tools** shows tools from the server, such as `echo` or various `get` commands.

{{< reuse-image src="img/ui-playground-tools.png" >}}

### Step 6: Run a tool

1. In **Available Tools**, select the `echo` tool.
2. In the **message** field, enter a string, such as `This is my first agentgateway setup`.
3. Click **Run Tool**.
4. Check the **Response** card for the echoed message.

{{< reuse-image src="img/ui-playground-tool-echo.png" >}}

{{% /steps %}}

## Next steps

Check out more guides for using MCP servers with agentgateway.

{{< cards >}}
  {{< card path="/mcp/connect/stdio" title="stdio" subtitle="Connect to an MCP server via stdio" >}}
  {{< card path="/mcp/connect/virtual" title="Virtual MCP" subtitle="Federate multiple MCP servers." >}}
  {{< card path="/mcp/mcp-authn" title="OpenAPI" subtitle="Enable OAuth 2.0 protection for MCP servers." >}}
{{< /cards >}}
