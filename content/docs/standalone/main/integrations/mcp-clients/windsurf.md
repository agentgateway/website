---
title: Windsurf
weight: 4
description: Connect Windsurf IDE to agentgateway
---

Configure Windsurf, Codeium's AI-powered IDE, to use agentgateway as an MCP server.

## Configuration

Add agentgateway to your Windsurf MCP configuration. Create or edit `~/.windsurf/mcp.json`:

```json
{
  "mcpServers": {
    "agentgateway": {
      "url": "http://localhost:15000/mcp/sse"
    }
  }
}
```

## Project-Level Configuration

For project-specific settings, create `.windsurf/mcp.json` in your project root:

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

After configuration, restart Windsurf and verify that agentgateway tools are available in the Cascade agent's tool list.
