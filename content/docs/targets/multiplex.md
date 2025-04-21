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

1. Run the MCP Inspector. 
   ```sh
   SERVER_PORT=9000 npx @modelcontextprotocol/inspector
   ```

2. Open the MCP inspector at the address from the output of the previous command, such as `http://localhost:5173?proxyPort=9000`.

3. Connect to the agentproxy. 
   1. Select `SSE` from the **Transport Type** drop down. 
   2. Enter `http://localhost:3000/sse` in the **URL** field. 
   3. Click **Connect** to connect to the agentproxy. 
   
4. Verify access to tools. 
   1. From the menu bar, select **Tools**. 
   2. Click **List Tools**. 
   3. Review the list of tools. Verify that all tools are listed twice, one time with the prefix `everything` and one time with the prefix `everything-else`. You now have a federated view of all the tools that are exposed on all defined targets.
   4. Select the `everything_echo` tool, enter any string in the **message** field, such as `hello`, and click **Run Tool**. Verify that access to the tool is granted and that you see your message echoed. 
      {{< reuse-image src="img/multiplex-everything.png" >}}
   5. Select the `everything-else_echo` tool, enter any string in the **message** field, such as `hello`, and click **Run Tool**. Verify that access to the tool is granted and that you also see your message echoed. 
      {{< reuse-image src="img/multiplex-everything-else.png" >}}