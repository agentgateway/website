---
title: VS Code
weight: 5
description: Connect VS Code with GitHub Copilot to agentgateway
---

Configure Visual Studio Code to use **agentgateway** via GitHub Copilot's native MCP support.

## Before You Begin

* Install **VS Code (1.92+)** with the **GitHub Copilot** extension.
* Enable **GitHub Copilot Chat**.
* In the GitHub Copilot Chat, make sure that **Agent Mode** is active (MCP tools are primarily utilized when Copilot is in "Agent" mode).
* Set up an **MCP server in agentgateway**. For example, check out the [MCP connection guides]({{< link-hextra path="/mcp/connect/http/" >}}).

## Server configuration

Configure your MCP server in the `mcp.json` file in the root directory of your project. For more locations, refer to the [VS Code](https://code.visualstudio.com/docs/copilot/customization/mcp-servers) docs. If your MCP server is running on a different host and port, update the URL accordingly.

```json
{
  "servers": {
    "agentgateway": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Authentication

You have two ways to handle security, depending on your setup: native MCP authentication flow or manual bearer token.

### Option 1: Native MCP authentication flow

If your agentgateway proxy is configured to use an OIDC/OAuth provider (like Okta or Entra ID), VS Code automatically detects the challenge and prompts you to "Sign In" via a browser pop-up.

```json
{
  "servers": {
    "agentgateway": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Option 2: Manual bearer token

If you prefer to explicitly pass a token, such as for local development or simple API key setups, use the `headers` object.

```json
{
  "servers": {
    "agentgateway": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer your-token-here"
      }
    }
  }
}
```

## Verifying the Connection

In agentgateway, run a configuration that includes the URL that you configured in the `mcp.json` file. 

In VS Code:

1. **Reload Window:** Run `Cmd/Ctrl + Shift + P`, then search for and select **"Developer: Reload Window"**.
2. **Open Chat:** Open the GitHub Copilot Chat panel.
3. **Switch to Agent Mode:** Ensure the dropdown at the bottom of the chat is set to **Agent**.
4. **Check Tools:** Click the **Tools** icon in the chat box menu. In the tools dropdown, filter for `agentgateway` and expand to view the MCP server's available tools.
5. **Test:** In the chat box, type `#` followed by a tool name, such as `#get_k8s_logs` to see it in action.
