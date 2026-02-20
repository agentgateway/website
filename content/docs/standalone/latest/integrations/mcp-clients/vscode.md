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

## Configuration locations

VS Code reads MCP configurations from two primary locations. You no longer need to set these in the giant `settings.json` file. However, you can continue to use the `settings.json` file if your workflows depend on it. 

1. **Global (All Projects):** Create or edit `%USERPROFILE%\.mcp.json` (Windows) or `~/.mcp.json` (macOS/Linux).
2. **Workspace (Current Project):** Create or edit `.vscode/mcp.json` in your project root directory.

## Server configuration

Add the following snippet to your `mcp.json` file:

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

### Option 1: Native MCP authentication flow

If your agentgateway proxy is configured to use an OIDC/OAuth provider (like Okta or Entra ID), VS Code automatically detects the challenge and prompts you to "Sign In" via a browser pop-up.

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

### Option 2: Manual bearer token

If you prefer to explicitly pass a token, such as for local development or simple API key setups, use the `headers` object:

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
5. **Test:** Type `#` followed by a tool name, such as `#get_k8s_logs` to see it in action.
