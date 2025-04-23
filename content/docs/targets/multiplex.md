---
title: MCP multiplexing
weight: 10
description:
---

Federate tools of multiple MCP servers on the agentproxy by using MCP multiplexing.

## Configure the agentproxy

1. Create a listener and target configuration for your agentproxy. In this example, the agentproxy is configured as follows: 
   * **Listener**: An SSE listener is configured and exposed on port 3000. 
   * **Target**: The agentproxy defines two targets that both point to the same sample MCP server, `server-everything`. To federate the tools of the MCP server targets, you give each target a unique name. This name is used as a prefix for the tools that are exposed on the MCP server. In this example, the `everything` and `everything-else` prefixes are used. Note that the prefix name cannot include underscores (`_`).

   ```sh
   cat <<EOF > config.json
   {{< github url="https://raw.githubusercontent.com/agentproxy-dev/agentproxy/refs/heads/main/examples/multiplex/config.json" >}}
   EOF
   ```
   
2. Run the agentproxy. 
   ```sh
   agentproxy -f config.json
   ```
   
## Verify access to tools

1. Open the [agentproxy UI](http://localhost:19000/ui/). 

2. Connect to the MCP server with the agentproxy UI playground. 
   1. Go to the agentproxy UI [**Playground**](http://localhost:19000/ui/playground/).
   2. In the **Connection Settings** card, select your listener and click **Connect**. The agentproxy UI connects to the target that you configured and retrieves the tools that are exposed on the target. 
   3. Verify that you see a list of **Available Tools** and that all tools are listed twice, one time with the prefix `everything` and one time with the prefix `everything-else`. You now have a federated view of all the tools that are exposed on all defined targets.
   
      {{< reuse-image src="img/agentproxy-ui-tools-multiplex.png" >}}

6. Verify access to a tool. 
   1. Select the `everything_echo` tool, enter any string in the **message** field, such as `hello`, and click **Run Tool**. Verify that access to the tool is granted and that you see your message echoed. 
   
      {{< reuse-image src="img/agentproxy-ui-tool-echo-hello.png" >}}
   
   2. Select the `everything-else_echo` tool, enter any string in the **message** field, such as `hello everything else`, and click **Run Tool**. Verify that access to the tool is granted and that you also see your message echoed. 
   
      {{< reuse-image src="img/agentproxy-ui-tool-echo-else.png" >}}