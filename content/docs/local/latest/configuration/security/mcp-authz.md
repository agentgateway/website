---
title: MCP authorization
weight: 40
---

Attach to:
{{< badge content="Backend" link="/docs/configuration/backends/">}} (MCP Backends only)

The MCP {{< gloss "Authorization (AuthZ)" >}}authorization{{< /gloss >}} policy works similarly to [HTTP authorization](/docs/configuration/security/http-authz), but runs in the context of an MCP request.

> [!NOTE]
> {{< reuse "agw-docs/snippets/mcp-policy-note.md" >}}

Instead of running against an HTTP request, MCP authorization policies run against specific MCP method invocations such as `list_tools` and `call_tools`.

If a tool, or other resource, is not allowed it will automatically be filtered in the `list` request.

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

Refer to the [CEL reference](/docs/operations/cel) for allowed variables.
