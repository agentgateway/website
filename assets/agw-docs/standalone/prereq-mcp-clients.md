1. [Install and run agentgateway]({{< link-hextra path="/quickstart/mcp" >}}).
2. Confirm agentgateway is up by opening the [agentgateway UI](http://localhost:15000/ui).
3. Use the same MCP endpoint and port that your local config exposes. Common examples include:
   - `http://localhost:15000/mcp/http` (recommended)
   - `http://localhost:15000/mcp/sse` (deprecated)
   - If you run agentgateway on a different host or port, replace `localhost:15000` in the examples accordingly.

   {{< callout type="info" >}}
   The SSE transport (`/mcp/sse`) is deprecated. Use the streamable HTTP transport (`/mcp/http`) for all new setups.
   {{< /callout >}}