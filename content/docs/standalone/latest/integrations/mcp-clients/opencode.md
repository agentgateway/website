---
title: OpenCode
weight: 3
description: Connect OpenCode to agentgateway
---

Configure OpenCode, the open source AI coding assistant, to use agentgateway as an MCP server.

## Before you begin

{{< reuse "agw-docs/standalone/prereq-mcp-clients.md" >}}

## Configuration

Add agentgateway to your OpenCode configuration file `~/.opencode/config.json`:

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

## Project-Level Configuration

For project-specific configuration, create `.opencode/config.json` in your project root:

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
        "type": "http",
        "url": "http://localhost:15000/mcp/http",
        "headers": {
          "Authorization": "Bearer your-token-here"
        }
      }
    }
  }
}
```

{{< callout type="warning" >}}
The SSE transport (`type: sse`, `/mcp/sse`) is deprecated and should not be used. Use the streamable HTTP transport shown above instead.
{{< /callout >}}
