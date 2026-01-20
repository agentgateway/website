---
title: MCP Federation
weight: 3
description: Learn how to federate tools from multiple MCP servers through a single endpoint
---

Expose a single MCP endpoint that aggregates tools from multiple backend servers with unified security.

## What you'll build

In this tutorial, you'll:
1. Configure Agent Gateway to federate multiple MCP servers
2. Combine filesystem and memory servers into a single endpoint
3. Access tools from both servers with automatic name prefixing
4. Test federated tools in the Playground

## Prerequisites

- [Node.js](https://nodejs.org/) installed

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
          - name: filesystem
            stdio:
              cmd: npx
              args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
          - name: memory
            stdio:
              cmd: npx
              args: ["-y", "@modelcontextprotocol/server-memory"]
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

Go to [http://localhost:15000/ui/](http://localhost:15000/ui/) and click **Backends** to see your federated MCP servers:

![MCP Federation Backends](/images/tutorials/mcp-federation-backends.png)

The UI shows:
- **1 total backend** with **1 MCP** configuration
- **MCP: filesystem, memory** - Both servers combined into one backend
- **2 targets** - The filesystem and memory MCP servers

## Step 5: Test in the Playground

Click **Playground** to test your federated tools:

![MCP Federation Playground](/images/tutorials/mcp-federation-playground.png)

1. Select **Route 1** in the Routes panel
2. Click **Connect** to discover all tools
3. **Available Tools** shows tools from both servers:
   - `filesystem_read_file` - Read the complete contents of a file
   - `filesystem_read_text_file` - Read file contents as text
   - `filesystem_write_file` - Create or overwrite a file
   - `filesystem_list_directory` - List directory contents
   - And more...

Notice tools are prefixed with their server name (`filesystem_` and `memory_`).

## Step 6: Run a tool

1. Click on **filesystem_read_text_file** in the Available Tools list
2. Enter a path (e.g., `/tmp/test.txt`)
3. Click **Run Tool**

You'll see the file contents in the response panel.

---

## Adding more servers

Add GitHub tools (requires a token):

```bash
export GITHUB_TOKEN=your-github-token
```

```yaml
targets:
- name: filesystem
  stdio:
    cmd: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
- name: github
  stdio:
    cmd: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
  env:
    GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_TOKEN}"
```

## Next Steps

{{< cards >}}
  {{< card link="/docs/tutorials/authorization" title="Authorization" subtitle="Add JWT authentication" >}}
  {{< card link="/docs/tutorials/mcp-authentication" title="MCP Auth" subtitle="OAuth-based authentication" >}}
  {{< card link="/docs/mcp/" title="MCP Overview" subtitle="Understanding MCP connectivity" >}}
{{< /cards >}}
