---
title: MCP multiplexing
weight: 20
description:
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
      binds:
      - port: 3000
        listeners:
        - routes:
          - policies:
              cors:
                allowOrigins:
                  - "*"
                allowHeaders:
                  - "*"
            backends:
      ...
      ```

4. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```

## Verify access to tools

1. Open the [agentgateway UI](http://localhost:15000/ui/) to view your listener and target configuration.

2. Connect to the MCP test server with the agentgateway UI playground. 

   1. From the navigation menu, click [**Playground**](http://localhost:15000/ui/playground/).
      
      {{< reuse-image src="img/agentgateway-ui-playground.png" >}}

   2. In the **Testing** card, review your **Connection** details and click **Connect**. The agentgateway UI connects to the targets that you configured and retrieves the tools that are exposed on the targets. 
   
   3. Verify that you see a list of **Available Tools**. Note that the tools are listed twice, one time with the prefix `time` and one time with the prefix `everything`. You now have a federated view of all the tools that are exposed on all defined targets.
   
      {{< reuse-image src="img/ui-playground-multi-tools.png" >}}

3. Verify access to tools from both targets. 
   1. From the **Available Tools** list, select the `everything_echo` tool. 
   2. In the **message** field, enter any string, such as `hello world`, and click **Run Tool**. 
   3. Verify that you see your message echoed in the **Response** card. 
   
      {{< reuse-image src="img/agentgateway-ui-tool-echo-hello.png" >}}
   4. Repeat the steps with the `time_get_current_time` tool with your timezone, such as `America/New_York`. 
   
      {{< reuse-image src="img/ui-tool-time-current.png" >}}
