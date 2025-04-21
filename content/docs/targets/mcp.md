---
title: MCP
weight: 10
description: Expose tools that are hosted on an MCP server on the agentproxy. 
---

Expose tools that are hosted on an MCP server on the agentproxy. 

## About MCP

[Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) is an open protocol that standardizes how Large Language Model (LLM) applications connect to various external data sources and tools. Without MCP, you need to implement custom integrations for each tool that your LLM application needs to access. However, this approach is hard to maintain and can cause issues when you want to scale your environment. With MCP, you can significantly speed up, simplify, and standardize these types of integrations.

An MCP server exposes external data sources and tools so that LLM applications can access them. Typically, you want to deploy these servers remotely and have authorization mechanisms in place so that LLM applications can safely access the data.

With agentproxy, you can connect to one or multiple MCP servers in any environment. The agentproxy proxies requests to the MCP tool that is exposed on the server. You can also use the agentproxy to federate tools from multiple MCP servers. For more information, see the [Multiple targets](/docs/setup/examples/multiple-targets) guide. 

## Configure the agentproxy

1. Create a listener and target configuration for your agentproxy. In this example, the agentproxy is configured as follows: 
   * **Listener**: An SSE listener is configured and exposed on port 3000. 
   * **Target**: The agentproxy targets a sample, open source MCP test server, `server-everything`. 
   ```sh
   cat <<EOF > config.json
   {{< github url="https://raw.githubusercontent.com/agentproxy-dev/agentproxy/refs/heads/main/examples/basic/config.json" >}}
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
   
4. From the menu bar, select **Tools**. 
   2. Click **List Tools**. 
   3. Select the `everything_echo` tool, enter any string in the **message** field, such as `hello`, and click **Run Tool**. Verify that access to the tool is granted and that you see your message echoed. 
      {{< reuse-image src="img/mcp-access-granted.png" >}}