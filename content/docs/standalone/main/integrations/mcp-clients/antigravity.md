---
title: Antigravity IDE
weight: 6
description: Connect Antigravity IDE to agentgateway
---

Configure Antigravity IDE to use agentgateway as an MCP server.

## Before you begin

{{< reuse "agw-docs/standalone/prereq-mcp-clients.md" >}}

## Configuration

Add agentgateway to your Antigravity IDE MCP configuration:

```json
{
  "mcpServers": {
    "agentgateway": {
      "serverUrl": "http://<your-mcp-server>/mcp/mcp"
    }
  }
}
```

## Verifying the Connection

After configuration, restart or refresh Antigravity IDE and check that agentgateway tools appear in the MCP tools list. You can verify connectivity by exploring the available tools within the IDE.
