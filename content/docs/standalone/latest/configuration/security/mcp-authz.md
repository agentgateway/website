---
title: MCP authorization
weight: 40
---

Attaches to: {{< badge content="Backend" path="/configuration/backends/">}} (MCP Backends only)

The MCP {{< gloss "Authorization (AuthZ)" >}}authorization{{< /gloss >}} policy works similarly to [HTTP authorization]({{< link-hextra path="/configuration/security/http-authz" >}}), but runs in the context of an MCP request.

> [!NOTE]
> {{< reuse "agw-docs/snippets/mcp-policy-note.md" >}}

Instead of running against an HTTP request, MCP authorization policies run against specific MCP method invocations such as `list_tools` and `call_tools`.

If a tool or other resource is not allowed, the gateway automatically filters it from the `list` response.

```yaml
mcpAuthorization:
  rules:
  # Allow anyone to call 'echo'
  - 'mcp.tool.name == "echo"'
  # Only the test-user can call 'add'
  - 'jwt.sub == "test-user" && mcp.tool.name == "add"'
  # Any authenticated user with the claim `nested.key == value` can access 'printEnv'
  - 'mcp.tool.name == "printEnv" && jwt.nested.key == "value"'
```

{{< callout type="info" >}}
Try out CEL expressions in the built-in [CEL playground]({{< link-hextra path="/reference/cel/" >}}#cel-playground) in the agentgateway admin UI before using them in your configuration.
{{< /callout >}}

## CEL variables

The following MCP-specific CEL variables are available in authorization rules:

| Variable | Type | Availability | Description |
|----------|------|-------------|-------------|
| `mcp.tool.name` | `string` | Request-time | The name of the tool being called. |
| `mcp.tool.target` | `string` | Request-time | The target backend handling the tool call. |
| `mcp.tool.arguments` | `map` | Request-time | The JSON arguments passed to the tool call. |
| `mcp.tool.result` | `any` | Post-request | The tool call result payload (access logs only). |
| `mcp.tool.error` | `any` | Post-request | The tool call error payload (access logs only). |
| `mcp.prompt.name` | `string` | Request-time | The name of the prompt being accessed. |
| `mcp.resource.name` | `string` | Request-time | The name of the resource being accessed. |
| `mcp.methodName` | `string` | Post-request | The MCP JSON-RPC method name, such as `tools/call`. |
| `mcp.sessionId` | `string` | Post-request | The MCP session ID. |

Request-time variables are available during authorization and can be used in `mcpAuthorization` rules. Post-request variables are available in access log CEL expressions.

### Authorize based on tool arguments

You can use tool arguments in authorization rules to enforce fine-grained access control. For example, restrict which URLs a fetch tool can access:

```yaml
mcpAuthorization:
  rules:
  - 'mcp.tool.name == "fetch" && mcp.tool.arguments.url.startsWith("https://internal.")'
```

Refer to the [CEL reference]({{< link-hextra path="/configuration/traffic-management/transformations" >}}) for additional variables.
