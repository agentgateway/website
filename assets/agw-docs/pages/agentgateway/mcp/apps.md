**MCP Apps** (the `io.modelcontextprotocol/ui` extension) let MCP tools return interactive user-interface (UI) resources that an MCP host can render, rather than plain text. A tool can return a UI resource identified by a `ui://` URI, and the host displays it to the user. Agentgateway supports MCP Apps automatically, including when you federate multiple MCP servers.

## How agentgateway handles MCP Apps

You do not need to configure anything to use MCP Apps through agentgateway. UI resources pass through the gateway like any other MCP resource, with two behaviors worth knowing about:

- **Multiplexing**: When you federate multiple MCP servers into one endpoint, agentgateway rewrites the `ui://` resource URIs so that they still route to the correct upstream target while remaining valid `ui://` URIs that hosts can render. For more information, see the {{< conditional-text include-if="standalone" >}}[Virtual MCP]({{< link-hextra path="/integrations/mcp/servers/virtual" >}}){{< /conditional-text >}}{{< conditional-text include-if="kubernetes" >}}[Virtual MCP]({{< link-hextra path="/documentation/mcp/virtual" >}}){{< /conditional-text >}} guide.
- **Authorization**: Any authorization rules that you configure also apply to UI resources. If a rule denies access to a UI resource, agentgateway does not advertise it to the client. For more information, see {{< conditional-text include-if="standalone" >}}[MCP authorization]({{< link-hextra path="/documentation/mcp/mcp-authz" >}}){{< /conditional-text >}}{{< conditional-text include-if="kubernetes" >}}[Tool access]({{< link-hextra path="/documentation/mcp/tool-access" >}}){{< /conditional-text >}}.

## MCP Apps and tool name prefixing

MCP Apps can call tools from within the rendered UI. By default, agentgateway prefixes tool names with the target name when you federate multiple MCP servers, which can interfere with app-originated tool calls that use the tool's plain name. To expose unprefixed tool names, adjust the tool name prefixing behavior on the MCP backend. For more information, see the {{< conditional-text include-if="standalone" >}}[Virtual MCP]({{< link-hextra path="/integrations/mcp/servers/virtual#tool-name-prefixing" >}}){{< /conditional-text >}}{{< conditional-text include-if="kubernetes" >}}[Virtual MCP]({{< link-hextra path="/documentation/mcp/virtual" >}}){{< /conditional-text >}} guide.
