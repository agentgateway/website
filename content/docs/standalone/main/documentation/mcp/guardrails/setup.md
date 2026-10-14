---
title: Set up MCP guardrails
weight: 20
description: Gate and mutate MCP method calls with an external ExtMCP policy server or in-process CEL expressions.
test:
  mcp-guardrails:
  - path: mcp-guardrails
---

Gate and mutate Model Context Protocol (MCP) method calls with an external policy server or in-process Common Expression Language (CEL) expressions. For more information about how MCP guardrails work, see [About MCP guardrails]({{< link-hextra path="/documentation/mcp/guardrails/about" >}}).

In this guide, you route `tools/call` and `tools/list` requests through a sample ExtMCP server that denies any tool whose name contains `forbidden` and annotates each tool description in `tools/list` responses. Then, you add CEL expression processors that reject and mask tool calls without a policy server.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

{{< doc-test paths="mcp-guardrails" >}}
# Install agentgateway binary
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

## Set up MCP guardrails

1. Start a sample ExtMCP policy server. This example uses a prebuilt gRPC server that denies `tools/call` when the tool name contains `forbidden`, and appends ` [extmcp]` to every tool description in `tools/list` responses. The server listens on port `9001`.
   ```sh
   docker run --rm -p 9001:9001 gcr.io/solo-public/docs/testbox:latest
   ```

   {{< doc-test paths="mcp-guardrails" >}}
   docker rm -f ext-mcp-server >/dev/null 2>&1 || true
   docker run -d --name ext-mcp-server -p 9001:9001 gcr.io/solo-public/docs/testbox:latest
   for i in $(seq 1 30); do (echo > /dev/tcp/localhost/9001) 2>/dev/null && break; sleep 1; done
   {{< /doc-test >}}

   > [!NOTE]
   > **Build your own ExtMCP server**: The sample server is for demonstration only. To build your own, implement the `ExtMcp` gRPC service from the [ExtMCP protocol definition](https://github.com/agentgateway/agentgateway/blob/main/crates/protos/proto/ext_mcp.proto). The service has two methods:
   >
   > * `CheckRequest`: Called in the request phase, before the call reaches the MCP backend. Return the request unchanged, return mutated `params`, or return an `AuthorizationError` to deny the call.
   > * `CheckResponse`: Called in the response phase, after the MCP backend returns a result. Return the response unchanged, return a mutated `result`, or return an `AuthorizationError` to deny the call.
   >
   > Generate gRPC bindings from the proto file in your language, implement the two methods, and serve them over cleartext HTTP/2 (h2c) on the port that agentgateway connects to. For more information about the request and response messages, outcomes, and error codes, see [About MCP guardrails]({{< link-hextra path="/documentation/mcp/guardrails/about" >}}).

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

   {{< doc-test paths="mcp-guardrails" >}}
   cat <<'EOF' > config.yaml
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
   EOF
   {{< /doc-test >}}

   Review the following table to understand the `mcpGuardrails` policy.

   | Setting | Description |
   |---------|-------------|
   | `kind: remote` | Use a remote gRPC ExtMCP server to enforce this processor. |
   | `host` | The address of the ExtMCP policy server. This example points to the sample server from the previous step. |
   | `failureMode: failClosed` | Deny requests if the policy server is unreachable or returns an error. To allow requests instead, set `failOpen`. |
   | `methods` | The MCP methods to route through the policy server, and the phase for each. `tools/call: request` sends each tool call to the server *before* it reaches the MCP backend, so the server can allow, mutate, or deny the call. `tools/list: response` sends the tool listing to the server *after* the backend returns it, so the server can filter or annotate the list. For the full list of phases and method matching, see [About MCP guardrails]({{< link-hextra path="/documentation/mcp/guardrails/about" >}}). |

3. Run agentgateway with the configuration file.
   ```sh
   agentgateway -f config.yaml
   ```

   {{< doc-test paths="mcp-guardrails" >}}
   agentgateway -f config.yaml &
   AGW_PID=$!
   trap 'kill $AGW_PID 2>/dev/null; docker rm -f ext-mcp-server >/dev/null 2>&1' EXIT
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

{{< doc-test paths="mcp-guardrails" >}}
# WHAT THIS TEST VALIDATES:
#   * MCP session handshake (initialize + notifications/initialized) — steps 1-2
#   * ExtMCP response-phase mutation — tools/list descriptions annotated with [extmcp] (step 3)
#   * ExtMCP request-phase deny — tools/call for a "forbidden" tool returns JSON-RPC -32001 (step 4)
#   * Allowed tool call passes through — echo returns its result (step 5)
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * "Build your own ExtMCP server" callout — display-only guidance, no runnable command
#   * failOpen behavior — the page documents failClosed only; failOpen is not exercised
export MCP_SESSION_ID=$(curl -s -D - http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-03-26" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}' \
  | grep -i "mcp-session-id:" | sed 's/.*: //' | tr -d '\r')
curl -s http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-03-26" \
  -H "mcp-session-id: $MCP_SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null
TL=$(curl -s http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-03-26" \
  -H "mcp-session-id: $MCP_SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}')
echo "$TL" | grep -q '\[extmcp\]' && echo "✓ tools/list descriptions annotated with [extmcp]" || { echo "FAIL: [extmcp] annotation missing: $TL"; exit 1; }
FB=$(curl -s http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-03-26" \
  -H "mcp-session-id: $MCP_SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"forbidden-tool","arguments":{}}}')
echo "$FB" | grep -q 'is not allowed' && echo "✓ forbidden tool call denied by ExtMCP" || { echo "FAIL: forbidden tool was not denied: $FB"; exit 1; }
EC=$(curl -s http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-03-26" \
  -H "mcp-session-id: $MCP_SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"echo","arguments":{"message":"hello"}}}')
echo "$EC" | grep -q 'Echo: hello' && echo "✓ allowed tool call (echo) succeeded" || { echo "FAIL: echo call did not succeed: $EC"; exit 1; }
{{< /doc-test >}}

## Add CEL expression processors {#expression-processors}

You can also run a processor as a CEL expression inside agentgateway, without a policy server. Set `kind: expression` instead of `kind: remote`. One `mcpGuardrails` policy can mix both kinds. Processors run in list order, each processor sees the changes from earlier processors, and the first rejection stops the chain.

1. Update the `config.yaml` file to add three `expression` processors after the `remote` processor. The first processor rejects `echo` calls whose message contains `DO_NOT_SEND`. The second processor masks email addresses in the `echo` message before the call reaches the MCP backend. The third processor masks `demo-secret-` tokens in the text content of tool results.
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
         # Reject before masking, so this processor sees the original message.
         - kind: expression
           methods: {"tools/call": request}
           condition: >-
             mcp.params.name == 'echo' &&
             has(mcp.params.arguments) &&
             has(mcp.params.arguments.message) &&
             mcp.params.arguments.message.contains('DO_NOT_SEND')
           reject: "Messages containing DO_NOT_SEND may not be sent upstream"
         # Mask every email-like match in the echo message.
         - kind: expression
           methods: {"tools/call": request}
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
         # Mask demo secrets in all text blocks that tools return.
         - kind: expression
           methods: {"tools/call": response}
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

   Review the following table to understand the `expression` settings. For the variables that an expression can read, see [CEL variables]({{< link-hextra path="/reference/cel/variables" >}}).

   | Setting | Description |
   |---------|-------------|
   | `kind: expression` | Run the processor as a CEL expression inside agentgateway instead of calling a remote ExtMCP server. Expression processors have no `failureMode`. |
   | `condition` | Optional. A CEL expression that must return `true` for the action to run. If you omit `condition`, the action runs for every method that the processor matches. Check optional fields with `has()` first because an expression that fails to evaluate rejects the call with a JSON-RPC internal error. |
   | `reject` | The message to return when the processor rejects a call. When the processor rejects a `tools/call` request in the request phase, the client receives a tool result with `isError: true` and this message as its text. Other rejections return a JSON-RPC error with code `-32001`. Set exactly one of `reject` or `transform`. |
   | `transform` | A CEL expression that returns a new version of the MCP message. In the request phase, the expression reads the current request parameters from the `mcp.params` variable and the value that the expression returns becomes the new request parameters. In the response phase, the expression reads the current response result from the `mcp.result` variable and the value that the expression returns becomes the new response result. To change one field and keep the others, use `merge` on the variable, as in the example. To leave the message unchanged, return `null`. If the output is not a valid message for the method, agentgateway rejects the call. |
   | `methods` | The MCP methods and phases that the processor runs for, the same as for a `remote` processor. |

2. Stop agentgateway with `Ctrl+C` and run it again with the updated configuration file.
   ```sh
   agentgateway -f config.yaml
   ```

3. Start a new MCP session. Repeat steps 1 and 2 in [Verify the guardrails](#verify-the-guardrails).

4. Call the `echo` tool with a message that contains `DO_NOT_SEND`. Verify that the response is a tool result with `isError: true` and the text `Messages containing DO_NOT_SEND may not be sent upstream`. The call does not reach the MCP backend.
   ```sh
   curl -s http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "MCP-Protocol-Version: 2025-03-26" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"echo","arguments":{"message":"DO_NOT_SEND this"}}}'
   ```

5. Call the `echo` tool with a message that contains an email address and a demo secret. Verify that the result text is `Echo: Contact [EMAIL] with [SECRET]`. The second processor masked the email address in the request, and the third processor masked the secret in the response.
   ```sh
   curl -s http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "MCP-Protocol-Version: 2025-03-26" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"echo","arguments":{"message":"Contact alice@example.com with demo-secret-abc123"}}}'
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Stop the agentgateway process with `Ctrl+C`.
2. Stop the sample ExtMCP server with `Ctrl+C` in its terminal.
3. Delete the configuration file.
   ```sh
   rm config.yaml
   ```
