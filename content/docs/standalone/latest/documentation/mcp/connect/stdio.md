---
title: Stdio
weight: 10
description: Run a local MCP server as a subprocess and expose it through agentgateway over stdio.
test:
  mcp-stdio:
  - file: ${versionRoot}/documentation/mcp/connect/stdio.md
    path: mcp-stdio
---

An MCP backend allows exposing MCP servers through the agentgateway using {{< gloss "STDIO (Standard Input/Output)" >}}STDIO{{< /gloss >}}.

{{< doc-test paths="mcp-stdio" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Configure the agentgateway" step 1: the documented download URL resolves and
#     returns a config that agentgateway accepts (--validate-only).
#   * "Verify access to tools" steps 2-3, through the MCP API rather than the UI
#     playground: an MCP session initializes, tools/list includes the `echo` tool
#     that the page tells you to select, and calling `echo` with the page's example
#     message returns that message echoed back. These are the UI steps' scriptable
#     equivalents, so the walkthrough's end state is verified even though the
#     clicks are not.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The agentgateway UI itself (opening the UI, the Tool Playground, the
#     "Apply CORS" button, the Result card screenshots) - UI-only steps with no
#     command-line equivalent. The test drives the same MCP endpoint the playground
#     drives.
#   * The github-yaml rendering of the config in step 2 - display-only; it
#     embeds the same file the test downloads and validates.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}

# Open an MCP session and return its session ID. MCP responses are server-sent
# events, so `data:` lines are unwrapped before parsing.
mcp_session() {
  curl -sS -D - -o /dev/null --max-time 30 -X POST http://localhost:3000/mcp \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"doctest","version":"1.0"}},"id":1}' \
    | grep -i '^mcp-session-id:' | tr -d '\r' | awk '{print $2}'
}

mcp_call() {
  curl -sS --max-time 30 -X POST http://localhost:3000/mcp \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -H "Mcp-Session-Id: $1" \
    -d "$2" | sed -n 's/^data: //p'
}
{{< /doc-test >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Configure the agentgateway

1. Download an MCP configuration for your agentgateway.

   ```yaml {paths="mcp-stdio"}
   curl -L https://agentgateway.dev/examples/mcp-basic/config.yaml -o config.yaml
   ```

   {{< doc-test paths="mcp-stdio" >}}
   agentgateway -f config.yaml --validate-only
   {{< /doc-test >}}

2. Review the configuration file. 

   ```
   cat config.yaml
   ```

   {{% github-yaml  url="https://agentgateway.dev/examples/mcp-basic/config.yaml" %}}

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   {{< reuse "agw-docs/snippets/example-basic-mcp.md" >}}

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

{{< doc-test paths="mcp-stdio" >}}
# Run the gateway in the background so the MCP assertions below can drive it. The
# visible "Run the agentgateway" block is untagged because it runs in the foreground.
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
# The stdio target launches the MCP server through npx, which downloads the package
# on first use, so allow time for the target to become ready.
for i in $(seq 1 30); do
  curl -sf -o /dev/null --max-time 5 http://localhost:15021/healthz/ready && break
  sleep 2
done
{{< /doc-test >}}

{{< doc-test paths="mcp-stdio" >}}
# The API equivalent of the "Verify access to tools" playground steps: open a
# session, confirm the `echo` tool the page tells you to select is listed, then call
# it with the page's example message and check the echoed result.
SESSION=""
for i in $(seq 1 20); do
  SESSION=$(mcp_session)
  [ -n "$SESSION" ] && break
  sleep 3
done
if [ -z "$SESSION" ]; then
  echo "FAIL: could not open an MCP session against the configured target"
  exit 1
fi
echo "✓ MCP session initialized"

mcp_call "$SESSION" '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null

TOOLS=$(mcp_call "$SESSION" '{"jsonrpc":"2.0","method":"tools/list","id":2}')
if [ "$(jq -r '[.result.tools[].name] | index("echo") // "missing"' <<<"$TOOLS")" = "missing" ]; then
  echo "FAIL: tools/list did not include the echo tool"
  jq -c '[.result.tools[].name]' <<<"$TOOLS"
  exit 1
fi
echo "✓ tools/list includes the echo tool"

RESULT=$(mcp_call "$SESSION" '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"This is my first agentgateway setup."}},"id":3}')
TEXT=$(jq -r '.result.content[0].text // ""' <<<"$RESULT")
case "$TEXT" in
  *"This is my first agentgateway setup."*)
    echo "✓ Calling the echo tool returned the message: $TEXT" ;;
  *)
    echo "FAIL: the echo tool did not echo the message back"
    echo "$RESULT"
    exit 1 ;;
esac
{{< /doc-test >}}
