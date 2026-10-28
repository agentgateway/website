---
title: Set up remote guardrails
weight: 30
description: Gate and mutate MCP method calls with an external ExtMCP policy server.
---

Inspect, rewrite, or reject Model Context Protocol (MCP) calls with an external ExtMCP policy server.

For an overview, see [Guardrail processors]({{< link-hextra path="/documentation/mcp/guardrails/processors" >}}). To run guardrails inside agentgateway, see [Set up CEL guardrails]({{< link-hextra path="/documentation/mcp/guardrails/cel" >}}).

In this guide, you route `tools/call` and `tools/list` requests through a sample ExtMCP server that denies any tool whose name contains `forbidden` and annotates each tool description in `tools/list` responses.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up remote guardrails

1. Start a sample ExtMCP policy server. This example uses a prebuilt gRPC server that denies `tools/call` when the tool name contains `forbidden`, and appends ` [extmcp]` to every tool description in `tools/list` responses. The server listens on port `9001`.
   ```sh
   docker run --rm -p 9001:9001 gcr.io/solo-public/docs/testbox:latest
   ```

   > [!NOTE]
   > **Build your own ExtMCP server**: The sample server is for demonstration only. To build your own, implement the `ExtMcp` gRPC service from the [ExtMCP protocol definition](https://github.com/agentgateway/agentgateway/blob/v1.7.0/crates/protos/proto/ext_mcp.proto). The service has two methods:
   >
   > * `CheckRequest`: Called in the request phase, before the call reaches the MCP backend. Return the request unchanged, return mutated `params`, or return an `AuthorizationError` to deny the call.
   > * `CheckResponse`: Called in the response phase, after the MCP backend returns a result. Return the response unchanged, return a mutated `result`, or return an `AuthorizationError` to deny the call.
   >
   > Generate gRPC bindings from the proto file and implement both methods. Serve them over cleartext HTTP/2 (h2c) on the port that agentgateway connects to. For more information about the request and response messages, outcomes, and error codes, see [Guardrail processors]({{< link-hextra path="/documentation/mcp/guardrails/processors" >}}).

2. In another terminal, create a `config.yaml` file. The MCP backend exposes a local stdio MCP server, and the `mcpGuardrails` policy on the route sends selected MCP methods through the ExtMCP server.
   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 3000
   routes:
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
       mcpGuardrails:
         processors:
         - kind: remote
           host: "localhost:9001"
           failureMode: failClosed
           methods:
             tools/call: request
             tools/list: response
     backends:
     - mcp:
         targets:
         - name: everything
           stdio:
             cmd: npx
             args: ["@modelcontextprotocol/server-everything"]
   ```

   Review the following table to understand the `mcpGuardrails` policy.

   | Setting | Description |
   |---------|-------------|
   | `kind: remote` | Use a remote gRPC ExtMCP server to enforce this processor. |
   | `host` | The address of the ExtMCP policy server. This example points to the sample server from the previous step. |
   | `failureMode: failClosed` | Deny requests if the policy server is unreachable or returns an error. To allow requests instead, set `failOpen`. |
   | `methods` | MCP methods and phases to send to the policy server. `tools/call: request` checks tool calls before forwarding them. `tools/list: response` filters or annotates tool lists after the backend responds. See [Methods and phases]({{< link-hextra path="/documentation/mcp/guardrails/processors/#methods" >}}). |

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
