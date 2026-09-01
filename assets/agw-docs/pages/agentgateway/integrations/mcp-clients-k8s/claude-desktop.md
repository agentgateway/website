## Before you begin

{{< reuse "agw-docs/snippets/prereq-mcp-clients-k8s.md" >}}

## Configuration

1. Add agentgateway to your Claude Desktop configuration file.

   {{< tabs >}}
   {{% tab name="macOS" %}}
   Edit `~/Library/Application Support/Claude/claude_desktop_config.json`.

   ```json
   {
     "mcpServers": {
       "agentgateway": {
         "url": "<MCP_URL>"
       }
     }
   }
   ```
   {{% /tab %}}
   {{% tab name="Windows" %}}
   Edit `%APPDATA%\Claude\claude_desktop_config.json`.

   ```json
   {
     "mcpServers": {
       "agentgateway": {
         "url": "<MCP_URL>"
       }
     }
   }
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Restart Claude Desktop and verify that the agentgateway tools appear in the MCP tools list.
