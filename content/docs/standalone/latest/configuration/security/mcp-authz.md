---
title: MCP authorization
weight: 40
description: Define authorization rules for MCP method invocations using CEL expressions.
test:
  mcp-authz-config:
  - file: ${versionRoot}/configuration/security/mcp-authz.md
    path: mcp-authz-config
---

Attaches to: {{< badge content="Route" path="/configuration/routes/">}} {{< badge content="Backend" path="/configuration/backends/">}} (MCP Backends only)

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="mcp-authz-config" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

The MCP {{< gloss "Authorization (AuthZ)" >}}authorization{{< /gloss >}} policy works similarly to [HTTP authorization]({{< link-hextra path="/configuration/security/http-authz" >}}), but runs in the context of an MCP request.

> [!NOTE]
> {{< reuse "agw-docs/snippets/mcp-policy-note.md" >}}

Instead of running against an HTTP request, MCP authorization policies run against specific MCP method invocations such as `list_tools` and `call_tools`.

If a tool or other resource is not allowed, the gateway automatically filters it from the `list` response, so unauthorized clients never see it.

You can attach `mcpAuthorization` at the route level or directly to an MCP backend. A backend-level policy applies to every MCP target in that backend. To vary the rules per target instead, keep one route-level policy and match on the `mcp.tool.target` variable, as shown in [Different rules per target](#different-rules-per-target). For the other policies that you can scope to an individual target, see [MCP target policies]({{< link-hextra path="/mcp/mcp-target-policies" >}}).

{{< tabs >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    mcpAuthorization:
      rules:
      # Allow anyone to call 'echo'
      - 'mcp.tool.name == "echo"'
      # Only the test-user can call 'add'
      - 'jwt.sub == "test-user" && mcp.tool.name == "add"'
      # Any authenticated user with the claim `nested.key == value` can access 'printEnv'
      - 'mcp.tool.name == "printEnv" && jwt.nested.key == "value"'
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```
{{< /tab >}}
{{< tab name="Routing-based" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- policies:
    mcpAuthorization:
      rules:
      # Allow anyone to call 'echo'
      - 'mcp.tool.name == "echo"'
      # Only the test-user can call 'add'
      - 'jwt.sub == "test-user" && mcp.tool.name == "add"'
      # Any authenticated user with the claim `nested.key == value` can access 'printEnv'
      - 'mcp.tool.name == "printEnv" && jwt.nested.key == "value"'
  backends:
  - mcp:
      targets:
      - name: everything
        stdio:
          cmd: npx
          args: ["@modelcontextprotocol/server-everything"]
```
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="mcp-authz-config" >}}
# WHAT THIS TEST VALIDATES:
#   * The MCP authorization example config loads and the gateway serves the
#     stdio MCP server: the /mcp endpoint accepts an initialize request.
#   * The same policy is accepted in the simplified MCP (mcp) form via
#     --validate-only.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That unauthorized tools are actually filtered — would require an
#     authenticated tools/list call with a JWT carrying the right claims.
#   * The access-log fragment later on the page is not a standalone config.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- policies:
    mcpAuthorization:
      rules:
      # Allow anyone to call 'echo'
      - 'mcp.tool.name == "echo"'
      # Only the test-user can call 'add'
      - 'jwt.sub == "test-user" && mcp.tool.name == "add"'
      # Any authenticated user with the claim `nested.key == value` can access 'printEnv'
      - 'mcp.tool.name == "printEnv" && jwt.nested.key == "value"'
  backends:
  - mcp:
      targets:
      - name: everything
        stdio:
          cmd: npx
          args: ["@modelcontextprotocol/server-everything"]
EOF

cat <<'EOF' > config-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    mcpAuthorization:
      rules:
      # Allow anyone to call 'echo'
      - 'mcp.tool.name == "echo"'
      # Only the test-user can call 'add'
      - 'jwt.sub == "test-user" && mcp.tool.name == "add"'
      # Any authenticated user with the claim `nested.key == value` can access 'printEnv'
      - 'mcp.tool.name == "printEnv" && jwt.nested.key == "value"'
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config-mcp.yaml --validate-only
{{< /doc-test >}}

{{< doc-test paths="mcp-authz-config" >}}
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3
{{< /doc-test >}}

{{< doc-test paths="mcp-authz-config" >}}
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

> [!NOTE]
> Try out CEL expressions in the built-in [CEL playground]({{< link-hextra path="/reference/cel/playground/" >}}) in the agentgateway UI before using them in your configuration.

## Role-based access with JWT claims

When you combine MCP authorization with [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}}), you can write rules that reference JWT claims. The following configuration restricts tools based on the authenticated user's identity and role:

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
      audiences:
      - http://localhost:3000/mcp
      jwks:
        url: http://localhost:9000/.well-known/jwks.json
      resourceMetadata:
        resource: http://localhost:3000/mcp
        scopesSupported:
        - read:all
        bearerMethodsSupported:
        - header
    mcpAuthorization:
      rules:
      # Any authenticated user can call 'echo'
      - 'mcp.tool.name == "echo"'
      # Only the test-user can call 'add'
      - 'jwt.sub == "test-user" && mcp.tool.name == "add"'
      # Claim-based access for 'printEnv'
      - 'mcp.tool.name == "printEnv" && jwt.nested.key == "value"'
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```

## Different rules per target

When you multiplex several MCP servers behind a single agentgateway listener, you can apply different authorization rules to each target by matching on the `mcp.tool.target` variable in a single policy. In the following configuration:

- Any user can access tools on the `public-tools` target.
- Only users with `admin` in the JWT `roles` claim can access tools on the `admin-tools` target.
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
      audiences:
      - http://localhost:3000/mcp
      jwks:
        url: http://localhost:9000/.well-known/jwks.json
      resourceMetadata:
        resource: http://localhost:3000/mcp
        scopesSupported:
        - read:all
        bearerMethodsSupported:
        - header
    mcpAuthorization:
      rules:
      # Allow anyone to access tools on the public-tools target
      - 'mcp.tool.target == "public-tools"'
      # Only authenticated admins can access tools on the admin-tools target
      - 'mcp.tool.target == "admin-tools" && has(jwt.sub) && "admin" in jwt.roles'
  targets:
  - name: public-tools
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
  - name: admin-tools
    stdio:
      cmd: npx
      args: ["@mycompany/admin-server"]
```

{{< doc-test paths="mcp-authz-config" >}}
# WHAT THIS TEST VALIDATES:
#   * The role-based (JWT claim) and per-target authorization examples are
#     accepted by agentgateway.
#   * The tests point jwks at a local file instead of the displayed IdP URL so
#     they run without a live identity provider.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That the rules actually admit or deny the described users — requires a real
#     authorization server and signed JWTs carrying these claims.
mkdir -p manifests/jwt
cat <<'EOF' > manifests/jwt/pub-key
{"keys": [{"kty": "RSA", "kid": "test", "use": "sig", "alg": "RS256", "n": "teXe4sfDoHQR5YUos3nsY_Ax6J2xrgXnIfUziaTWJ4nljejLVyg8m0g6SK9zrSaCvLm9GxAhpaJ_48RalwqDt4spBPQ8uvr-54jHrECboAbTxhy2T-oXP80Duz0xauSDVlyA_xenoCA24MFJ1rgHppy1F1eYTD-CQ-IxhXLNm5mE3rJufP_pdnMy0q6acXSfPtEzMJY3BYNV5umqimkOgH9PqQWd1RAgYdE7z5fvdCb4T4K667rRRT75PqRB4GJgSY-zQrC4CEVCw_ql7bfdouFcxXwsyh7AfImIEamA1LMODvMXVZWkZ8V0w_VEK6NHqr-BGOBVAUfRqYAEPxfaIw", "e": "AQAB"}]}
EOF
cat <<'EOF' > authz-rbac.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    mcpAuthentication:
      issuer: http://localhost:9000
      audiences:
      - http://localhost:3000/mcp
      jwks:
        file: ./manifests/jwt/pub-key
      resourceMetadata:
        resource: http://localhost:3000/mcp
        scopesSupported:
        - read:all
        bearerMethodsSupported:
        - header
    mcpAuthorization:
      rules:
      - 'mcp.tool.name == "echo"'
      - 'jwt.sub == "test-user" && mcp.tool.name == "add"'
      - 'mcp.tool.name == "printEnv" && jwt.nested.key == "value"'
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f authz-rbac.yaml --validate-only

cat <<'EOF' > authz-per-target.yaml
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
      audiences:
      - http://localhost:3000/mcp
      jwks:
        file: ./manifests/jwt/pub-key
      resourceMetadata:
        resource: http://localhost:3000/mcp
        scopesSupported:
        - read:all
        bearerMethodsSupported:
        - header
    mcpAuthorization:
      rules:
      - 'mcp.tool.target == "public-tools"'
      - 'mcp.tool.target == "admin-tools" && has(jwt.sub) && "admin" in jwt.roles'
  targets:
  - name: public-tools
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
  - name: admin-tools
    stdio:
      cmd: npx
      args: ["@mycompany/admin-server"]
EOF
agentgateway -f authz-per-target.yaml --validate-only
{{< /doc-test >}}

## CEL variables

The following MCP-specific CEL variables are available in authorization rules:

| Variable | Type | Availability | Description |
|----------|------|-------------|-------------|
| `mcp.tool.name` | `string` | Request-time | The name of the tool being called. |
| `mcp.tool.target` | `string` | Request-time | The target backend handling the tool call. |
| `mcp.tool.arguments` | `map` | Post-request | The JSON arguments passed to the tool call (access logs only). |
| `mcp.tool.result` | `any` | Post-request | The tool call result payload (access logs only). |
| `mcp.tool.error` | `any` | Post-request | The tool call error payload (access logs only). |
| `mcp.prompt.name` | `string` | Request-time | The name of the prompt being accessed. |
| `mcp.resource.name` | `string` | Request-time | The name of the resource being accessed. |
| `mcp.methodName` | `string` | Post-request | The MCP JSON-RPC method name, such as `tools/call`. |
| `mcp.sessionId` | `string` | Post-request | The MCP session ID. |

Request-time variables are available during authorization and can be used in `mcpAuthorization` rules. Post-request variables are available in access log CEL expressions.

When you also configure [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}}), claims from the validated JWT are available to your rules as well:

| Variable | Type | Availability | Description |
|----------|------|-------------|-------------|
| `jwt.sub` | `string` | Request-time | The `sub` (subject) claim from the JWT. |
| `jwt.<claim>` | `any` | Request-time | Any top-level or nested JWT claim, such as `jwt.roles` or `jwt.nested.key`. |
| `has(jwt.<claim>)` | `bool` | Request-time | Whether a JWT claim is present. |

### Tool arguments are not available during authorization

`mcp.tool.arguments` is populated only after a tool call completes, so it cannot be referenced in `mcpAuthorization` rules. Base authorization decisions on `mcp.tool.name` and `mcp.tool.target` instead.

To inspect tool arguments, use an access log policy, which evaluates post-request:

```yaml
frontendPolicies:
  accessLog:
    add:
      tool_args: 'mcp.tool.arguments'
```

See [MCP observability]({{< link-hextra path="/mcp/mcp-observability" >}}) for the full example, and the [CEL reference]({{< link-hextra path="/reference/cel/" >}}) for additional variables.
