---
title: MCP
weight: 10
description: Expose MCP servers through the agentgateway. 
---

An MCP backend allows exposing MCP servers through the agentgateway.

{{< callout icon="kgateway" >}}
Want to use agentgateway for an MCP server in a Kubernetes cluster? Check out the [kgateway integration guide](https://kgateway.dev/docs/agentgateway/).
{{< /callout >}}

## About MCP

[Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) is an open protocol that standardizes how Large Language Model (LLM) applications connect to various external data sources and tools. Without MCP, you need to implement custom integrations for each tool that your LLM application needs to access. However, this approach is hard to maintain and can cause issues when you want to scale your environment. With MCP, you can significantly speed up, simplify, and standardize these types of integrations.

An MCP server exposes external data sources and tools so that LLM applications can access them. Typically, you want to deploy these servers remotely and have authorization mechanisms in place so that LLM applications can safely access the data.

With agentgateway, you can connect to one or multiple MCP servers in any environment. The agentgateway proxies requests to the MCP tool that is exposed on the server. You can also use the agentgateway to federate tools from multiple MCP servers. For more information, see the [MCP multiplexing](/docs/setup/examples/multiplex) guide. 

## Before you begin

{{< reuse "docs/snippets/prereq-agentgateway.md" >}}

## Configure the agentgateway

1. Download an MCP configuration for your agentgateway.

   ```yaml
   curl -L https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/basic/config.yaml -o config.yaml
   ```

2. Review the configuration file. 

   ```
   cat config.yaml
   ```

   {{% github-yaml  url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/basic/config.yaml" %}}

   {{< reuse "docs/snippets/review-table.md" >}}

   {{< reuse "docs/snippets/example-basic-mcp.md" >}}

3. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```

## Verify access to tools

1. Open the [agentgateway UI](http://localhost:15000/ui/) to view your listener and backend configuration.

2. Connect to the MCP test server with the agentgateway UI playground. 
   
   1. From the navigation menu, click [**Playground**](http://localhost:15000/ui/playground/).
      
      {{< reuse-image src="img/agentgateway-ui-playground.png" >}}

   2. In the **Testing** card, review your **Connection** details and click **Connect**. The agentgateway UI connects to the target that you configured and retrieves the tools that are exposed on the target. 
   
   3. Verify that you see a list of **Available Tools**. 
   
      {{< reuse-image src="img/ui-playground-tools.png" >}}

3. Verify access to a tool. 
   1. From the **Available Tools** list, select the `echo` tool. 
   2. In the **message** field, enter any string, such as `This is my first agentgateway setup.`, and click **Run Tool**. 
   3. Verify that you see your message echoed in the **Response** card. 
   
      {{< reuse-image src="img/ui-playground-tool-echo.png" >}}
