---
title: Set up CEL guardrails
weight: 20
description: Reject and mask MCP tool calls in-process with CEL expression guardrails.
test:
  mcp-guardrails-cel:
  - path: mcp-guardrails-cel
---

Reject and mask Model Context Protocol (MCP) tool calls with Common Expression Language (CEL) expressions that run inside agentgateway. Unlike [remote guardrails]({{< link-hextra path="/documentation/mcp/guardrails/setup" >}}), CEL guardrails do not require you to deploy or operate an external policy server. For more information about how guardrail processors work, see [Guardrail processors]({{< link-hextra path="/documentation/mcp/guardrails/processors" >}}).

In this guide, you configure three CEL guardrails for the `echo` tool of a sample MCP server:

* A request-phase guardrail that rejects messages that contain `DO_NOT_SEND`.
* A request-phase guardrail that masks email addresses before the message reaches the MCP server.
* A response-phase guardrail that masks demo secrets in the tool result before it reaches the client.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

{{< doc-test paths="mcp-guardrails-cel" >}}
# Install agentgateway binary
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

## Set up CEL guardrails

1. Create a `config.yaml` file. The MCP backend exposes a local stdio MCP server, and the `mcpGuardrails` policy on the route runs three CEL expression processors.
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

   {{< doc-test paths="mcp-guardrails-cel" >}}
   cat <<'EOF' > config.yaml
   gateways:
     default:
       port: 3000
   routes:
   - policies:
       mcpGuardrails:
         processors:
         - kind: expression
           methods:
             tools/call: request
           condition: >-
             mcp.params.name == 'echo' &&
             has(mcp.params.arguments) &&
             has(mcp.params.arguments.message) &&
             mcp.params.arguments.message.contains('DO_NOT_SEND')
           reject: "Messages containing DO_NOT_SEND may not be sent upstream"
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
   EOF
   agentgateway -f config.yaml --validate-only
   {{< /doc-test >}}

   Review the following table to understand the `mcpGuardrails` policy.

   | Setting | Description |
   |---------|-------------|
   | `kind: expression` | Run the processor in-process as a CEL expression. |
   | `methods` | The MCP methods that run through the processor, and the phase for each. `tools/call: request` runs the processor before the call reaches the MCP server. `tools/call: response` runs the processor after the MCP server returns a result. |
   | `condition` | Optional CEL expression that must be `true` for the processor to act. When the condition is `false`, the processor passes the message through unchanged. |
   | `reject` | The message to return to the client when the condition matches. The first processor rejects any `echo` call whose message contains `DO_NOT_SEND`. Because it is listed first, it sees the original message before any masking. |
   | `transform` | A CEL expression that returns the replacement body. In the request phase, `mcp.params` holds the parameters of the `tools/call` request, such as the tool `name` and its `arguments`. In the response phase, `mcp.result` holds the tool result. The `merge` function keeps every field that you do not change, and `regexReplaceAll` replaces every match of a regular expression. To replace only the first match, use `regexReplace`. |

2. Run agentgateway with the configuration file.
   ```sh
   agentgateway -f config.yaml
   ```

   {{< doc-test paths="mcp-guardrails-cel" >}}
   agentgateway -f config.yaml &
   AGW_PID=$!
   trap 'kill $AGW_PID 2>/dev/null' EXIT
   # Wait for the stdio MCP backend to be ready. On first run, agentgateway downloads
   # @modelcontextprotocol/server-everything via npx, which can take a while.
   for i in $(seq 1 60); do
     code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/mcp \
       -H 'Content-Type: application/json' \
       -H 'Accept: application/json, text/event-stream' \
       -H 'MCP-Protocol-Version: 2025-03-26' \
       -d '{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"warmup","version":"1.0"}}}' || true)
     [ "$code" = "200" ] && break
     sleep 2
   done
   {{< /doc-test >}}

## Verify the guardrails

Verify that the guardrails mask the request and response, and reject messages that contain `DO_NOT_SEND`.

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

2. Send the `notifications/initialized` notification to complete the MCP handshake. The MCP server does not answer other requests, such as `tools/call`, until initialization is complete.
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

   Verify that the echoed text masks both email addresses and both secrets. The request guardrail replaced the email addresses before the call reached the MCP server, and the response guardrail replaced the secrets in the tool result.
   ```console
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

   Verify that the guardrail rejects the call and that the MCP server is not called. Because the method is `tools/call`, the client receives a tool result with `isError: true` and the `reject` message.
   ```console
   {"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"Messages containing DO_NOT_SEND may not be sent upstream"}],"isError":true}}
   ```

{{< doc-test paths="mcp-guardrails-cel" >}}
# WHAT THIS TEST VALIDATES:
#   * MCP session handshake (initialize + notifications/initialized) - steps 1-2
#   * Request-phase transform masks both email addresses, and response-phase
#     transform masks both demo secrets (step 3)
#   * Request-phase reject returns an isError tool result with the reject message (step 4)
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The displayed config's cors policy - browser-only, curl does not send CORS requests.
mcp_post() {
  curl -s http://localhost:3000/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "MCP-Protocol-Version: 2025-03-26" \
    -H "mcp-session-id: $MCP_SESSION_ID" \
    -d "$1"
}
export MCP_SESSION_ID=$(curl -s -D - http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-03-26" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}' \
  | grep -i "mcp-session-id:" | sed 's/.*: //' | tr -d '\r')
mcp_post '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null
MASKED=$(mcp_post '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"echo","arguments":{"message":"Contact alice@example.com and bob@example.org; tokens demo-secret-abc and demo-secret-xyz"}}}')
echo "$MASKED" | grep -q 'Echo: Contact \[EMAIL\] and \[EMAIL\]; tokens \[SECRET\] and \[SECRET\]' \
  && echo "✓ request and response masking" || { echo "FAIL: masking: $MASKED"; exit 1; }
REJECTED=$(mcp_post '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"echo","arguments":{"message":"DO_NOT_SEND alice@example.com"}}}')
echo "$REJECTED" | grep -q '"isError":true' && echo "$REJECTED" | grep -q 'Messages containing DO_NOT_SEND may not be sent upstream' \
  && echo "✓ DO_NOT_SEND call rejected" || { echo "FAIL: reject: $REJECTED"; exit 1; }
{{< /doc-test >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Stop the agentgateway process with `Ctrl+C`.
2. Delete the configuration file.
   ```sh
   rm config.yaml
   ```
