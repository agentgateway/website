## Capabilities and change notifications {#capabilities}

For sessions with multiple targets, agentgateway merges their capabilities into one `initialize` result. Tools, prompts, and resources are always enabled.

Each of the followign capabilities is advertised only if at least one session target offers it:

- `tools.listChanged`
- `prompts.listChanged`
- `resources.listChanged`
- `resources.subscribe`

With `sessionRouting: Stateless`, `initialize` omits all four capabilities, even for a single target. Stateless sessions have no notification stream.

Clients using `server/discover` get the same merged capabilities, regardless of `sessionRouting`. They receive notifications through `subscriptions/listen`.

Agentgateway skips targets that do not support `subscriptions/listen` without failing the stream.

The `mcp-server-everything` target advertises all four capabilities. The `mcp-website-fetcher` target advertises none.

1. Initialize a session with `x-include-fetcher: true` to include both targets. Review the returned capabilities.

   ```sh
   curl -s $MCP_URL \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "x-include-fetcher: true" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}' \
     | sed -n 's/^data: //p' | jq '.result.capabilities'
   ```

   Example output: The capabilities come from the `mcp-server-everything` target.

   ```json
   {
     "prompts": {
       "listChanged": true
     },
     "resources": {
       "subscribe": true,
       "listChanged": true
     },
     "tools": {
       "listChanged": true
     }
   }
   ```

2. Optional: Compare with two `mcp-website-fetcher` targets, which advertise no notification capabilities:

   ```json
   {
     "prompts": {},
     "resources": {},
     "tools": {}
   }
   ```
