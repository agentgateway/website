## Before you begin

{{< reuse "agw-docs/snippets/prereq-mcp-clients-k8s.md" >}}

## Configuration

1. Add the MCP server to your Claude configuration.
   
   {{< tabs >}}
   {{% tab name="CLI" %}}
   ```bash
   claude mcp add agentgateway --transport http <MCP_URL>
   ```
   {{% /tab %}}
   {{% tab name="mcp.json file" %}}
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

2. Verify the connection.

   ```bash
   claude mcp list
   ```

The `agentgateway` server shows up as **Connected**.
