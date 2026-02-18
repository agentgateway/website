---
title: MCP
weight: 12
description: Connect to an MCP server and try tools in the agentgateway playground.
---

Use the agentgateway binary to proxy requests to an open source MCP test server, `server-everything`. Then, try a tool in the built-in agentgateway playground.

## Before you begin

- [Install the agentgateway binary]({{< link-hextra path="/quickstart/#binary" >}}).
- Install [Node.js](https://nodejs.org/) (to run the MCP server via `npx`).

## Steps

{{% steps %}}

### Step 1: Download a basic configuration

Download the basic MCP example configuration.

```sh
curl -L https://agentgateway.dev/examples/basic/config.yaml -o config.yaml
```

### Step 2: Review the configuration

Inspect the file to see how the listener, route, and MCP backend are defined.

```sh
cat config.yaml
```

{{% github-yaml url="https://agentgateway.dev/examples/basic/config.yaml" %}}

{{< reuse "agw-docs/snippets/review-table.md" >}}

{{< reuse "agw-docs/snippets/example-basic-mcp.md" >}}

### Step 3: Start agentgateway

Run agentgateway with the config file.

```sh
agentgateway -f config.yaml
```

Example output:

```
info  state_manager  loaded config from File("config.yaml")
info  app            serving UI at http://localhost:15000/ui
info  proxy::gateway started bind  bind="bind/3000"
```

### Step 4: Explore the UI

Open the [agentgateway UI on the default port 15000](http://localhost:15000/ui) in your browser.

- **Listeners**: Review the listener on port 3000.
- **Routes**: Review the route for the MCP backend.
- **Backends**: Review the MCP target (`server-everything`).
- **Policies**: Review route and backend policies.

You can change listener, route, and backend configuration in the UI. Any updates you make apply immediately without restarting agentgateway.

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
  {{< card link="../../mcp/connect/stdio" title="stdio" subtitle="Local process-based MCP servers." >}}
  {{< card link="../../mcp/connect/multiplex" title="MCP multiplexing" subtitle="Federate multiple MCP servers." >}}
  {{< card link="../../mcp/connect/openapi" title="OpenAPI" subtitle="Connect to an OpenAPI server." >}}
{{< /cards >}}
