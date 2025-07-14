---
title: MCP
weight: 10
description: Expose tools that are hosted on an MCP server on the agentgateway. 
---

Expose tools that are hosted on an MCP server on the agentgateway. 

## About MCP

[Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) is an open protocol that standardizes how Large Language Model (LLM) applications connect to various external data sources and tools. Without MCP, you need to implement custom integrations for each tool that your LLM application needs to access. However, this approach is hard to maintain and can cause issues when you want to scale your environment. With MCP, you can significantly speed up, simplify, and standardize these types of integrations.

An MCP server exposes external data sources and tools so that LLM applications can access them. Typically, you want to deploy these servers remotely and have authorization mechanisms in place so that LLM applications can safely access the data.

With agentgateway, you can connect to one or multiple MCP servers in any environment. The agentgateway proxies requests to the MCP tool that is exposed on the server. You can also use the agentgateway to federate tools from multiple MCP servers. For more information, see the [MCP multiplexing](/docs/setup/examples/multiplex) guide. 

## Configure the agentgateway

1. Create an MCP configuration for your agentgateway.

   ```yaml
   cat <<EOF > config.yaml
   {{< github url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/basic/config.yaml" >}}
   EOF
   ```

   {{< reuse "docs/snippets/review-table.md" >}}

   {{< reuse "docs/snippets/example-basic-mcp.md" >}}


2. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```

<!-- TODO UI bug with Playground

## Verify access to tools

1. Open the [agentgateway UI](http://localhost:15000/ui/) to view your listener and target configuration.

2. Connect to the MCP server with the agentgateway UI playground. 
   1. Go to the agentgateway UI [**Playground**](http://localhost:15000/ui/playground/).
   2. In the **Connection Settings** card, select your **Listener Endpoint** and click **Connect**. The agentgateway UI connects to the target that you configured and retrieves the tools that are exposed on the target. 
   3. Verify that you see a list of **Available Tools**. 
   
      {{< reuse-image src="img/agentgateway-ui-tools.png" >}}

6. Verify access to a tool. 
   1. From the **Available Tools** list, select the `everything_echo` tool. 
   2. In the **message** field, enter any string, such as `hello world`, and click **Run Tool**. 
   3. Verify that you see your message echoed in the **Response** card. 
   
      {{< reuse-image src="img/agentgateway-ui-tool-echo-hello.png" >}}

-->