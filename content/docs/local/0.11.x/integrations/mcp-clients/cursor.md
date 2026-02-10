---
title: Cursor
weight: 2
description: Connect Cursor IDE to Agent Gateway
---

Configure Cursor, the AI-powered code editor, to use Agent Gateway as an MCP server.

## Configuration

Add Agent Gateway to your Cursor MCP settings. Create or edit `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "agentgateway": {
      "url": "http://localhost:15000/mcp/sse"
    }
  }
}
```

## Global Configuration

For global configuration across all projects, edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "agentgateway": {
      "url": "http://localhost:15000/mcp/sse"
    }
  }
}
```

## Using Streamable HTTP

For improved performance, use the streamable HTTP transport:

```json
{
  "mcpServers": {
    "agentgateway": {
      "url": "http://localhost:15000/mcp/http"
    }
  }
}
```

## Authentication

Include authentication headers if required:

```json
{
  "mcpServers": {
    "agentgateway": {
      "url": "http://localhost:15000/mcp/sse",
      "headers": {
        "Authorization": "Bearer your-token-here"
      }
    }
  }
}
```

## Verifying the Connection

After configuration, restart Cursor and check that Agent Gateway tools appear in the MCP tools list. You can verify connectivity by asking Cursor to list available tools.
