---
title: Windsurf
weight: 4
description: Connect Windsurf IDE to agentgateway
---

Configure Windsurf, the AI-powered code editor from Cognition (the makers of Devin), to use agentgateway as an MCP server.

## Before you begin

{{< reuse "agw-docs/standalone/prereq-mcp-clients.md" >}}

## Configuration

Add agentgateway to your Windsurf MCP configuration. Create or edit `~/.codeium/windsurf/mcp_config.json`. On Windows, this file is at `%USERPROFILE%\.codeium\windsurf\mcp_config.json`. Windsurf does not create this file automatically, so create it if it does not exist.

```json
{
  "mcpServers": {
    "agentgateway": {
      "serverUrl": "http://localhost:3000/mcp/http"
    }
  }
}
```

{{< callout type="info" >}}
For remote MCP servers, Windsurf uses the `serverUrl` field rather than the `url` field that some other clients use.
{{< /callout >}}

## Authentication

Include authentication headers if required:

```json
{
  "mcpServers": {
    "agentgateway": {
      "serverUrl": "http://localhost:3000/mcp/http",
      "headers": {
        "Authorization": "Bearer your-token-here"
      }
    }
  }
}
```

## Verifying the Connection

1. Open the Cascade panel in Windsurf.
2. Click the **MCPs** icon in the top right of the Cascade panel, or open **Settings** > **Cascade** > **MCP Servers**, then refresh the server list.
3. Confirm that the agentgateway tools appear in the available tools list.
