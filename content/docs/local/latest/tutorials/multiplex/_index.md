---
title: Multiplex MCP Servers
weight: 2
description: Combine multiple MCP servers behind a single endpoint
---

Aggregate tools from multiple MCP servers into a single endpoint.

## What you'll build

In this tutorial, you'll:
1. Configure Agent Gateway to multiplex multiple MCP servers
2. Combine a time server (Python) and an everything server (Node.js)
3. Access all tools through a single unified endpoint
4. Test tools with automatic server name prefixing

## Prerequisites

- [Node.js](https://nodejs.org/) installed
- [uv](https://docs.astral.sh/uv/) installed (for Python MCP servers)

## Step 1: Install Agent Gateway

```bash
curl -sL https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/common/scripts/get-agentgateway | bash
```

## Step 2: Create the config

```bash
cat > config.yaml << 'EOF'
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        cors:
          allowOrigins: ["*"]
          allowHeaders: [mcp-protocol-version, content-type, cache-control]
          exposeHeaders: ["Mcp-Session-Id"]
      backends:
      - mcp:
          targets:
          - name: time
            stdio:
              cmd: uvx
              args: ["mcp-server-time"]
          - name: everything
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
EOF
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

## Step 4: View backends in the UI

Go to [http://localhost:15000/ui/](http://localhost:15000/ui/) and click **Backends** to see your multiplexed MCP servers:

![Multiplex Backends](/images/tutorials/multiplex-backends.png)

The UI shows:
- **1 total backend** with **1 MCP** configuration
- **MCP: time, everything** - Both servers combined into one backend
- **2 targets** - `uvx mcp-server-time` and the everything server

## Step 5: Test in the Playground

Click **Playground** to test your multiplexed tools:

![Multiplex Playground](/images/tutorials/multiplex-playground.png)

1. Select **Route 1** in the Routes panel
2. Click **Connect** to discover all tools
3. **Available Tools** shows tools from both servers:
   - `time_get_current_time` - Get current time in a specific timezone
   - `time_convert_time` - Convert time between timezones
   - `everything_echo` - Echoes back the input
   - `everything_add` - Adds two numbers
   - And more...

Notice tools are prefixed with their server name (`time_` and `everything_`).

## Step 6: Run a tool

1. Click on **time_get_current_time** in the Available Tools list
2. Enter a timezone (e.g., `America/New_York`)
3. Click **Run Tool**

You'll see the current time in the response panel.

---

## What's happening?

Agent Gateway federates multiple MCP servers:

```
┌─────────────────────────────────────────────┐
│              Agent Gateway                   │
│                 :3000                        │
├─────────────────────────────────────────────┤
│  time_*        →  mcp-server-time           │
│  everything_*  →  server-everything         │
└─────────────────────────────────────────────┘
```

- Tools are automatically prefixed with the target name
- Clients connect to one endpoint and access all tools
- Each backend MCP server runs as a subprocess

## Next Steps

{{< cards >}}
  {{< card link="/docs/tutorials/openapi" title="OpenAPI to MCP" subtitle="Expose REST APIs as tools" >}}
  {{< card link="/docs/tutorials/authorization" title="Authorization" subtitle="Add JWT authentication" >}}
  {{< card link="/docs/mcp/connect/multiplex" title="Multiplexing Guide" subtitle="Advanced options" >}}
{{< /cards >}}
