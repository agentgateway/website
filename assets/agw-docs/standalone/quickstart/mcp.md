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

{{< reuse-image src="img/1.2-earlier/agentgateway-ui-home.png" alt="Earlier agentgateway UI Overview page with port bind, listener, route, and backend counts" >}}

### Step 5: Connect and list tools in the Playground

1. Go to the [Playground](http://localhost:15000/ui/mcp/playground/).
2. In the **Testing** card, check the **Connection** URL (such as `http://localhost:3000/`) and click **Connect**. The UI connects to the MCP target and lists its tools.
3. Confirm that **Available Tools** shows tools from the server, such as `echo` or various `get` commands.

{{< reuse-image src="img/1.2-earlier/ui-playground-tools.png" alt="Earlier agentgateway UI Playground page with a connected MCP route and a list of available tools" >}}

### Step 6: Run a tool

1. In **Available Tools**, select the `echo` tool.
2. In the **Message** field, enter a string, such as `This is my first agentgateway setup`.
3. Click **Run Tool**.
4. Check the **Response** card for the echoed message.

{{< reuse-image src="img/1.2-earlier/ui-playground-tool-echo.png" alt="Earlier agentgateway UI Playground page with the echo tool selected and its JSON response" >}}

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

   {{< reuse-image-light src="img/ui-welcome-wizard.png" alt="Welcome to Agentgateway dialog with Enable LLM, Enable MCP, and Traffic enabled options and a Continue button" >}}
   {{< reuse-image-dark srcDark="img/ui-welcome-wizard-dark.png" alt="Welcome to Agentgateway dialog with Enable LLM, Enable MCP, and Traffic enabled options and a Continue button" >}}

   The **Gateway Overview** home page opens, with the **MCP** row enabled.

3. Add the MCP server.
   1. In the **MCP** section of the navigation menu, click **Servers**, and then click **Add server**.
   2. For the **Server name**, enter `server-everything`.
   3. Keep the **Streamable HTTP** transport. For the **URL**, enter `http://localhost:3005/mcp`.
   4. Click **Save server**.

   {{< reuse-image-light src="img/ui-mcp-add-server.png" alt="Add MCP server drawer with the server name server-everything, the Streamable HTTP transport, and the URL http://localhost:3005/mcp" >}}
   {{< reuse-image-dark srcDark="img/ui-mcp-add-server-dark.png" alt="Add MCP server drawer with the server name server-everything, the Streamable HTTP transport, and the URL http://localhost:3005/mcp" >}}
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
# Hidden test: the UI steps below (Enable MCP -> Add server) are not scriptable, so this
# block reproduces the equivalent config they produce and starts the same backends, to keep
# the resulting setup tested.
# Redirect background output to files so the started servers don't keep the test
# runner's stdout pipe open (which would block the run from ever completing).
PORT=3005 npx -y @modelcontextprotocol/server-everything streamableHttp >/tmp/mcp-server.log 2>&1 &
MCP_PID=$!
sleep 5
cat > config.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  targets:
  - name: server-everything
    mcp:
      host: http://localhost:3005/mcp
EOF
agentgateway -f config.yaml >/tmp/agentgateway.log 2>&1 &
AGW_PID=$!
# On exit, reap the whole process tree. npx spawns a node child for the server, and
# killing npx alone orphans that child, which holds the pipe open and hangs the job.
trap 'kill $AGW_PID 2>/dev/null || true; pkill -P $MCP_PID 2>/dev/null || true; kill $MCP_PID 2>/dev/null || true; pkill -f "server-everything" 2>/dev/null || true' EXIT
sleep 3
{{< /doc-test >}}

### Step 3: Try a tool {#step-5-try-a-tool-in-the-playground}

You can try a tool in the UI playground or with curl. Both work the same way, whether you added the MCP server in the UI or in the config file.

{{< tabs >}}
{{% tab name="Playground" %}}

1. In the [agentgateway UI](http://localhost:4000/ui/), click **Tool Playground** in the **MCP** section.
2. If you see a **Browser access is not allowed** notice, click **Apply CORS** so the playground can call the MCP listener from the UI.
3. Click **Initialize** to open an MCP session. The playground lists the tools that the server exposes, such as `echo` and various `get` commands.

   {{< reuse-image-light src="img/ui-playground-tools.png" alt="MCP Playground with the echo tool selected and a list of 13 discovered tools in the Result panel" >}}
   {{< reuse-image-dark srcDark="img/ui-playground-tools-dark.png" alt="MCP Playground with the echo tool selected and a list of 13 discovered tools in the Result panel" >}}

4. From the **Tool** dropdown list, select the `echo` tool. 
5. In the **Message** field, enter a string, such as `This is my first agentgateway setup`, and click **Call tool**.
6. Verify that the **Result** card shows an `HTTP 200` response with your message echoed back.

   {{< reuse-image-light src="img/ui-playground-tool-echo.png" alt="MCP Playground with the echo tool selected, a message entered, and the tool output Echo: This is my first agentgateway setup." >}}
   {{< reuse-image-dark srcDark="img/ui-playground-tool-echo-dark.png" alt="MCP Playground with the echo tool selected, a message entered, and the tool output Echo: This is my first agentgateway setup." >}}
{{% /tab %}}
{{% tab name="curl" %}}
Send MCP requests to the gateway with curl. The streamable HTTP transport uses JSON-RPC messages in `POST` requests. Each request needs the `Accept: application/json, text/event-stream` header. After you initialize a session, each request also needs the `mcp-session-id` header that agentgateway returns.

1. Initialize an MCP session, and save the session ID from the `mcp-session-id` response header. Then, send the `notifications/initialized` message to finish the handshake.

   ```sh
   export MCP_SESSION_ID=$(curl -s -D - http://localhost:4000/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}' \
     | grep -i "mcp-session-id:" | sed 's/.*: //' | tr -d '\r')
   curl -s http://localhost:4000/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
   ```

2. List the tools that the server exposes. The `grep` command prints only the tool names from the response.

   ```sh
   curl -s http://localhost:4000/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
     | grep -o '"name":"[^"]*"'
   ```

   Example output:

   ```
   "name":"echo"
   "name":"get-annotated-message"
   "name":"get-env"
   "name":"get-resource-links"
   "name":"get-resource-reference"
   "name":"get-structured-content"
   "name":"get-sum"
   ...
   ```

3. Call the `echo` tool with the message `This is my first agentgateway setup`.

   ```sh
   curl -s http://localhost:4000/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"echo","arguments":{"message":"This is my first agentgateway setup"}}}'
   ```

4. Verify that the response echoes your message back.

   ```
   event: message
   data: {"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"Echo: This is my first agentgateway setup"}]}}
   ```
{{% /tab %}}
{{< /tabs >}}

{{% /steps %}}
{{< /version >}}


## Next steps

Check out more guides for using MCP servers with agentgateway.

{{< cards >}}
  {{< card path="/integrations/mcp/servers/stdio" title="stdio" subtitle="Connect to an MCP server via stdio" >}}
  {{< card path="/integrations/mcp/servers/virtual" title="Virtual MCP" subtitle="Federate multiple MCP servers." >}}
  {{< card path="/documentation/mcp/mcp-authn" title="OpenAPI" subtitle="Enable OAuth 2.0 protection for MCP servers." >}}
{{< /cards >}}
