## Before you begin

{{< reuse "agw-docs/snippets/prereq-mcp-clients-k8s.md" >}}

## Configuration

1. Create or edit `.cursor/mcp.json` in your project root.

   ```json
   {
     "mcpServers": {
       "agentgateway": {
         "url": "<MCP_URL>"
       }
     }
   }
   ```

2. Restart Cursor and verify that the agentgateway tool appears in the MCP tools list.
