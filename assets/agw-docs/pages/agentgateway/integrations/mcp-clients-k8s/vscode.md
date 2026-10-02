## Before you begin

{{< reuse "agw-docs/snippets/prereq-mcp-clients-k8s.md" >}}

## Configuration

1. Add to your VS Code `settings.json`.

   ```json
   {
     "mcp": {
       "servers": {
         "agentgateway": {
           "url": "<MCP_URL>"
         }
       }
     }
   }
   ```

2. Restart VS Code and verify that agentgateway tools appear in the MCP tools list.
