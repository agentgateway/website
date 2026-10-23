## Capabilities and change notifications {#capabilities}

When a client initializes a session with more than one target, agentgateway merges the capabilities of the targets into one `initialize` result. The result always enables tools, prompts, and resources. Change notifications come only from the upstream MCP servers, so agentgateway advertises a notification capability only when at least one target in the session offers it.

| Capability | Advertised when |
| ---------- | --------------- |
| `tools.listChanged` | At least one target advertises `tools.listChanged`. |
| `prompts.listChanged` | At least one target advertises `prompts.listChanged`. |
| `resources.listChanged` | At least one target advertises `resources.listChanged`. |
| `resources.subscribe` | At least one target advertises `resources.subscribe`. |

With `sessionRouting: Stateless`, the `initialize` result advertises none of these capabilities, even for a single target. A stateless session has no stream to deliver notifications on.

Clients that use the `server/discover` method instead of `initialize` get the same merged capabilities. These clients receive notifications on a `subscriptions/listen` stream, so the capabilities do not depend on `sessionRouting`. Agentgateway skips targets that do not support `subscriptions/listen` instead of failing the stream.

The targets in this guide offer different capabilities. The `mcp-server-everything` server advertises all four notification capabilities. The `mcp-website-fetcher` server advertises none.

1. Initialize a session with the `x-include-fetcher: true` header so that both targets take part. Then, review the capabilities in the result.

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

2. Optional: Compare the result for a backend whose targets offer no change notifications, such as two `mcp-website-fetcher` targets. The result enables tools, prompts, and resources without any notification capabilities.

   ```json
   {
     "prompts": {},
     "resources": {},
     "tools": {}
   }
   ```
