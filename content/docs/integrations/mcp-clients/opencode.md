---
title: OpenCode
weight: 3
description: Connect OpenCode to Agent Gateway
---

Configure OpenCode, the open source AI coding assistant, to use Agent Gateway as an MCP server.

## Configuration

Add Agent Gateway to your OpenCode configuration file `~/.opencode/config.json`:

```json
{
  "mcp": {
    "servers": {
      "agentgateway": {
        "type": "sse",
        "url": "http://localhost:15000/mcp/sse"
      }
    }
  }
}
```

## Project-Level Configuration

For project-specific configuration, create `.opencode/config.json` in your project root:

```json
{
  "mcp": {
    "servers": {
      "agentgateway": {
        "type": "sse",
        "url": "http://localhost:15000/mcp/sse"
      }
    }
  }
}
```

## Using Streamable HTTP

For improved performance, use the streamable HTTP transport:

```json
{
  "mcp": {
    "servers": {
      "agentgateway": {
        "type": "http",
        "url": "http://localhost:15000/mcp/http"
      }
    }
  }
}
```

## Authentication

Include authentication if required:

```json
{
  "mcp": {
    "servers": {
      "agentgateway": {
        "type": "sse",
        "url": "http://localhost:15000/mcp/sse",
        "headers": {
          "Authorization": "Bearer your-token-here"
        }
      }
    }
  }
}
```
