---
title: VS Code
weight: 5
description: Connect VS Code with GitHub Copilot to Agent Gateway
---

Configure Visual Studio Code with GitHub Copilot's MCP extension to use Agent Gateway.

## Prerequisites

- VS Code with GitHub Copilot extension installed
- GitHub Copilot Chat enabled
- MCP support enabled in Copilot settings

## Configuration

Add Agent Gateway to your VS Code settings. Open settings (`Cmd/Ctrl + ,`) and add to `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "agentgateway": {
      "url": "http://localhost:15000/mcp/sse"
    }
  }
}
```

## Workspace Configuration

For workspace-specific configuration, add to `.vscode/settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
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
  "github.copilot.chat.mcp.servers": {
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
  "github.copilot.chat.mcp.servers": {
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

After configuration:

1. Reload VS Code (`Cmd/Ctrl + Shift + P` → "Developer: Reload Window")
2. Open GitHub Copilot Chat
3. Type `@agentgateway` to see available tools from Agent Gateway
