---
title: Streamable HTTP
weight: 15
description: Connect to MCP servers via streamable HTTP with automatic session management
test:
  mcp-stateless:
  - file: ${versionRoot}/mcp/connect/http.md
    path: mcp-stateless
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

## Stateless sessions {#stateless-sessions}

By default, agentgateway proxies streamable HTTP in **stateful** mode, as described in the previous section. You can instead run in **stateless** mode with the `statefulMode` field, so that agentgateway does not create a session or return an `Mcp-Session-Id` header. Each request is treated independently, and the client must send the full context that the request needs. This mode suits stateless agents, or MCP servers where the client handles state directly.

> [!NOTE]
> The `statefulMode` field controls how agentgateway proxies session-based servers. It is separate from the newer, inherently sessionless `2026-07-28` MCP protocol, which agentgateway supports automatically through version negotiation. For more information, see [MCP spec compatibility]({{< link-hextra path="/mcp/spec-compatibility" >}}).

To use stateless mode, set `statefulMode` to `stateless` on the MCP configuration.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  statefulMode: stateless
  targets:
  - name: mcp
    mcp:
      host: http://localhost:3005/mcp/
```

When you send an `initialize` request through agentgateway in stateless mode, the response returns `HTTP 200` with no `Mcp-Session-Id` header. In the default stateful mode, the same request returns an `Mcp-Session-Id` header that pins the session to a backend.

{{< doc-test paths="mcp-stateless" >}}
# WHAT THIS TEST VALIDATES:
#   * statefulMode: stateless is accepted and the MCP endpoint serves an initialize request (HTTP 200)
#   * In stateless mode, the initialize response does NOT include an Mcp-Session-Id header
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The visible example uses a streamable HTTP upstream (host: http://localhost:3005/mcp/);
#     the hidden test config uses a self-contained stdio target so no external MCP server is
#     needed. statefulMode governs the downstream (client-facing) session, independent of the
#     upstream transport, so the stateless behavior under test is the same.
#   * The default stateful contrast (Mcp-Session-Id present) is covered by other pages that
#     use the default configuration.
{{< /doc-test >}}

{{< doc-test paths="mcp-stateless" >}}
# Install agentgateway binary
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

{{< doc-test paths="mcp-stateless" >}}
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  statefulMode: stateless
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
{{< /doc-test >}}

{{< doc-test paths="mcp-stateless" >}}
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3
{{< /doc-test >}}

{{< doc-test paths="mcp-stateless" >}}
YAMLTest -f - <<'EOF'
- name: MCP endpoint accepts initialize request in stateless mode
  http:
    url: "http://localhost:3000"
    path: /mcp
    method: POST
    headers:
      content-type: application/json
      accept: "application/json, text/event-stream"
    body: |
      {"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}
  source:
    type: local
  expect:
    statusCode: 200
EOF
{{< /doc-test >}}

{{< doc-test paths="mcp-stateless" >}}
# Assert that stateless mode does not return an Mcp-Session-Id header
if curl -sS -D - -o /dev/null -X POST http://localhost:3000/mcp/ \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}' \
  | grep -qi 'mcp-session-id'; then
  echo "FAIL: stateless mode returned an Mcp-Session-Id header"
  exit 1
fi
echo "PASS: no Mcp-Session-Id header in stateless mode"
{{< /doc-test >}}

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

      {{< reuse-image-light src="img/ui-playground-tools.png" >}}
      {{< reuse-image-dark srcDark="img/ui-playground-tools-dark.png" >}}

3. Verify access to a tool.
   1. From the **Tool** list, select the `echo` tool.
   2. In the **Message** field, enter any string, such as `This is my first agentgateway setup.`, and click **Call tool**.
   3. Verify that the **Result** card shows an `HTTP 200` response with your message echoed back.

      {{< reuse-image-light src="img/ui-playground-tool-echo.png" >}}
      {{< reuse-image-dark srcDark="img/ui-playground-tool-echo-dark.png" >}}
