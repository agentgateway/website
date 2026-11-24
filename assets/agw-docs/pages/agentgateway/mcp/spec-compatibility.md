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

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x" >}}
## List pagination

When an MCP server returns tools, prompts, resources, or resource templates across multiple pages, the list response includes a `nextCursor` value. To get the next page, the client sends the cursor back in the next list request to the same endpoint.

With one upstream target, the client gets the upstream server's cursor unchanged. When an endpoint federates several targets, the client gets one combined cursor that tracks each target that still has pages left. The combined cursor is encrypted, so treat it as an opaque value and pass it back without parsing or changing it. On the next request, each saved cursor goes only to its original target, and targets that already returned their last page are skipped. If a combined cursor was changed, or names a target that the endpoint does not federate, the list request fails with a JSON-RPC error that includes the message `invalid list cursor`.
{{< /version >}}

## Response caching

The `2026-07-28` revision adds caching controls to responses such as `server/discover` and `tools/list`. Because agentgateway can apply policies (such as authorization, external authentication, or external processing) that make a response specific to an individual request, it cannot safely tell clients that a proxied response is cacheable. To guarantee correct behavior, agentgateway disables caching on the responses that it proxies.

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x" >}}
## Tool-call error results

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}
When a `tools/call` request is denied by an MCP guardrail (such as an ExtMCP server or a CEL expression processor) or by a local or global rate limit, the client gets an HTTP 200 JSON-RPC response with `result.isError: true`. The text content carries the denial reason or the rate-limit message, so that MCP clients can show the failure as a tool-execution error instead of treating the session as broken.

Clients that negotiate MCP protocol version `2026-07-28` or later also get `result.resultType: complete`. For older clients, `resultType` is left out for compatibility. Denials of other MCP methods, ExtMCP denials with the `UNKNOWN` code, CEL expressions that fail to evaluate, and internal ExtMCP failures such as an unreachable server still return JSON-RPC errors. A CEL evaluation error and an internal ExtMCP failure both return the code `-32603` with the message `guardrail check failed`.
{{< /version >}}
{{< version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}
When a `tools/call` request is denied by an ExtMCP guardrail or by a local or global rate limit, the client gets an HTTP 200 JSON-RPC response with `result.isError: true`. The text content carries the denial reason or the rate-limit message, so that MCP clients can show the failure as a tool-execution error instead of treating the session as broken.

Clients that negotiate MCP protocol version `2026-07-28` or later also get `result.resultType: complete`. For older clients, `resultType` is left out for compatibility. Denials of other MCP methods, ExtMCP denials with the `UNKNOWN` code, and internal ExtMCP failures such as an unreachable server still return JSON-RPC errors.
{{< /version >}}
{{< /version >}}

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x,2026.7.1,2.3.x" >}}
## MCP tasks {#tasks}

Agentgateway supports MCP tasks, the `io.modelcontextprotocol/tasks` extension of the `2026-07-28` MCP specification. With tasks, an MCP server can answer a long-running `tools/call` request with a task instead of a result. The client then polls the task for its status and result. Agentgateway forwards the client's tasks extension to the targets, and routes each task request to the target that created the task.

> [!NOTE]
> Client SDK support for MCP tasks is still limited. Check that your MCP client and your MCP servers both support the tasks extension before you build on it.

| Method | What agentgateway does |
| ------ | ---------------------- |
| `tasks/get` | Sends the request to the target that created the task. The client gets the task status, and the result when the task is complete. |
| `tasks/update` | Sends the request to the target that created the task. The client uses this method to answer requests that the server made during the task. |
| `tasks/cancel` | Sends the request to the target that created the task, which cancels the task. |

* **Task IDs when you federate multiple MCP servers.** Agentgateway adds the target name to each task ID, in the format `<target>+<task ID>`, in the same way that it adds the target name to tool names. The client sends the full ID back in each task request, and agentgateway removes the prefix before it sends the request to the target. A request with an unknown target in the task ID gets the error `-32602`. With one target, agentgateway does not change the task ID.
* **Authorization.** Your {{< conditional-text include-if="standalone" >}}{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x,2.2.x,2026.7.1,2.3.x" >}}[MCP authorization]({{< link-hextra path="/documentation/configuration/security/authorization/mcp-authz" >}}){{< /version >}}{{< version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x,2.2.x,2026.7.1,2.3.x" >}}[MCP authorization]({{< link-hextra path="/documentation/configuration/security/mcp-authz" >}}){{< /version >}}{{< /conditional-text >}}{{< conditional-text include-if="kubernetes" >}}[MCP authorization]({{< link-hextra path="/documentation/mcp/mcp-access/" >}}){{< /conditional-text >}} rules apply to each task request, not only to the `tools/call` request that created the task. In a rule, `mcp.methodName` is the task method, `mcp.task.target` is the target, and `mcp.task.name` is the task ID without the target prefix. For example, the rule `mcp.methodName == "tasks/get"` lets clients poll a task, but not cancel it. When the rules deny a task request, the client gets the error `-32602` with the message `unknown resource`. If your rules allow only specific tools, add a rule that allows the task methods. A rule that checks `mcp.tool` does not match a task request.
{{< /version >}}

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x,2.2.x,2026.7.1,2.3.x" >}}
## MCP skills {#skills}

Agentgateway supports MCP skills, the `io.modelcontextprotocol/skills` extension of the `2026-07-28` MCP specification. With skills, an MCP server publishes skills that a client can list and read.

| Method | What agentgateway does |
| ------ | ---------------------- |
| `skills/list` | Sends the request to the target. The client gets the skills that your authorization rules allow. |
| `skills/get` | Sends the request to the target, after your authorization rules check the skill URI. |
| `resources/directory/read` | Sends the request to the target, after your authorization rules check the directory URI. The client gets the directory entries that your authorization rules allow. |

* **Multiple targets.** When you federate multiple targets, agentgateway adds the target name to each skill URI, such as `skill://<target>/code-review/SKILL.md`, and merges `skills/list` results from all targets. A target that does not support skills adds no skills to the list.
* **Authorization.** Your {{< conditional-text include-if="standalone" >}}[MCP authorization]({{< link-hextra path="/documentation/configuration/security/authorization/mcp-authz" >}}){{< /conditional-text >}}{{< conditional-text include-if="kubernetes" >}}[MCP authorization]({{< link-hextra path="/documentation/mcp/mcp-access/" >}}){{< /conditional-text >}} rules apply to each skill and to each directory entry. In a rule, `mcp.resource.name` is the URI, such as `skill://code-review/SKILL.md`. For example, a deny rule with the expression `mcp.resource.name.startsWith("skill://secret/")` removes the `secret` skill from `skills/list` results, and a `skills/get` request for that skill gets the error `-32602`. Your rules also filter the file manifest of each listed skill.
* **Caching.** As with other proxied responses, agentgateway disables caching on skills responses.
{{< /version >}}

## What you can still configure

Version negotiation, sessionless protocol support, and [MCP Apps]({{< link-hextra path="/documentation/mcp/apps" >}}) all work automatically. 

The MCP behavior that you can tune includes:

- {{< conditional-text include-if="standalone" >}}[Session handling]({{< link-hextra path="/integrations/mcp/servers/http#stateless-sessions" >}}) (`statefulMode`) for how agentgateway proxies session-based servers.{{< /conditional-text >}}{{< conditional-text include-if="kubernetes" >}}[Session routing]({{< link-hextra path="/documentation/mcp/session" >}}) (`sessionRouting`) for how agentgateway proxies session-based servers.{{< /conditional-text >}}
- Tool name prefixing when federating multiple MCP servers: {{< conditional-text include-if="standalone" >}}[Virtual MCP]({{< link-hextra path="/integrations/mcp/servers/virtual" >}}).{{< /conditional-text >}}{{< conditional-text include-if="kubernetes" >}}[Virtual MCP]({{< link-hextra path="/documentation/mcp/virtual" >}}).{{< /conditional-text >}}
