---
title: Claude
weight: 1
description: Connect Claude Desktop and Claude Code to agentgateway
---

Configure Anthropic's Claude Desktop app or Claude Code CLI to use agentgateway as an MCP server.

{{< callout type="info" >}}
This page covers connecting Claude as an **MCP client**. To proxy Claude Code's **LLM traffic** (prompts and responses) through agentgateway, see the [Claude Code LLM client guide]({{< link-hextra path="/integrations/llm-clients/claude-code" >}}).
{{< /callout >}}

## Before you begin

{{< reuse "agw-docs/standalone/prereq-mcp-clients.md" >}}

## Claude Desktop

Add agentgateway to your Claude Desktop configuration file.

{{< tabs >}}
{{< tab name="macOS" >}}
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentgateway": {
      "url": "http://localhost:3000/mcp/http"
    }
  }
}
```
{{< /tab >}}
{{< tab name="Windows" >}}
Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentgateway": {
      "url": "http://localhost:3000/mcp/http"
    }
  }
}
```
{{< /tab >}}
{{< /tabs >}}

## Claude Code CLI

Configure Claude Code to connect to agentgateway.

```bash
claude mcp add agentgateway --transport http http://localhost:3000/mcp/http
```

Or, add to your project's `.mcp.json`.

```json
{
  "mcpServers": {
    "agentgateway": {
      "type": "http",
      "url": "http://localhost:3000/mcp/http"
    }
  }
}
```

{{< callout type="warning" >}}
The SSE transport (`/mcp/sse`) is deprecated. Use the streamable HTTP transport (`/mcp/http`) for all new setups.
{{< /callout >}}

## Authentication

If agentgateway requires authentication, include the token in the URL or headers.

```json
{
  "mcpServers": {
    "agentgateway": {
      "url": "http://localhost:3000/mcp/http",
      "headers": {
        "Authorization": "Bearer your-token-here"
      }
    }
  }
}
```
