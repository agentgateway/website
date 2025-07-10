---
title: MCP multiplexing
weight: 10
description:
---

Federate tools of multiple MCP servers on the Agent Gateway by using MCP multiplexing.

## Configure the Agent Gateway

1. Create a multiplex configuration for your Agent Gateway. In this example, the Agent Gateway is configured as follows: 
   * **Listener**: An SSE listener is configured and bound on port 3000. It includes a basic route that matches all traffic to an MCP backend.
   * **Backend**: The backend defines two targets: `time` and `everything`. Note that the target names cannot include underscores (`_`). These targets are exposed together a single MCP server to clients.

   ```yaml
   cat <<EOF > config.yaml
   {{< github url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/multiplex/config.yaml" >}}
   EOF
   ```
   
2. Run the Agent Gateway. 
   ```sh
   agentgateway -f config.yaml
   ```
   
## Verify access to tools

1. Open the [Agent Gateway UI](http://localhost:19000/ui/) to view your listener and target configuration.

2. Connect to the MCP server with the Agent Gateway UI playground. 
   1. Go to the Agent Gateway UI [**Playground**](http://localhost:19000/ui/playground/).
   2. In the **Connection Settings** card, select your **Listener Endpoint** and click **Connect**. The Agent Gateway UI connects to the target that you configured and retrieves the tools that are exposed on the target. 
   3. Verify that you see a list of **Available Tools** and that all tools are listed twice, one time with the prefix `time` and one time with the prefix `everything`. You now have a federated view of all the tools that are exposed on all defined targets.
   
      {{< reuse-image src="img/agentgateway-ui-tools-multiplex.png" >}}

3. Verify access to a tool. 
   1. Select the `everything_echo` tool, enter any string in the **message** field, such as `hello world`, and click **Run Tool**. Verify that access to the tool is granted and that you see your message echoed. 
   
      {{< reuse-image src="img/agentgateway-ui-tool-echo-hello.png" >}}
   
   2. Select the `everything-else_echo` tool, enter any string in the **message** field, such as `hello everything else`, and click **Run Tool**. Verify that access to the tool is granted and that you also see your message echoed. 
   
      {{< reuse-image src="img/agentgateway-ui-tool-echo-else.png" >}}