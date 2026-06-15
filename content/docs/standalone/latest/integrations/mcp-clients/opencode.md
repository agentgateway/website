---
title: OpenCode
weight: 3
description: Connect OpenCode to agentgateway
---

Configure OpenCode, the open source AI coding assistant, to use agentgateway as an MCP server.

## Before you begin

{{< reuse "agw-docs/standalone/prereq-mcp-clients.md" >}}

## Configuration

Add agentgateway to your OpenCode configuration file `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "agentgateway": {
      "type": "remote",
      "url": "http://localhost:3000/mcp/http"
    }
  }
}
```

## Project-Level Configuration

For project-specific configuration, create `opencode.json` in your project root:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "agentgateway": {
      "type": "remote",
      "url": "http://localhost:3000/mcp/http"
    }
  }
}
```

## Authentication

Include authentication if required:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "agentgateway": {
      "type": "remote",
      "url": "http://localhost:3000/mcp/http",
      "headers": {
        "Authorization": "Bearer your-token-here"
      }
    }
  }
}
```
