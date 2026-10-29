---
title: Set up CEL guardrails
weight: 20
description: Reject and mask MCP tool calls in-process with CEL expression guardrails.
---

Reject and mask Model Context Protocol (MCP) tool calls with Common Expression Language (CEL) expressions inside agentgateway. CEL guardrails require no external policy server.

For an overview, see [Guardrail processors]({{< link-hextra path="/documentation/mcp/guardrails/processors" >}}). To use an external policy server, see [Set up remote guardrails]({{< link-hextra path="/documentation/mcp/guardrails/setup" >}}).

In this guide, you configure three CEL guardrails for the `echo` tool of a sample MCP server:

* Reject messages containing `DO_NOT_SEND` in the request phase.
* Mask email addresses before sending the request to the MCP server.
* Mask demo secrets in the response before returning it to the client.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up CEL guardrails

1. Create a `config.yaml` file with a local stdio MCP server and three CEL processors in the route's `mcpGuardrails` policy.
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
         # Reject before masking, so this rule sees the original message.
         - kind: expression
           methods:
             tools/call: request
           condition: >-
             mcp.params.name == 'echo' &&
             has(mcp.params.arguments) &&
             has(mcp.params.arguments.message) &&
             mcp.params.arguments.message.contains('DO_NOT_SEND')
           reject: "Messages containing DO_NOT_SEND may not be sent upstream"
         # Mask every email address in the message before it reaches the MCP server.
         - kind: expression
           methods:
             tools/call: request
           condition: >-
             mcp.params.name == 'echo' &&
             has(mcp.params.arguments) &&
             has(mcp.params.arguments.message)
           transform: >-
             mcp.params.with(p, p.merge({
               'arguments': p.arguments.merge({
                 'message': p.arguments.message.regexReplaceAll(
                   '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}',
                   '[EMAIL]'
                 )
               })
             }))
         # Mask demo secrets in every text block that a tool returns.
         - kind: expression
           methods:
             tools/call: response
           condition: has(mcp.result.content)
           transform: >-
             mcp.result.with(r, r.merge({
               'content': r.content.map(item,
                 item.type == 'text'
                   ? item.merge({'text': item.text.regexReplaceAll(
                       'demo-secret-[A-Za-z0-9]+', '[SECRET]'
                     )})
                   : item
               )
             }))
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
   | `kind: expression` | Run the processor in-process as a CEL expression. |
   | `methods` | The MCP methods that run through the processor, and the phase for each. `tools/call: request` runs the processor before the call reaches the MCP server. `tools/call: response` runs the processor after the MCP server returns a result. |
   | `condition` | Optional CEL expression that must be `true` for the processor to act. When the condition is `false`, the processor passes the message through unchanged. |
   | `reject` | Rejection message for the client. The first processor checks for `DO_NOT_SEND` before masking changes the message. |
   | `transform` | CEL expression that replaces `mcp.params` (request) or `mcp.result` (response). The `merge` function preserves other fields. Use `regexReplaceAll` to mask every match, or `regexReplace` to mask only the first. |

2. Run agentgateway with the configuration file.
   ```sh
   agentgateway -f config.yaml
   ```

## Verify the guardrails

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

2. Send `notifications/initialized` to complete the MCP handshake before calling tools.
   ```sh
   curl -s http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "MCP-Protocol-Version: 2025-03-26" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
   ```

3. Call the `echo` tool with a message that contains two email addresses and two demo secrets.
   ```sh
   curl -s http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "MCP-Protocol-Version: 2025-03-26" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"echo","arguments":{"message":"Contact alice@example.com and bob@example.org; tokens demo-secret-abc and demo-secret-xyz"}}}'
   ```

   Verify that the result masks both email addresses and both secrets. The request guardrail masks the addresses; the response guardrail masks the secrets. This response uses server-sent events (`Content-Type: text/event-stream`).
   ```console
   event: message
   data: {"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"Echo: Contact [EMAIL] and [EMAIL]; tokens [SECRET] and [SECRET]"}]}}
   ```

4. Call the `echo` tool with a message that contains `DO_NOT_SEND`.
   ```sh
   curl -s http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "MCP-Protocol-Version: 2025-03-26" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"echo","arguments":{"message":"DO_NOT_SEND alice@example.com"}}}'
   ```

   Verify that the call is rejected before it reaches the MCP server. The tool result contains `isError: true` and the configured rejection message. Agentgateway returns this request-phase rejection as plain JSON (`Content-Type: application/json`) with HTTP 200.
   ```console
   {"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"Messages containing DO_NOT_SEND may not be sent upstream"}],"isError":true}}
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Stop the agentgateway process with `Ctrl+C`.
2. Delete the configuration file.
   ```sh
   rm config.yaml
   ```
