Use the agentgateway binary to proxy requests to an open source MCP test server, `server-everything`. Then, try a tool in the built-in agentgateway playground.

## Before you begin

{{< doc-test paths="mcp" >}}
# Install agentgateway binary
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

{{< reuse "agw-docs/standalone/quickstart/install-prereq.md" >}}

## Steps

{{< version include-if="1.2.x,1.1.x,1.0.x" >}}
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
# Redirect background output to a file so the started process doesn't keep the test
# runner's stdout pipe open (which would block the run from ever completing).
agentgateway -f config.yaml >/tmp/agentgateway.log 2>&1 &
AGW_PID=$!
# agentgateway starts the server-everything MCP server as a stdio child; reap the whole
# tree on exit so no orphaned node process holds the pipe open and hangs the job.
trap 'kill $AGW_PID 2>/dev/null || true; pkill -f "server-everything" 2>/dev/null || true' EXIT
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

{{< reuse-image src="img/1.2-earlier/agentgateway-ui-home.png" >}}

### Step 5: Connect and list tools in the Playground

1. Go to the [Playground](http://localhost:15000/ui/mcp/playground/).
2. In the **Testing** card, check the **Connection** URL (such as `http://localhost:3000/`) and click **Connect**. The UI connects to the MCP target and lists its tools.
3. Confirm that **Available Tools** shows tools from the server, such as `echo` or various `get` commands.

{{< reuse-image src="img/1.2-earlier/ui-playground-tools.png" >}}

### Step 6: Run a tool

1. In **Available Tools**, select the `echo` tool.
2. In the **Message** field, enter a string, such as `This is my first agentgateway setup`.
3. Click **Run Tool**.
4. Check the **Response** card for the echoed message.

{{< reuse-image src="img/1.2-earlier/ui-playground-tool-echo.png" >}}

{{% /steps %}}
{{< /version >}}

{{< version exclude-if="1.2.x,1.1.x,1.0.x" >}}
{{% steps %}}

### Step 1: Start the MCP test server

Run the open source `server-everything` MCP test server with the streamable HTTP transport.

```sh
PORT=3005 npx -y @modelcontextprotocol/server-everything streamableHttp
```

### Step 2: Configure agentgateway {#step-2-start-agentgateway}

<span id="step-3-enable-mcp"></span><span id="step-4-add-the-mcp-server"></span>

You can add the MCP server in the UI, or write it in a configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
Because you add the MCP server from the UI, you can start agentgateway without a config file. When you run `agentgateway` without specifying a config, it bootstraps a basic config at `~/.config/agentgateway/config.yaml` and uses it automatically.

1. Start agentgateway.

   ```sh
   agentgateway
   ```

   Example output:

   ```
   info  app  serving UI at http://localhost:4000/ui
   ```

2. Open the [agentgateway UI](http://localhost:4000/ui/). The first time that you run the UI, the **Welcome to Agentgateway** wizard opens. Click **Enable MCP**, and then click **Continue**. If you already did this, skip to the next step.

   {{< reuse-image-light src="img/ui-welcome-wizard.png" >}}
   {{< reuse-image-dark srcDark="img/ui-welcome-wizard-dark.png" >}}

   The **Gateway Overview** home page opens, with the **MCP** row enabled.

3. Add the MCP server.
   1. In the **MCP** section of the navigation menu, click **Servers**, and then click **Add server**.
   2. For the **Server name**, enter `server-everything`.
   3. Keep the **Streamable HTTP** transport. For the **URL**, enter `http://localhost:3005/mcp`.
   4. Click **Save server**.

   {{< reuse-image-light src="img/ui-mcp-add-server.png" >}}
   {{< reuse-image-dark srcDark="img/ui-mcp-add-server-dark.png" >}}
{{% /tab %}}
{{% tab name="Config file" %}}
1. Create a configuration file with the MCP server as a target. The configuration also serves the UI on the same gateway, so that you can use the playground in the next step.

   ```yaml
   cat > config.yaml << 'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 4000
   mcp:
     targets:
     - name: server-everything
       mcp:
         host: http://localhost:3005/mcp
   ui: {}
   EOF
   ```

2. Start agentgateway with the configuration file.

   ```sh
   agentgateway -f config.yaml
   ```

   Example output:

   ```
   info  app  serving UI at http://localhost:4000/ui
   ```
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="mcp" >}}
# Hidden test: runs the Config file tab's setup. The UI tab produces the same MCP target,
# but its clicks are not scriptable.
# Redirect background output to files so the started servers don't keep the test
# runner's stdout pipe open (which would block the run from ever completing).
PORT=3005 npx -y @modelcontextprotocol/server-everything streamableHttp >/tmp/mcp-server.log 2>&1 &
MCP_PID=$!
sleep 5
cat > config.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 4000
mcp:
  targets:
  - name: server-everything
    mcp:
      host: http://localhost:3005/mcp
ui: {}
EOF
agentgateway -f config.yaml >/tmp/agentgateway.log 2>&1 &
AGW_PID=$!
# On exit, reap the whole process tree. npx spawns a node child for the server, and
# killing npx alone orphans that child, which holds the pipe open and hangs the job.
trap 'kill $AGW_PID 2>/dev/null || true; pkill -P $MCP_PID 2>/dev/null || true; kill $MCP_PID 2>/dev/null || true; pkill -f "server-everything" 2>/dev/null || true' EXIT
sleep 3
{{< /doc-test >}}

### Step 3: Try a tool in the playground {#step-5-try-a-tool-in-the-playground}

1. In the [agentgateway UI](http://localhost:4000/ui/), click **Tool Playground** in the **MCP** section.
2. If you see a **Browser access is not allowed** notice, click **Apply CORS** so the playground can call the MCP listener from the UI.
3. Click **Initialize** to open an MCP session. The playground lists the tools that the server exposes, such as `echo` and various `get` commands.

   {{< reuse-image-light src="img/ui-playground-tools.png" >}}
   {{< reuse-image-dark srcDark="img/ui-playground-tools-dark.png" >}}

4. From the **Tool** dropdown list, select the `echo` tool. 
5. In the **Message** field, enter a string, such as `This is my first agentgateway setup`, and click **Call tool**.
6. Verify that the **Result** card shows an `HTTP 200` response with your message echoed back.

   {{< reuse-image-light src="img/ui-playground-tool-echo.png" >}}
   {{< reuse-image-dark srcDark="img/ui-playground-tool-echo-dark.png" >}}

{{% /steps %}}
{{< /version >}}


## Next steps

Check out more guides for using MCP servers with agentgateway.

{{< cards >}}
  {{< card path="/integrations/mcp/servers/stdio" title="stdio" subtitle="Connect to an MCP server via stdio" >}}
  {{< card path="/integrations/mcp/servers/virtual" title="Virtual MCP" subtitle="Federate multiple MCP servers." >}}
  {{< card path="/documentation/mcp/mcp-authn" title="OpenAPI" subtitle="Enable OAuth 2.0 protection for MCP servers." >}}
{{< /cards >}}
