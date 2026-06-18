---
title: Streamable HTTP
weight: 15
description: Connect to MCP servers via streamable HTTP with automatic session management
---

Connect to an MCP server via streamable HTTP. 

{{< reuse "agw-docs/snippets/kgateway-callout.md" >}}

## About streamable HTTP

Agentgateway automatically manages stateful MCP sessions when using HTTP-based transports. The session state (including backend pinning) is encoded in the session ID and persisted across requests, ensuring that subsequent tool calls in the same session are routed to the same backend server.

```mermaid
sequenceDiagram
    participant Client
    participant Agentgateway
    participant MCP Server

    Client->>Agentgateway: initialize (no session)
    Agentgateway->>MCP Server: initialize
    MCP Server-->>Agentgateway: initialized
    Note over Agentgateway: Pin session to backend<br/>Encode state into session ID
    Agentgateway-->>Client: Mcp-Session-Id: encrypted-state-abc123
    
    Client->>Agentgateway: call_tool (with session ID)
    Note over Agentgateway: Decode session ID<br/>Route to pinned backend
    Agentgateway->>MCP Server: call_tool (same server)
    MCP Server-->>Agentgateway: tool result
    Agentgateway-->>Client: result
```

1. **Session initialization**: When a client sends an `initialize` request, agentgateway creates a session and returns a session ID
2. **Backend pinning**: The session is pinned to a specific backend server (important when using multiple targets)
3. **State encoding**: The session state is encoded into the session ID using AES-256-GCM encryption
4. **Session resumption**: Subsequent requests with the same session ID are automatically routed to the same backend

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Configure the agentgateway

1. Spin up an MCP server that uses streamable HTTP.
   ```sh
   PORT=3005 npx -y @modelcontextprotocol/server-everything streamableHttp
   ```

2. Create a configuration for your agentgateway to connect to your MCP server. Make sure to expose the `Mcp-Session-Id` header in the CORS configuration for session persistence.
   ```yaml
   cat <<EOF > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   mcp:
     port: 3000
     policies:
       cors:
         allowOrigins:
           - "*"
         allowHeaders:
           - "*"
         exposeHeaders:
           - "Mcp-Session-Id"
     targets:
     - name: mcp
       mcp:
         host: http://localhost:3005/mcp/
   EOF
   ```

3. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```

## Verify access to tools

1. Open the [agentgateway UI](http://localhost:15000/ui/) to view your listener and backend configuration.

2. Connect to the MCP test server with the agentgateway UI playground.

   1. From the navigation menu under **MCP**, click **Tool Playground**.
   2. If you see a **Browser access is not allowed** notice, click **Apply CORS** so the playground can call the MCP listener from the UI.
   3. Click **Initialize** to open an MCP session. The agentgateway UI connects to the target that you configured and lists the tools that are exposed on the target.

      {{< reuse-image src="img/ui-playground-tools.png" >}}

3. Verify access to a tool.
   1. From the **Tool** list, select the `echo` tool.
   2. In the **message** field, enter any string, such as `This is my first agentgateway setup.`, and click **Call tool**.
   3. Verify that the **Result** card shows an `HTTP 200` response with your message echoed back.

      {{< reuse-image src="img/ui-playground-tool-echo.png" >}}
