---
title: Basic MCP Server
weight: 1
description: Get started with Agent Gateway by exposing a single MCP server
---

Get up and running with Agent Gateway in under 2 minutes.

## What you'll build

In this tutorial, you'll:
1. Install and run Agent Gateway
2. Connect to a sample MCP server with demo tools
3. Use the Admin UI to explore your configuration
4. Test tools in the built-in Playground

## Prerequisites

- [Node.js](https://nodejs.org/) installed (for the MCP server)

## Step 1: Install Agent Gateway

```bash
curl -sL https://agentgateway.dev/install | bash
```

## Step 2: Download the example config

```bash
curl -sL https://raw.githubusercontent.com/agentgateway/agentgateway/main/examples/basic/config.yaml -o config.yaml
```

## Step 3: Start Agent Gateway

```bash
agentgateway -f config.yaml
```

You should see:

```
INFO agentgateway: Listening on 0.0.0.0:3000
INFO agentgateway: Admin UI available at http://localhost:15000/ui/
```

## Step 4: Open the UI

Open your browser and go to [http://localhost:15000/ui/](http://localhost:15000/ui/)

You'll see the Agent Gateway dashboard showing your configured listeners:

![Port Binds & Listeners](/images/tutorials/basic-listeners.png)

The UI shows:
- **Port 3000** is bound with 1 listener
- **listener-1** using HTTP protocol
- **1 backend** configured (your MCP server)

## Step 5: Test in the Playground

Click **Playground** in the left sidebar to test your MCP server.

![Playground](/images/tutorials/basic-playground.png)

1. In **Routes**, select **Route 1** (your MCP route)
2. The **Testing** panel shows your connection at `http://localhost:3000/`
3. Click **Connect** (or it auto-connects)
4. **Available Tools** shows all tools from your MCP server:
   - `echo` - Echoes back the input
   - `add` - Adds two numbers
   - `longRunningOperation` - Demonstrates progress updates
   - And more...

## Step 6: Run a tool

1. Click on **echo** in the Available Tools list
2. In the right panel, enter a message in the **message** field
3. Click **Run Tool**

You'll see the response in the **Response** panel:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Echo: Hello from Agent Gateway!"
    }
  ]
}
```

---

## What's in the config?

```yaml
binds:
- port: 3000              # Listen on port 3000
  listeners:
  - routes:
    - policies:
        cors:             # Allow browser connections
          allowOrigins: ["*"]
          allowHeaders: [mcp-protocol-version, content-type, cache-control]
          exposeHeaders: ["Mcp-Session-Id"]
      backends:
      - mcp:
          targets:
          - name: everything
            stdio:        # Run a local MCP server
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
```

- **Listens on port 3000** for MCP client connections
- **Enables CORS** so browser-based clients can connect
- **Runs the "everything" MCP server** which provides sample tools

## Next Steps

{{< cards >}}
  {{< card link="/docs/tutorials/multiplex" title="Multiplex" subtitle="Combine multiple MCP servers" >}}
  {{< card link="/docs/tutorials/openapi" title="OpenAPI to MCP" subtitle="Expose REST APIs as tools" >}}
  {{< card link="/docs/tutorials/authorization" title="Authorization" subtitle="Add JWT authentication" >}}
{{< /cards >}}
