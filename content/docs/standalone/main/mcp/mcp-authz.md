---
title: MCP authorization
weight: 40
---

> [!NOTE]
> {{< reuse "agw-docs/snippets/mcp-policy-note.md" >}}

The MCP authorization policy works similarly to [HTTP authorization]({{< link-hextra path="/configuration/security/http-authz" >}}), but runs in the context of an MCP request. Authorization rules are written as [CEL expressions]({{< link-hextra path="/reference/cel" >}}) that evaluate against specific MCP method invocations, such as `list_tools` and `call_tools`, to control which tools, prompts, and resources clients can access.

If a tool or other resource is not allowed, agentgateway automatically filters the resource from `list` responses so that unauthorized clients never see it.

The `mcpAuthorization` policy can be attached at the backend level (applying to all MCP targets) or at the individual target level. For more on how policies inherit and override at different levels, see [MCP target policies]({{< link-hextra path="/mcp/mcp-target-policies" >}}).

## Allow specific tools

The following configuration exposes an MCP server and allows any client to call the `echo` tool. All other tools from the server are blocked.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - mcp:
          targets:
          - name: everything
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
            policies:
              mcpAuthorization:
                rules:
                - 'mcp.tool.name == "echo"'
```

## Role-based access with JWT claims

When you combine MCP authorization with [MCP authentication]({{< link-hextra path="/mcp/mcp-authn" >}}), you can write rules that reference JWT claims. The following configuration restricts tools based on the authenticated user's identity and role.

In this example:
- Any authenticated user can call the `echo` tool.
- Only the user `test-user` can call the `add` tool.
- Only users with the nested claim `nested.key == "value"` can call the `printEnv` tool.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - mcp:
          policies:
            mcpAuthentication:
              issuer: http://localhost:9000
              jwks:
                url: http://localhost:9000/.well-known/jwks.json
              resourceMetadata:
                resource: http://localhost:3000/mcp
                scopesSupported:
                - read:all
                bearerMethodsSupported:
                - header
          targets:
          - name: everything
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
            policies:
              mcpAuthorization:
                rules:
                # Any authenticated user can call 'echo'
                - 'mcp.tool.name == "echo"'
                # Only the test-user can call 'add'
                - 'jwt.sub == "test-user" && mcp.tool.name == "add"'
                # Claim-based access for 'printEnv'
                - 'mcp.tool.name == "printEnv" && jwt.nested.key == "value"'
```

## Different rules per target

When you multiplex several MCP servers behind a single agentgateway listener, you can apply different authorization rules to each target. 

In this example:
- Any user can access public tools.
- Only users with `admin` in the JWT roles can access admin tools.
- The JWT is validated against a local authorization server running on port 9000.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        cors:
          allowOrigins: ["*"]
          allowHeaders:
          - mcp-protocol-version
          - content-type
          - cache-control
      backends:
      - mcp:
          policies:
            mcpAuthentication:
              mode: optional
              issuer: http://localhost:9000
              jwks:
                url: http://localhost:9000/.well-known/jwks.json
              resourceMetadata:
                resource: http://localhost:3000/mcp
                scopesSupported:
                - read:all
                bearerMethodsSupported:
                - header
          targets:
          - name: public-tools
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
            policies:
              mcpAuthorization:
                rules:
                # Allow anyone to access all tools
                - 'true'

          - name: admin-tools
            stdio:
              cmd: npx
              args: ["@mycompany/admin-server"]
            policies:
              mcpAuthorization:
                rules:
                # Only authenticated admins can access these tools
                - 'has(jwt.sub) && "admin" in jwt.roles'
```

## CEL expression reference

Authorization rules use [Common Expression Language (CEL)]({{< link-hextra path="/reference/cel" >}}) expressions. Rules are evaluated as an `OR` expression: if any rule matches, the request is allowed.

Review the following table of common variables in MCP authorization rules. For the full list of supported variables and functions, refer to the [CEL reference]({{< link-hextra path="/reference/cel" >}}).

| Variable | Description |
|----------|-------------|
| `mcp.tool.name` | The name of the tool being called |
| `jwt.sub` | The `sub` (subject) claim from the JWT |
| `jwt.<claim>` | Any top-level or nested JWT claim (such as `jwt.roles`, `jwt.nested.key`) |
| `has(jwt.<claim>)` | Check whether a JWT claim exists |




