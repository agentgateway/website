---
title: MCP authorization
weight: 40
test:
  mcp-authz-tools:
  - file: content/docs/standalone/main/mcp/mcp-authz.md
    path: mcp-authz-tools
---

> [!NOTE]
> {{< reuse "agw-docs/snippets/mcp-policy-note.md" >}}

The MCP authorization policy works similarly to [HTTP authorization]({{< link-hextra path="/configuration/security/http-authz" >}}), but runs in the context of an MCP request. Authorization rules are written as [CEL expressions]({{< link-hextra path="/reference/cel" >}}) that evaluate against specific MCP method invocations, such as `list_tools` and `call_tools`, to control which tools, prompts, and resources clients can access.

If a tool or other resource is not allowed, agentgateway automatically filters the resource from `list` responses so that unauthorized clients never see it.

The `mcpAuthorization` policy can be attached at the backend level (applying to all MCP targets) or at the individual target level. For more on how policies inherit and override at different levels, see [MCP target policies]({{< link-hextra path="/mcp/mcp-target-policies" >}}).

{{< doc-test paths="mcp-authz-tools" >}}
# Install agentgateway binary
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/n-patch.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"
{{< /doc-test >}}

## Allow specific tools

The following configuration exposes an MCP server and allows any client to call the `echo` tool. All other tools from the server are blocked.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
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

{{< doc-test paths="mcp-authz-tools" >}}
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
    policies:
      mcpAuthorization:
        rules:
        - 'mcp.tool.name == "echo"'
EOF
{{< /doc-test >}}

{{< doc-test paths="mcp-authz-tools" >}}
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3
{{< /doc-test >}}

{{< doc-test paths="mcp-authz-tools" >}}
YAMLTest -f - <<'EOF'
- name: MCP endpoint accepts initialize request
  http:
    url: "http://localhost:3000"
    path: /mcp
    method: POST
    headers:
      content-type: application/json
      accept: "application/json, text/event-stream"
    body: |
      {"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}
  source:
    type: local
  expect:
    statusCode: 200
EOF
{{< /doc-test >}}

## Role-based access with JWT claims

When you combine MCP authorization with [MCP authentication]({{< link-hextra path="/mcp/mcp-authn" >}}), you can write rules that reference JWT claims. The following configuration restricts tools based on the authenticated user's identity and role.

In this example:
- The MCP authentication policy validates JWTs against a local authorization server, such as Keycloak, running on port 9000.
- Any authenticated user can call the `echo` tool.
- Only the user `test-user` can call the `add` tool.
- Only users with the nested claim `nested.key == "value"` can call the `printEnv` tool.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
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
mcp:
  port: 3000
  policies:
    cors:
      allowOrigins: ["*"]
      allowHeaders:
      - mcp-protocol-version
      - content-type
      - cache-control
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
| `mcp.tool.target` | The target backend handling the tool call |
| `mcp.prompt.name` | The name of the prompt being accessed |
| `mcp.resource.name` | The name of the resource being accessed |
| `jwt.sub` | The `sub` (subject) claim from the JWT |
| `jwt.<claim>` | Any top-level or nested JWT claim (such as `jwt.roles`, `jwt.nested.key`) |
| `has(jwt.<claim>)` | Check whether a JWT claim exists |




