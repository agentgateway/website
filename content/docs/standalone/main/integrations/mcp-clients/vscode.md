---
title: VS Code
weight: 5
description: Connect VS Code with GitHub Copilot to agentgateway
---

Configure Visual Studio Code to use **agentgateway** via GitHub Copilot's native MCP support.

## Before You Begin

* **VS Code (1.92+)** with the **GitHub Copilot** extension installed.
* **GitHub Copilot Chat** enabled.
* **Agent Mode** active (MCP tools are primarily utilized when Copilot is in "Agent" mode).

## Configuration Locations

VS Code now reads MCP configurations from two primary locations. You no longer need to bury these in the giant `settings.json` file, though that still works.

1. **Global (All Projects):** Create or edit `%USERPROFILE%\.mcp.json` (Windows) or `~/.mcp.json` (macOS/Linux).
2. **Workspace (Current Project):** Create or edit `.vscode/mcp.json` in your project root.

## Server Configuration

Add the following to your `mcp.json` file:

```json
{
  "servers": {
    "agentgateway": {
      "type": "http",
      "url": "http://localhost:15000/mcp"
    }
  }
}
```

## Authentication

You have two ways to handle security, depending on your setup:

### Option 1: Native MCP Authentication Flow

If your agentgateway is configured to use an OIDC/OAuth provider (like Okta or Entra ID), VS Code will automatically detect the challenge and prompt you to "Sign In" via a browser pop-up.

```json
{
  "servers": {
    "agentgateway": {
      "type": "http",
      "url": "http://localhost:15000/mcp"
    }
  }
}
```

### Option 2: Manual Bearer Token

If you prefer to explicitly pass a token (e.g., for local development or simple API key setups), use the `headers` object:

```json
{
  "servers": {
    "agentgateway": {
      "type": "http",
      "url": "http://localhost:15000/mcp",
      "headers": {
        "Authorization": "Bearer your-token-here"
      }
    }
  }
}
```

## Verifying the Connection

1. **Reload Window:** Run `Cmd/Ctrl + Shift + P` → **"Developer: Reload Window"**.
2. **Open Chat:** Open the GitHub Copilot Chat panel.
3. **Switch to Agent Mode:** Ensure the dropdown at the bottom of the chat is set to **Agent**.
4. **Check Tools:** Click the **Tools (plus icon)** in the chat box. You should see `agentgateway` listed with its available tools.
5. **Test:** Type `#` followed by a tool name (e.g., `#get_k8s_logs`) to see it in action.
