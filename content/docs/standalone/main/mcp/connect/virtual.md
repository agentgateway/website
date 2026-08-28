---
title: Virtual MCP
weight: 20
description: Federate multiple MCP servers into a unified virtual MCP backend
test:
  mcp-virtual:
  - file: ${versionRoot}/mcp/connect/virtual.md
    path: mcp-virtual
---

Federate tools of multiple MCP servers on the agentgateway by using MCP {{< gloss "Multiplex" >}}multiplexing{{< /gloss >}}.

{{< doc-test paths="mcp-virtual" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Configure the agentgateway" step 1: the documented download URL resolves and
#     returns a config that agentgateway accepts (--validate-only).
#   * "Verify access to tools" steps 5-7, through the MCP API rather than the UI
#     playground: the downloaded multiplex config runs, tools/list returns tools
#     federated from both targets with target-name prefixes
#     (`time_get_current_time`, `everything_echo`), calling `everything_echo`
#     echoes the page's example message, and calling `time_get_current_time` with
#     `America/New_York` returns a time result.
#   * "Tool name prefixing": the `prefixMode: never` example config is accepted, and
#     all three rows of the prefixMode table are asserted at runtime against a live
#     MCP session:
#       - conditional (default), two targets -> names are prefixed
#       - always, one target                 -> names are prefixed even with one target
#       - never                              -> names are plain (echo)
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The published multiplex config's `time` target needs `uvx mcp-server-time` to
#     resolve an MCP Python SDK older than 2.x, because that release renamed
#     McpError and the server fails to import against it. agentgateway#2873 adds the
#     `--with mcp<2` constraint to the example; until that lands and redeploys, the
#     test applies the same constraint to its local copy. Once the published config
#     carries it, the test runs the downloaded file verbatim.
#   * The agentgateway UI steps (Tool Playground, Apply CORS, Initialize, the
#     screenshots) - UI-only, no command-line equivalent. The test drives the same
#     MCP endpoint the playground drives.
#   * The two collapsed "details" example configs ("Example multiplexing configuration"
#     and "Example load balancing configuration") - display-only structural excerpts;
#     neither is a complete config (no gateways/routes, and the backends entry omits
#     its required `name`), so neither can be validated as written.
#   * The step 3 optional CORS config - display-only; it is a complete config, but the
#     test exercises the downloaded config.yaml, which carries no CORS policy.
#   * That load balancing distributes across backends by weight - requires
#     config/traffic the page omits; the load balancing example is contrast material,
#     not a walkthrough.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}

# The stdio targets launch their MCP servers through npx and uvx. Fetch both up
# front: otherwise the first start pays a cold registry download inside every
# readiness retry loop below, which is slow enough to time the test out.
npm install -g @modelcontextprotocol/server-everything >/dev/null 2>&1 || true

# "Before you begin" step 2 installs uv. The agentgateway install snippet already put
# $HOME/.local/bin on PATH, which is where the uv installer places its binaries.
if ! command -v uvx >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null 2>&1 || true
fi
uvx --with 'mcp<2' mcp-server-time --help >/dev/null 2>&1 || true

# Open an MCP session and list the tool names it exposes. MCP responses are
# server-sent events, so `data:` lines are unwrapped before parsing.
mcp_tool_names() {
  local sid
  sid=$(curl -sS -D - -o /dev/null --max-time 10 -X POST http://localhost:3000/mcp \
    -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"doctest","version":"1.0"}},"id":1}' \
    | grep -i '^mcp-session-id:' | tr -d '\r' | awk '{print $2}')
  [ -n "$sid" ] || return 1
  curl -sS --max-time 10 -o /dev/null -X POST http://localhost:3000/mcp \
    -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
    -H "Mcp-Session-Id: $sid" -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
  echo "$sid" > .mcp-session
  curl -sS --max-time 15 -X POST http://localhost:3000/mcp \
    -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
    -H "Mcp-Session-Id: $sid" -d '{"jsonrpc":"2.0","method":"tools/list","id":2}' \
    | sed -n 's/^data: //p' | jq -r '[.result.tools[].name] | join(" ")'
}

# Start a config in the background. This must NOT be called inside a command
# substitution: AGW_PID would be set in the subshell and the parent would never stop
# the gateway, leaving port 3000 held for the next config. The gateway's output goes
# to a file for the same reason -- inside `$( )` it would be captured into the value.
start_gateway() {
  agentgateway -f "$1" > "agw-$1.log" 2>&1 &
  AGW_PID=$!
}

# Wait for the stdio targets to come up and echo the multiplexed tool names. Pure
# curl, no background jobs, so it is safe to call inside a command substitution.
# ~15 attempts x (10s max curl + 2s sleep) bounds this at about 3 minutes.
wait_for_tools() {
  local names=""
  for i in $(seq 1 15); do
    names=$(mcp_tool_names 2>/dev/null || true)
    [ -n "$names" ] && break
    sleep 2
  done
  echo "$names"
}

stop_gateway() {
  [ -n "${AGW_PID:-}" ] || return 0
  kill "$AGW_PID" 2>/dev/null || true
  wait "$AGW_PID" 2>/dev/null || true
  AGW_PID=""
}

trap 'stop_gateway' EXIT
{{< /doc-test >}}

## About multiplexing {#about}

Multiplexing combines multiple MCP servers (targets) within a single backend into one unified MCP server. All targets are exposed together so that clients can access tools from all targets simultaneously. By default, when a backend has more than one target, tool names are prefixed with the target name (e.g., `time_get_current_time`, `everything_echo`) to avoid collisions. You can change this behavior with the `prefixMode` field, described in [Tool name prefixing](#tool-name-prefixing).

Multiplexing is a property of putting several targets in one backend, not of the top-level `mcp` section. You get the same result from `routes[].backends[].mcp`. To expose each MCP server on its own path instead, give each one its own backend. For help choosing, and for how the choice affects authentication, see [MCP configuration modes]({{< link-hextra path="/mcp/configuration-modes" >}}).

{{% details title="Example multiplexing configuration" closed="false" %}}

```yaml
mcp:
  port: 3000
  # Multiple targets for multiplexing
  targets:
  - name: time
    stdio:
      cmd: uvx
      args: ["--with", "mcp<2", "mcp-server-time"]
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```
{{% /details %}}
**Multiplexing vs. load balancing**
Although configured similarly, multiplexing is different than load balancing. Load balancing distributes requests across multiple backends. Each request goes to one backend, selected based on weight. You configure load balancing with multiple backends in a route (instead of multiple targets). For more information, see [Backend routing]({{< link-hextra path="/configuration/traffic-management/matching/#backend-routing" >}}).
{{% details title="Example load balancing configuration" closed="true" %}}
```yaml
routes:
  - backends:           # Multiple backends = load balancing
      - mcp:
          targets:
            - name: everything
              stdio:
                cmd: npx
                args: ["@modelcontextprotocol/server-everything"]
        weight: 1
      - mcp:
          targets:
            - name: everything
              stdio:
                cmd: npx
                args: ["@modelcontextprotocol/server-everything"]
        weight: 1
```
{{% /details %}}

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. {{< reuse "agw-docs/snippets/prereq-uv.md" >}}

## Configure the agentgateway

1. Download a multiplex configuration for your agentgateway.

   ```yaml {paths="mcp-virtual"}
   curl -L https://agentgateway.dev/examples/mcp-multiplex/config.yaml -o config.yaml
   ```

   {{< doc-test paths="mcp-virtual" >}}
   # Step 1: the documented multiplex config downloads and is accepted
   agentgateway -f config.yaml --validate-only
   {{< /doc-test >}}

2. Review the configuration file. 

   ```
   cat config.yaml
   ```

   {{% github-yaml url="https://agentgateway.dev/examples/mcp-multiplex/config.yaml" %}}

   * **Listener**: An HTTP listener is configured and bound on port 3000. It includes a basic route that matches all traffic to an MCP backend.
   * **Backend**: The MCP backend defines two **targets**: `time` and `everything`. Note that the target names cannot include underscores (`_`). These targets are multiplexed together and exposed as a single unified MCP server to clients. All tools from both targets are available, prefixed with their target name.

3. Optional: To use the agentgateway UI playground later, add a `cors` policy to the route. Replace the contents of your `config.yaml` file with the following complete example, which keeps both targets and adds the policy. The config automatically reloads when you save the file.

      ```yaml
      # yaml-language-server: $schema=https://agentgateway.dev/schema/config
      gateways:
        default:
          port: 3000
      routes:
      - policies:
          cors:
            allowOrigins: ["*"]
            allowHeaders: ["*"]
            exposeHeaders: ["Mcp-Session-Id"]
        backends:
        - mcp:
            targets:
            - name: time
              stdio:
                cmd: uvx
                # Constrain the MCP SDK until mcp-server-time supports mcp 2.x.
                args: ["--with", "mcp<2", "mcp-server-time"]
            - name: everything
              stdio:
                cmd: npx
                args: ["@modelcontextprotocol/server-everything"]
      ```

4. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```

## Verify access to tools

1. Open the [agentgateway UI](http://localhost:15000/ui/) to view your listener and target configuration.

2. From the navigation menu under **MCP**, click **Tool Playground**.

3. If you see a banner prompting you to allow browser access, click **Apply CORS**. This adds the UI's origin to the MCP CORS policy so the playground can open a session, and the configuration reloads automatically.

4. Click **Initialize**. The agentgateway UI opens an MCP session and lists the tools that are exposed across all targets in the backend.

5. Verify that the **Result** panel reports the discovered tools and that each tool name is prefixed with its target name, such as `everything_echo` and `time_get_current_time`. You now have a federated view of the tools from every target in the backend.

   {{< reuse-image-light src="img/ui-playground-multi-tools.png" >}}
   {{< reuse-image-dark srcDark="img/ui-playground-multi-tools-dark.png" >}}

6. Verify access to a tool from the `everything` target.
   1. From the **Tool** dropdown, select the `everything_echo` tool.
   2. In the **Message** field, enter any string, such as `hello world`, and click **Call tool**.
   3. Verify that the **Result** panel returns `HTTP 200` and that your message is echoed in the **Tool output**.

      {{< reuse-image-light src="img/agentgateway-ui-tool-echo-hello.png" >}}
      {{< reuse-image-dark srcDark="img/agentgateway-ui-tool-echo-hello-dark.png" >}}

7. Verify access to a tool from the `time` target.
   1. From the **Tool** dropdown, select the `time_get_current_time` tool.
   2. In the **timezone** field, enter a timezone, such as `America/New_York`, and click **Call tool**.
   3. Verify that the **Result** panel returns `HTTP 200` with the current time in the **Tool output**.

      {{< reuse-image-light src="img/ui-tool-time-current.png" >}}
      {{< reuse-image-dark srcDark="img/ui-tool-time-current-dark.png" >}}

## Tool name prefixing {#tool-name-prefixing}

When you multiplex multiple targets, agentgateway namespaces tool and prompt names with the target name so that identical names from different servers do not collide. Resource URIs retain target routing information and are unaffected. Control this behavior with the `prefixMode` field on the MCP configuration.

| `prefixMode` | Behavior |
|--------------|----------|
| `conditional` (default) | Prefix tool and prompt names only when the backend has more than one target. |
| `always` | Always prefix names, even when the backend has a single target. |
| `never` | Never prefix names. Calls are routed by looking up which target serves the name, so names must be unique across all targets. |

Use `never` when clients need to call tools by their plain names, such as for [MCP Apps]({{< link-hextra path="/mcp/apps" >}}) that issue tool calls from a rendered UI. Because unprefixed names must be unique, agentgateway fails to start if two targets expose the same tool name in this mode.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  prefixMode: never
  targets:
  - name: time
    stdio:
      cmd: uvx
      args: ["--with", "mcp<2", "mcp-server-time"]
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```

> [!NOTE]
> The `time` target pins the MCP Python SDK with `--with mcp<2` because `mcp-server-time` does not yet support version 2.x of the SDK. Without the constraint, the target fails to start. Drop the constraint after `mcp-server-time` adds support.

## Next steps

- Apply different policies to different MCP targets with [MCP target policies]({{< link-hextra path="/mcp/mcp-target-policies/" >}}).

{{< doc-test paths="mcp-virtual" >}}
# Run the downloaded multiplex config and assert the federated tool list and both
# tool calls from "Verify access to tools" steps 5-7.
#
# The published example's `time` target needs an MCP Python SDK older than 2.x
# (agentgateway#2873). Use the downloaded file as-is once it carries that
# constraint; until then, apply the same constraint to a local copy so the target
# can start.
if grep -q 'mcp<2' config.yaml; then
  cp config.yaml config-multiplex.yaml
else
  sed 's/args: \["mcp-server-time"\]/args: ["--with", "mcp<2", "mcp-server-time"]/' \
    config.yaml > config-multiplex.yaml
fi
agentgateway -f config-multiplex.yaml --validate-only

start_gateway config-multiplex.yaml
NAMES=$(wait_for_tools)
case "$NAMES" in
  *time_get_current_time*) ;;
  *) echo "FAIL: tools/list did not include time_get_current_time from the time target"
     echo "$NAMES"; exit 1 ;;
esac
case "$NAMES" in
  *everything_echo*) ;;
  *) echo "FAIL: tools/list did not include everything_echo from the everything target"
     echo "$NAMES"; exit 1 ;;
esac
echo "✓ Step 5: tools/list federates both targets with target-name prefixes"

SESSION=$(cat .mcp-session)
mcp_tool_call() {
  curl -sS --max-time 15 -X POST http://localhost:3000/mcp \
    -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
    -H "Mcp-Session-Id: $SESSION" -d "$1" | sed -n 's/^data: //p'
}

RESULT=$(mcp_tool_call '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"everything_echo","arguments":{"message":"hello world"}},"id":3}')
case "$(jq -r '.result.content[0].text // ""' <<<"$RESULT")" in
  *"hello world"*) echo "✓ Step 6: everything_echo routes to the everything target and echoes the message" ;;
  *) echo "FAIL: everything_echo did not return the message"; echo "$RESULT"; exit 1 ;;
esac

RESULT=$(mcp_tool_call '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"time_get_current_time","arguments":{"timezone":"America/New_York"}},"id":4}')
case "$(jq -r '.result.content[0].text // ""' <<<"$RESULT")" in
  *America/New_York*) echo "✓ Step 7: time_get_current_time routes to the time target and returns a time" ;;
  *) echo "FAIL: time_get_current_time did not return a result for America/New_York"; echo "$RESULT"; exit 1 ;;
esac
stop_gateway
echo "✓ prefixMode conditional (default): two targets produce prefixed names"
{{< /doc-test >}}

{{< doc-test paths="mcp-virtual" >}}
# "Tool name prefixing": validate the documented prefixMode: never config, then assert
# the always and never rows of the table. Both use a single npx target, because
# `always` is only distinguishable from the default with one target and `never`
# requires names that do not collide.
cat <<'EOF' > config-prefix-never.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  prefixMode: never
  targets:
  - name: time
    stdio:
      cmd: uvx
      args: ["--with", "mcp<2", "mcp-server-time"]
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config-prefix-never.yaml --validate-only

cat <<'EOF' > config-always.yaml
mcp:
  port: 3000
  prefixMode: always
  targets:
  - name: alpha
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
sed 's/prefixMode: always/prefixMode: never/' config-always.yaml > config-never.yaml
agentgateway -f config-always.yaml --validate-only >/dev/null
agentgateway -f config-never.yaml --validate-only >/dev/null

start_gateway config-always.yaml
NAMES=$(wait_for_tools)
stop_gateway
case "$NAMES" in
  *alpha_echo*) echo "✓ prefixMode always: a single target still produces prefixed names" ;;
  *) echo "FAIL: prefixMode always did not prefix names for a single target"; echo "$NAMES"; exit 1 ;;
esac

start_gateway config-never.yaml
NAMES=$(wait_for_tools)
stop_gateway
case "$NAMES" in
  *alpha_echo*) echo "FAIL: prefixMode never still prefixed names"; echo "$NAMES"; exit 1 ;;
  *echo*) echo "✓ prefixMode never: names are unprefixed (echo)" ;;
  *) echo "FAIL: prefixMode never did not expose the echo tool"; echo "$NAMES"; exit 1 ;;
esac
{{< /doc-test >}}
