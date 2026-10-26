## Capabilities and change notifications {#capabilities}

For sessions with multiple targets, agentgateway merges their capabilities into one `initialize` result. Tools, prompts, and resources are always enabled.

Each of the following capabilities is advertised only if at least one session target offers it:

- `tools.listChanged`
- `prompts.listChanged`
- `resources.listChanged`
- `resources.subscribe`

When you set `sessionRouting: Stateless`, `initialize` omits these capabilities, even for a single target. Stateless sessions have no notification stream.

Clients using `server/discover` get the same merged capabilities, regardless of `sessionRouting`. They receive notifications through `subscriptions/listen`.

Agentgateway skips targets that do not support `subscriptions/listen` without failing the stream.

If no target offers a capability, the result omits it. For example, a backend whose targets offer none of these capabilities returns `"tools": {}`, `"prompts": {}`, and `"resources": {}`.

In this guide, the `mcp-server-everything` target advertises all of these capabilities, and the `mcp-website-fetcher` target advertises none.

Initialize a session with `x-include-fetcher: true` to include both targets. Review the returned capabilities.

```sh
curl -s $MCP_URL \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "x-include-fetcher: true" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}' \
  | sed -n 's/^data: //p' | jq '.result.capabilities'
```

The capabilities come from the `mcp-server-everything` target.

Example output:

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
