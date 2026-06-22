---
title: Virtual MCP
weight: 20
description: Federate multiple MCP servers into a unified virtual MCP backend
---

Federate tools of multiple MCP servers on the agentgateway by using MCP {{< gloss "Multiplex" >}}multiplexing{{< /gloss >}}.

## About multiplexing {#about}

Multiplexing combines multiple MCP servers (targets) within a single backend into one unified MCP server. All targets are exposed together so that clients can access tools from all targets simultaneously. Tools are prefixed with the target name (e.g., `time_get_current_time`, `everything_echo`) 

{{% details title="Example multiplexing configuration" closed="false" %}}

```yaml
backends:
  - mcp:
      # Multiple targets for multiplexing
      targets:
        - name: time
          stdio:
            cmd: uvx
            args: ["mcp-server-time"]
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

   ```yaml
   curl -L https://agentgateway.dev/examples/multiplex/config.yaml -o config.yaml
   ```

2. Review the configuration file. 

   ```
   cat config.yaml
   ```

   {{% github-yaml url="https://agentgateway.dev/examples/multiplex/config.yaml" %}}

   * **Listener**: An HTTP listener is configured and bound on port 3000. It includes a basic route that matches all traffic to an MCP backend.
   * **Backend**: The MCP backend defines two **targets**: `time` and `everything`. Note that the target names cannot include underscores (`_`). These targets are multiplexed together and exposed as a single unified MCP server to clients. All tools from both targets are available, prefixed with their target name.

3. Optional: To use the agentgateway UI playground later, add the following CORS policy to your `config.yaml` file. The config automatically reloads when you save the file.
      
      ```yaml
      # yaml-language-server: $schema=https://agentgateway.dev/schema/config
      mcp:
        port: 3000
        policies:
          cors:
            allowOrigins:
              - "*"
            allowHeaders:
              - "*"
        targets:
      ...
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
   2. In the **message** field, enter any string, such as `hello world`, and click **Call tool**.
   3. Verify that the **Result** panel returns `HTTP 200` and that your message is echoed in the **Tool output**.

      {{< reuse-image-light src="img/agentgateway-ui-tool-echo-hello.png" >}}
      {{< reuse-image-dark srcDark="img/agentgateway-ui-tool-echo-hello-dark.png" >}}

7. Verify access to a tool from the `time` target.
   1. From the **Tool** dropdown, select the `time_get_current_time` tool.
   2. In the **timezone** field, enter a timezone, such as `America/New_York`, and click **Call tool**.
   3. Verify that the **Result** panel returns `HTTP 200` with the current time in the **Tool output**.

      {{< reuse-image-light src="img/ui-tool-time-current.png" >}}
      {{< reuse-image-dark srcDark="img/ui-tool-time-current-dark.png" >}}

## Next steps

- Apply different policies to different MCP targets with [MCP target policies]({{< link-hextra path="/mcp/mcp-target-policies/" >}}).
