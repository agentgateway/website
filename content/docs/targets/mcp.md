---
title: MCP
weight: 10
description: Expose tools that are hosted on an MCP server on the Agent Gateway. 
---

Expose tools that are hosted on an MCP server on the Agent Gateway. 

## About MCP

[Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) is an open protocol that standardizes how Large Language Model (LLM) applications connect to various external data sources and tools. Without MCP, you need to implement custom integrations for each tool that your LLM application needs to access. However, this approach is hard to maintain and can cause issues when you want to scale your environment. With MCP, you can significantly speed up, simplify, and standardize these types of integrations.

An MCP server exposes external data sources and tools so that LLM applications can access them. Typically, you want to deploy these servers remotely and have authorization mechanisms in place so that LLM applications can safely access the data.

With Agent Gateway, you can connect to one or multiple MCP servers in any environment. The Agent Gateway proxies requests to the MCP tool that is exposed on the server. You can also use the Agent Gateway to federate tools from multiple MCP servers. For more information, see the [MCP multiplexing](/docs/setup/examples/multiplex) guide. 

## Configure the Agent Gateway

1. Create a listener and target configuration for your Agent Gateway. In this example, the Agent Gateway is configured as follows: 
   * **Listener**: An SSE listener is configured and exposed on port 3000. 
   * **Target**: The Agent Gateway targets a sample, open source MCP test server, `server-everything`. 
   ```sh
   cat <<EOF > config.json
   {{< github url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/basic/config.json" >}}
   EOF
   ```

2. Run the Agent Gateway. 
   ```sh
   agentgateway -f config.json
   ```
   
## Verify access to tools

1. Open the [Agent Gateway UI](http://localhost:19000/ui/). 

2. Connect to the MCP server with the Agent Gateway UI playground. 
   1. Go to the Agent Gateway UI [**Playground**](http://localhost:19000/ui/playground/).
   2. In the **Connection Settings** card, select your listener and click **Connect**. The Agent Gateway UI connects to the target that you configured and retrieves the tools that are exposed on the target. 
   3. Verify that you see a list of **Available Tools**. 
   
      {{< reuse-image src="img/agentgateway-ui-tools.png" >}}

6. Verify access to a tool. 
   1. From the **Available Tools** list, select the `everything_echo` tool. 
   2. In the **message** field, enter any string, such as `hello world`, and click **Run Tool**. 
   3. Verify that you see your message echoed in the **Response** card. 
   
      {{< reuse-image src="img/agentgateway-ui-tool-echo-hello.png" >}}