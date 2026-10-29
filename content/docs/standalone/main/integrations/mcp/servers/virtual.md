---
title: Virtual MCP
weight: 20
description: Federate multiple MCP servers into a unified virtual MCP backend
---

Federate tools of multiple MCP servers on the agentgateway by using MCP {{< gloss "Multiplex" >}}multiplexing{{< /gloss >}}.

## About multiplexing {#about}

Multiplexing combines multiple MCP servers (targets) within a single backend into one unified MCP server. All targets are exposed together so that clients can access tools from all targets simultaneously. By default, when a backend has more than one target, tool names are prefixed with the target name (e.g., `time_get_current_time`, `everything_echo`) to avoid collisions. You can change this behavior with the `prefixMode` field, described in [Tool name prefixing](#tool-name-prefixing).

Multiplexing is a property of putting several targets in one backend, not of the top-level `mcp` section. You get the same result from `routes[].backends[].mcp`. To expose each MCP server on its own path instead, give each one its own backend. For help choosing, and for how the choice affects authentication, see [MCP configuration modes]({{< link-hextra path="/documentation/mcp/configuration-modes" >}}).

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
Although configured similarly, multiplexing is different than load balancing. Load balancing distributes requests across multiple backends. Each request goes to one backend, selected based on weight. You configure load balancing with multiple backends in a route (instead of multiple targets). For more information, see [Backend routing]({{< link-hextra path="/documentation/configuration/traffic-management/matching/#backend-routing" >}}).
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

You can add the MCP servers in the UI or in a configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
The UI adds both targets to the top-level `mcp` section, as in the [example multiplexing configuration](#about). The downloaded configuration in the **Config file** tab puts the same targets in a route backend instead. Both setups multiplex the targets in the same way.

1. Create a configuration with an empty `mcp` section, and start agentgateway. You add the MCP servers in the UI.
   ```sh
   cat <<'EOF' > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   mcp:
     port: 3000
     targets: []
   EOF
   agentgateway -f config.yaml
   ```
2. Open [http://localhost:15000/ui/mcp/servers](http://localhost:15000/ui/mcp/servers) (**MCP** > **Servers**), and add the `time` server.
   1. Click **Add server**.
   2. Enter `time` for the **Server name**, and select the **Command Line** transport. Target names cannot include underscores (`_`).
   3. Enter `uvx` for the **Command** and `--with mcp<2 mcp-server-time` for the **Arguments**.

      {{< reuse-image src="img/ui-mcp-servers-add-time.png" srcDark="img/ui-mcp-servers-add-time-dark.png" alt="Add MCP server drawer for the time target with the uvx command and the mcp-server-time arguments" >}}

   4. Click **Save server**.
3. Add the `everything` server.
   1. Click **Add server**.
   2. Enter `everything` for the **Server name**, and select the **Command Line** transport.
   3. Enter `npx` for the **Command** and `@modelcontextprotocol/server-everything` for the **Arguments**.
   4. Click **Save server**.

The **MCP Servers** page lists both servers. The UI writes each target with an empty `env` map and `clear_env: false`.

To use the UI playground, you also need a CORS policy. In the UI, you add it with **Apply CORS** when you verify the setup in the next section.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
1. Download a multiplex configuration for your agentgateway.

   ```yaml
   curl -L https://agentgateway.dev/examples/mcp-multiplex/config.yaml -o config.yaml
   ```

2. Review the configuration file. 

   ```sh
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
{{% /tab %}}
{{< /tabs >}}

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

Use `never` when clients need to call tools by their plain names, such as for [MCP Apps]({{< link-hextra path="/documentation/mcp/apps" >}}) that issue tool calls from a rendered UI. Because unprefixed names must be unique, agentgateway fails to start if two targets expose the same tool name in this mode.

You can set the prefix mode in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
1. Open [http://localhost:15000/ui/mcp/servers](http://localhost:15000/ui/mcp/servers) (**MCP** > **Servers**), and click **Settings**. Expand **MCP behavior**.
2. For **Prefix mode**, select **Never**.
3. Check **State mode**. If `statefulMode` is not set in your configuration, the drawer still shows **Stateless** and saves it, so select **Stateful** to keep the default session behavior.

   {{< reuse-image src="img/ui-mcp-settings-prefix-never.png" srcDark="img/ui-mcp-settings-prefix-never-dark.png" alt="MCP servers settings drawer with the prefix mode set to Never and the state mode set to Stateful" >}}

4. Click **Save settings**.

The UI sets `prefixMode` to `never`, as in the **Config file** tab. It also writes the selected state mode, sets `failureMode` to `failClosed`, and writes an empty `gateways` list. The **None** option removes `prefixMode`, so the default `conditional` behavior applies, and names are still prefixed when the backend has more than one target.
{{% /tab %}}
{{% tab name="Config file" %}}
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
{{% /tab %}}
{{< /tabs >}}

> [!NOTE]
> The `time` target pins the MCP Python SDK with `--with mcp<2` because `mcp-server-time` does not yet support version 2.x of the SDK. Without the constraint, the target fails to start. Drop the constraint after `mcp-server-time` adds support.

## Target conditions {#target-conditions}

Set `condition` on an MCP target to include it only when a CEL expression returns `true`. Omit `condition` to always include the target. A condition requires at least two configured targets.

The expression can read request attributes, such as headers, and `mcp.target.name`, the target under evaluation. With authentication configured, it can also read the authenticated identity.

Agentgateway evaluates conditions before contacting targets. The `mcpAuthorization` policy filters list responses after agentgateway contacts the targets. See [About MCP guardrails]({{< link-hextra path="/documentation/mcp/guardrails/about" >}}) to compare the filtering options.

If every condition returns `false`, clients see an empty virtual MCP server.

The following example always includes the `everything` target and includes the `time` target only when the request has the header `x-include-time: true`.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
  - name: time
    condition: '"x-include-time" in request.headers && request.headers["x-include-time"] == "true"'
    stdio:
      cmd: uvx
      args: ["--with", "mcp<2", "mcp-server-time"]
```

Configure your MCP client to send `x-include-time: true` on its requests, including initialization, to expose tools such as `time_get_current_time` alongside `everything_echo`. Without that header, or with a different value, only the `everything` target participates.

Conditions run on every request. Keep these behaviors in mind:

* **Stateful sessions (default)**: Each request must select the same targets as at initialization. A change, such as dropping the `x-include-time` header, returns `404` with `session not found`.
* **Session recovery**: After a session `404`, the MCP specification requires the client to start a new session. Its requests determine the new target selection.
* **Stateless sessions**: In stateless mode, each request uses the targets its conditions select.
* **Stable names**: Tool and prompt names keep their target-name prefix even when only one target remains.
* **Excluded targets**: Their tools are absent from lists. Calls to those tools fail because the target is not part of the session.
* **Evaluation errors**: Agentgateway excludes the target if its condition fails to evaluate, such as when it reads a missing JWT claim.

| Field | Description |
| ----- | ----------- |
| `mcp.targets[].condition` | Optional CEL expression that controls whether the target participates in the virtual MCP request. The expression must return a boolean value. |
| `mcp.target.name` | Name of the MCP target for the current target-scoped operation, including condition evaluation. |

## Server information overrides {#server-information-overrides}

When you multiplex multiple targets, the client receives the gateway MCP `serverInfo` values and instructions. To customize that metadata, set the `server` block on the MCP configuration. The override applies only to multiplexed targets. A backend with one target keeps the target server's normal metadata.

{{< tabs >}}
{{% tab name="UI" %}}
1. Open [http://localhost:15000/ui/mcp/servers](http://localhost:15000/ui/mcp/servers) (**MCP** > **Servers**), and click **Settings**. Expand **Server info**.
2. For **Name** and **Version**, enter `company-mcp-gateway` and `2026.09`. Set both fields or leave both empty.
3. For **Title**, enter `Company MCP Gateway`.
4. For **Instructions**, enter `Use this gateway to access approved internal MCP tools.`
5. Expand **MCP behavior**. Check **State mode**. If `statefulMode` is not set in your configuration, the drawer still shows **Stateless** and saves it, so select **Stateful** to keep the default session behavior.
6. Click **Save settings**.

The UI sets the `server` block, as in the **Config file** tab. The UI also writes the other drawer values: the selected state mode, `failureMode` (`failClosed` if it was not set), and an empty `gateways` list with the port if no gateway is bound. To remove the overrides, clear all four fields and save.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  server:
    name: company-mcp-gateway
    version: "2026.09"
    title: Company MCP Gateway
    instructions: "Use this gateway to access approved internal MCP tools."
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
{{% /tab %}}
{{< /tabs >}}

| Field | Description |
| ----- | ----------- |
| `mcp.server` | Optional overrides for the MCP `serverInfo` response and gateway instructions in `initialize` and `server/discover` responses. Omit this block to keep the default values. |
| `mcp.server.name` | Value to report in `serverInfo.name`. Set this field together with `mcp.server.version`. The configuration is invalid when only one of the two fields is set. |
| `mcp.server.version` | Value to report in `serverInfo.version`. Set this field together with `mcp.server.name`. The configuration is invalid when only one of the two fields is set. |
| `mcp.server.title` | Optional value to report in `serverInfo.title`. You can set this field without `mcp.server.name` or `mcp.server.version`. |
| `mcp.server.instructions` | Gateway instructions preamble to report to clients. When upstream targets also return instructions, the merged target instructions start with this value. |

## Capabilities and change notifications {#capabilities}

For sessions with multiple targets, agentgateway merges their capabilities into one `initialize` result. Tools, prompts, and resources are always enabled.

Each of the following capabilities is advertised only if at least one session target offers it:

- `tools.listChanged`
- `prompts.listChanged`
- `resources.listChanged`
- `resources.subscribe`

When you set `statefulMode: stateless`, `initialize` omits these capabilities, even for a single target. Stateless sessions have no notification stream.

Clients using `server/discover` get the same merged capabilities, regardless of `statefulMode`. They receive notifications through `subscriptions/listen`.

Agentgateway skips targets that do not support `subscriptions/listen` without failing the stream.

If no target offers a capability, the result omits it. For example, a backend whose targets offer none of these capabilities returns `"tools": {}`, `"prompts": {}`, and `"resources": {}`.

In this guide, the `everything` target advertises all of these capabilities, and the `time` target advertises none.

Run the configuration from [Configure the agentgateway](#configure-the-agentgateway). Initialize a session and review the returned capabilities.

```sh
curl -s http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}' \
  | sed -n 's/^data: //p' | jq '.result.capabilities'
```

The capabilities come from the `everything` target.

Example output:

```json
{
  "prompts": {
    "listChanged": true
  },
  "resources": {
    "subscribe": true,
    "listChanged": true
  },
  "tools": {
    "listChanged": true
  }
}
```


## Next steps

- Apply different policies to different MCP targets with [MCP target policies]({{< link-hextra path="/documentation/mcp/mcp-target-policies/" >}}).
