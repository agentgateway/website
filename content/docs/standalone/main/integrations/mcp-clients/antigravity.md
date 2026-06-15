---
title: Antigravity IDE
weight: 6
description: Connect Antigravity IDE to agentgateway
---

Configure Antigravity IDE to use agentgateway as an MCP server.

## Before you begin

{{< reuse "agw-docs/standalone/prereq-mcp-clients.md" >}}

## Configuration

Add agentgateway to your Antigravity IDE MCP configuration. Set the `serverUrl` to your agentgateway proxy address, which defaults to `http://localhost:15000/mcp/http` for local deployments:

```json
{
  "mcpServers": {
    "agentgateway": {
      "serverUrl": "http://localhost:15000/mcp/http"
    }
  }
}
```

## Verify the Connection

1. Restart Antigravity IDE by closing the application and reopening it.
2. Check that agentgateway tools are in the MCP tools list (usually found in the **MCP** or **Tools** panel).
3. Click a tool, then click **Run** (or equivalent button). The tool execution verifies the connectivity with agentgateway.
