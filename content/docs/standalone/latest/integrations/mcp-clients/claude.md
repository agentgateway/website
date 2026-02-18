---
title: Claude
weight: 1
description: Connect Claude Desktop and Claude Code to agentgateway
---

Configure Anthropic's Claude Desktop app or Claude Code CLI to use agentgateway as an MCP server.

## Claude Desktop

Add agentgateway to your Claude Desktop configuration file:

{{< tabs items="macOS,Windows" >}}
{{< tab >}}
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentgateway": {
      "url": "http://localhost:15000/mcp/sse"
    }
  }
}
```
{{< /tab >}}
{{< tab >}}
Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentgateway": {
      "url": "http://localhost:15000/mcp/sse"
    }
  }
}
```
{{< /tab >}}
{{< /tabs >}}

## Claude Code CLI

Configure Claude Code to connect to agentgateway:

```bash
claude mcp add agentgateway --transport sse http://localhost:15000/mcp/sse
```

Or add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "agentgateway": {
      "type": "sse",
      "url": "http://localhost:15000/mcp/sse"
    }
  }
}
```

## Streamable HTTP Transport

For better performance, use the streamable HTTP transport:

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

If agentgateway requires authentication, include the token in the URL or headers:

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
