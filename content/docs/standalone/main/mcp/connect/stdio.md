---
title: Stdio
weight: 10
description: Expose MCP servers through the agentgateway. 
---

An MCP backend allows exposing MCP servers through the agentgateway using {{< gloss "STDIO (Standard Input/Output)" >}}STDIO{{< /gloss >}}.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Configure the agentgateway

1. Download an MCP configuration for your agentgateway.

   ```yaml
   curl -L https://agentgateway.dev/examples/basic/config.yaml -o config.yaml
   ```

2. Review the configuration file. 

   ```
   cat config.yaml
   ```

   {{% github-yaml  url="https://agentgateway.dev/examples/basic/config.yaml" %}}

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   {{< reuse "agw-docs/snippets/example-basic-mcp.md" >}}

3. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```

## Verify access to tools

1. Open the [agentgateway UI](http://localhost:15000/ui/) to view your listener and backend configuration.

2. Connect to the MCP test server with the agentgateway UI playground.

   1. From the navigation menu under **MCP**, click **Tool Playground**.
   2. If you see a **Browser access is not allowed** notice, click **Apply CORS** so the playground can call the MCP listener from the UI.
   3. Click **Initialize** to open an MCP session. The agentgateway UI connects to the target that you configured and lists the tools that are exposed on the target.

      {{< reuse-image-light src="img/ui-playground-tools.png" >}}
      {{< reuse-image-dark srcDark="img/ui-playground-tools-dark.png" >}}

3. Verify access to a tool.
   1. From the **Tool** list, select the `echo` tool.
   2. In the **message** field, enter any string, such as `This is my first agentgateway setup.`, and click **Call tool**.
   3. Verify that the **Result** card shows an `HTTP 200` response with your message echoed back.

      {{< reuse-image-light src="img/ui-playground-tool-echo.png" >}}
      {{< reuse-image-dark srcDark="img/ui-playground-tool-echo-dark.png" >}}
