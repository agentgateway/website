---
title: Set up MCP guardrails
weight: 20
description: Gate and mutate MCP method calls with an external ExtMCP policy server.
---

Gate and mutate Model Context Protocol (MCP) method calls with an external policy server. For more information about how MCP guardrails work, see [About MCP guardrails]({{< link-hextra path="/mcp/guardrails/about" >}}).

In this guide, you route `tools/call` and `tools/list` requests through a sample ExtMCP server that denies any tool whose name contains `forbidden` and annotates each tool description in `tools/list` responses.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up MCP guardrails

1. Start a sample ExtMCP policy server. This example uses a prebuilt gRPC server that denies `tools/call` when the tool name contains `forbidden`, and appends ` [extmcp]` to every tool description in `tools/list` responses. The server listens on port `9001`.
   ```sh
   docker run --rm -p 9001:9001 ghcr.io/agentgateway/testbox:0.0.1
   ```

2. In another terminal, create a `config.yaml` file. The MCP backend exposes a local stdio MCP server, and the `mcpGuardrails` policy on the target routes selected MCP methods through the ExtMCP server.
   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   binds:
   - port: 3000
     listeners:
     - routes:
       - policies:
           cors:
             allowOrigins:
             - "*"
             allowHeaders:
             - mcp-protocol-version
             - content-type
             - mcp-session-id
             exposeHeaders:
             - "Mcp-Session-Id"
         backends:
         - mcp:
             targets:
             - name: everything
               stdio:
                 cmd: npx
                 args: ["@modelcontextprotocol/server-everything"]
               policies:
                 mcpGuardrails:
                   processors:
                   - kind: remote
                     host: "localhost:9001"
                     failureMode: failClosed
                     methods:
                       tools/call: request
                       tools/list: response
   ```

   Review the following table to understand the `mcpGuardrails` policy.

   | Setting | Description |
   |---------|-------------|
   | `kind: remote` | Use a remote gRPC ExtMCP server to enforce this processor. |
   | `host` | The address of the ExtMCP policy server. This example points to the sample server from the previous step. |
   | `failureMode: failClosed` | Deny requests if the policy server is unreachable or returns an error. To allow requests instead, set `failOpen`. |
   | `methods` | The MCP methods to route through the policy server, and the phase for each. `tools/call: request` sends each tool call to the server *before* it reaches the MCP backend, so the server can allow, mutate, or deny the call. `tools/list: response` sends the tool listing to the server *after* the backend returns it, so the server can filter or annotate the list. For the full list of phases and method matching, see [About MCP guardrails]({{< link-hextra path="/mcp/guardrails/about" >}}). |

3. Run agentgateway with the configuration file.
   ```sh
   agentgateway -f config.yaml
   ```

## Verify the guardrails

Verify that the policy server gates `tools/call` and mutates `tools/list` responses.

1. Initialize an MCP session and save the session ID.
   ```sh
   export MCP_SESSION_ID=$(curl -s -D - http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "MCP-Protocol-Version: 2025-03-26" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}' \
     | grep -i "mcp-session-id:" | sed 's/.*: //' | tr -d '\r')
   echo $MCP_SESSION_ID
   ```

2. Send the `notifications/initialized` notification to complete the MCP handshake. The MCP server does not answer other requests, such as `tools/list`, until initialization is complete.
   ```sh
   curl -s http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "MCP-Protocol-Version: 2025-03-26" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
   ```

3. List the available tools. Verify that each tool description ends with ` [extmcp]`, which the policy server added in the response phase.
   ```sh
   curl -s http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "MCP-Protocol-Version: 2025-03-26" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
   ```

   Example output:
   ```console {hl_lines=[1]}
   data: {"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"echo","description":"Echoes back the input [extmcp]",...}]}}
   ```

4. Call a tool whose name contains `forbidden`. Verify that the policy server denies the call with a JSON-RPC error.
   ```sh
   curl -s http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "MCP-Protocol-Version: 2025-03-26" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"forbidden-tool","arguments":{}}}'
   ```

   Example output:
   ```console
   {"jsonrpc":"2.0","id":3,"error":{"code":-32001,"message":"tool forbidden-tool is not allowed"}}
   ```

5. Call an allowed tool, such as `echo`. Verify that the call succeeds.
   ```sh
   curl -s http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "MCP-Protocol-Version: 2025-03-26" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"echo","arguments":{"message":"hello"}}}'
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Stop the agentgateway process with `Ctrl+C`.
2. Stop the sample ExtMCP server with `Ctrl+C` in its terminal.
3. Delete the configuration file.
   ```sh
   rm config.yaml
   ```
