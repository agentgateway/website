## Before you begin

{{< reuse "agw-docs/snippets/prereq-mcp-clients-k8s.md" >}}

## Configuration

1. Create or edit `~/.codeium/windsurf/mcp_config.json`. For remote MCP servers, Devin Desktop uses the `serverUrl` field.

   ```json
   {
     "mcpServers": {
       "agentgateway": {
         "serverUrl": "<MCP_URL>"
       }
     }
   }
   ```

2. Restart Devin Desktop and verify that agentgateway tools appear in the MCP tools list.
