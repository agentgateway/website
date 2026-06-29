---
title: MCP authorization
weight: 40
description: Define authorization rules for MCP method invocations using CEL expressions.
test:
  mcp-authz-config:
  - file: content/docs/standalone/main/configuration/security/mcp-authz.md
    path: mcp-authz-config
---

Attaches to: {{< badge content="Backend" path="/configuration/backends/">}} (MCP Backends only)

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="mcp-authz-config" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

The MCP {{< gloss "Authorization (AuthZ)" >}}authorization{{< /gloss >}} policy works similarly to [HTTP authorization]({{< link-hextra path="/configuration/security/http-authz" >}}), but runs in the context of an MCP request.

> [!NOTE]
> {{< reuse "agw-docs/snippets/mcp-policy-note.md" >}}

Instead of running against an HTTP request, MCP authorization policies run against specific MCP method invocations such as `list_tools` and `call_tools`.

If a tool or other resource is not allowed, the gateway automatically filters it from the `list` response.

{{< tabs >}}
{{< tab name="Simplified (MCP)" >}}
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
        # Allow anyone to call 'echo'
        - 'mcp.tool.name == "echo"'
        # Only the test-user can call 'add'
        - 'jwt.sub == "test-user" && mcp.tool.name == "add"'
        # Any authenticated user with the claim `nested.key == value` can access 'printEnv'
        - 'mcp.tool.name == "printEnv" && jwt.nested.key == "value"'
```
{{< /tab >}}
{{< tab name="Routing-based" >}}
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
                # Allow anyone to call 'echo'
                - 'mcp.tool.name == "echo"'
                # Only the test-user can call 'add'
                - 'jwt.sub == "test-user" && mcp.tool.name == "add"'
                # Any authenticated user with the claim `nested.key == value` can access 'printEnv'
                - 'mcp.tool.name == "printEnv" && jwt.nested.key == "value"'
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
#   * The tool-arguments fragment later on the page is not a standalone config.
cat <<'EOF' > config.yaml
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
                # Allow anyone to call 'echo'
                - 'mcp.tool.name == "echo"'
                # Only the test-user can call 'add'
                - 'jwt.sub == "test-user" && mcp.tool.name == "add"'
                # Any authenticated user with the claim `nested.key == value` can access 'printEnv'
                - 'mcp.tool.name == "printEnv" && jwt.nested.key == "value"'
EOF

cat <<'EOF' > config-mcp.yaml
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
        # Allow anyone to call 'echo'
        - 'mcp.tool.name == "echo"'
        # Only the test-user can call 'add'
        - 'jwt.sub == "test-user" && mcp.tool.name == "add"'
        # Any authenticated user with the claim `nested.key == value` can access 'printEnv'
        - 'mcp.tool.name == "printEnv" && jwt.nested.key == "value"'
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

{{< callout type="info" >}}
Try out CEL expressions in the built-in [CEL playground]({{< link-hextra path="/reference/cel/playground/" >}}) in the agentgateway admin UI before using them in your configuration.
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

Refer to the [CEL reference]({{< link-hextra path="/reference/cel/" >}}) for additional variables.
