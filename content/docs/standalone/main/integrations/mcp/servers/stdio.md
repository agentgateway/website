---
title: Stdio
weight: 10
description: Run a local MCP server as a subprocess and expose it through agentgateway over stdio.
---

An MCP backend allows exposing MCP servers through the agentgateway using {{< gloss "STDIO (Standard Input/Output)" >}}STDIO{{< /gloss >}}.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Configure the agentgateway

You can add the MCP server in the UI or in a configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
1. Create a configuration with an empty `mcp` section, and start agentgateway. You add the MCP server in the UI.
   ```sh
   cat <<'EOF' > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   mcp:
     port: 3000
     targets: []
   EOF
   agentgateway -f config.yaml
   ```
2. Open [http://localhost:15000/ui/mcp/servers](http://localhost:15000/ui/mcp/servers) (**MCP** > **Servers**), and click **Add server**.
3. Enter `everything` for the **Server name**, and select the **Command Line** transport.
4. Enter `npx` for the **Command** and `@modelcontextprotocol/server-everything` for the **Arguments**.

   {{< reuse-image src="img/ui-mcp-servers-add-stdio.png" srcDark="img/ui-mcp-servers-add-stdio-dark.png" alt="Add MCP server drawer for the everything target with the npx command and the @modelcontextprotocol/server-everything argument" >}}

5. Click **Save server**.

The UI writes the same `everything` target as the example configuration, plus an empty `env` map and `clear_env: false`. The UI splits **Arguments** on spaces. For an argument that contains a space, use the **Raw** icon (`<>`) in the drawer header.

The example configuration also sets a CORS policy for the UI playground. In the UI, you add that policy with **Apply CORS** when you verify the setup in the next section.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
1. Download an MCP configuration for your agentgateway.

   ```yaml
   curl -L https://agentgateway.dev/examples/mcp-basic/config.yaml -o config.yaml
   ```

2. Review the configuration file. 

   ```
   cat config.yaml
   ```

   {{% github-yaml  url="https://agentgateway.dev/examples/mcp-basic/config.yaml" %}}

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   {{< reuse "agw-docs/snippets/example-basic-mcp.md" >}}

3. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```
{{% /tab %}}
{{< /tabs >}}

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
   2. In the **Message** field, enter any string, such as `This is my first agentgateway setup.`, and click **Call tool**.
   3. Verify that the **Result** card shows an `HTTP 200` response with your message echoed back.

      {{< reuse-image-light src="img/ui-playground-tool-echo.png" >}}
      {{< reuse-image-dark srcDark="img/ui-playground-tool-echo-dark.png" >}}
