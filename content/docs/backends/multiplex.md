---
title: MCP multiplexing
weight: 10
description:
---

Federate tools of multiple MCP servers on the agentgateway by using MCP multiplexing.

## Configure the agentgateway

1. Download a multiplex configuration for your agentgateway.

   ```yaml
   curl -L https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/multiplex/config.yaml -o config.yaml
   ```

2. Review the configuration file. 

   ```
   cat config.yaml
   ```

   {{% github-yaml url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/multiplex/config.yaml" %}}

   * **Listener**: An HTTP listener is configured and bound on port 3000. It includes a basic route that matches all traffic to an MCP backend.
   * **Backend**: The backend defines two targets: `time` and `everything`. Note that the target names cannot include underscores (`_`). These targets are exposed together a single MCP server to clients.

3. Optional: To use the agentgateway UI playground later, add the following CORS policy to your `config.yaml` file. The config automatically reloads when you save the file.
      
      ```yaml
      binds:
      - post: 3000
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
