Agentgateway supports MCP servers and clients across MCP specification versions and translates between them automatically. In most cases, you do not need to change your existing MCP servers or clients immediately to adopt the newer specification.

## Supported specification versions

Agentgateway supports MCP protocol versions{{< conditional-text include-if="kubernetes" >}} as described in [Version support]({{< link-hextra path="/release-notes/versions/" >}}){{< /conditional-text >}}. Earlier versions are automatically negotiated as described later and typically work, but are not guaranteed.

### 2026-07-28 support

The `2026-07-28` revision changes how MCP works at its core. MCP becomes stateless and sessionless. Instead of a stateful `initialize` handshake and an `Mcp-Session-Id` for the lifetime of a session, a modern client discovers server capabilities with a `server/discover` request and carries the required context in each request's `_meta`.

The sessionless protocol is the recommended direction for MCP going forward, and agentgateway supports it by default. Older, session-based clients and servers remain supported, so a mix of older and newer clients and servers can coexist behind the same gateway.

## Automatic version negotiation

Agentgateway sits between a downstream client and one or more upstream MCP servers, and negotiates the protocol version for you.

- **Newer client to newer server**: The `server/discover` request is forwarded and answered directly. This is the optimal path, with no fallback requests.
- **Newer client to older server**: The older server rejects the modern request, and the client falls back to the older `initialize` flow. Agentgateway handles the fallback transparently. Make sure that your client can handle the older flow gracefully.
- **Older client to newer server**: The client uses the older `initialize` flow, which agentgateway continues to support.

When you federate multiple MCP servers into one endpoint, agentgateway takes the **intersection** of the protocol versions that the targets support, so the client only negotiates a version that every target can serve. For more information, see the {{< conditional-text include-if="standalone" >}}[Virtual MCP]({{< link-hextra path="/integrations/mcp/servers/virtual" >}}){{< /conditional-text >}}{{< conditional-text include-if="kubernetes" >}}[Virtual MCP]({{< link-hextra path="/documentation/mcp/virtual" >}}){{< /conditional-text >}} guide.

> [!NOTE]
> Because most environments run a mix of MCP versions for the foreseeable future, this compatibility handling is on by default and requires no configuration. You do not need to upgrade all of your MCP servers to the newer specification at once.

## Response caching

The `2026-07-28` revision adds caching controls to responses such as `server/discover` and `tools/list`. Because agentgateway can apply policies (such as authorization, external authentication, or external processing) that make a response specific to an individual request, it cannot safely tell clients that a proxied response is cacheable. To guarantee correct behavior, agentgateway disables caching on the responses that it proxies.

## What you can still configure

Version negotiation, sessionless protocol support, and [MCP Apps]({{< link-hextra path="/documentation/mcp/apps" >}}) all work automatically. 

The MCP behavior that you can tune includes:

- {{< conditional-text include-if="standalone" >}}[Session handling]({{< link-hextra path="/integrations/mcp/servers/http#stateless-sessions" >}}) (`statefulMode`) for how agentgateway proxies session-based servers.{{< /conditional-text >}}{{< conditional-text include-if="kubernetes" >}}[Session routing]({{< link-hextra path="/documentation/mcp/session" >}}) (`sessionRouting`) for how agentgateway proxies session-based servers.{{< /conditional-text >}}
- Tool name prefixing when federating multiple MCP servers: {{< conditional-text include-if="standalone" >}}[Virtual MCP]({{< link-hextra path="/integrations/mcp/servers/virtual" >}}).{{< /conditional-text >}}{{< conditional-text include-if="kubernetes" >}}[Virtual MCP]({{< link-hextra path="/documentation/mcp/virtual" >}}).{{< /conditional-text >}}
