---
title: MCP authorization
weight: 40
description: Define authorization rules for MCP method invocations using CEL expressions.
---

Attaches to: {{< badge content="Route" path="/documentation/configuration/routes/">}} {{< badge content="Backend" path="/documentation/configuration/backends/">}} (MCP Backends only)

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

The MCP {{< gloss "Authorization (AuthZ)" >}}authorization{{< /gloss >}} policy works similarly to [HTTP authorization]({{< link-hextra path="/documentation/configuration/security/http-authz" >}}), but runs in the context of an MCP request.

> [!NOTE]
> {{< reuse "agw-docs/snippets/mcp-policy-note.md" >}}

Instead of running against an HTTP request, MCP authorization policies run against specific MCP method invocations such as `list_tools` and `call_tools`.

If a tool or other resource is not allowed, the gateway automatically filters it from the `list` response, so unauthorized clients never see it.

You can attach `mcpAuthorization` at the route level or directly to an MCP backend. A backend-level policy applies to every MCP target in that backend. To vary the rules per target instead, keep one route-level policy and match on the `mcp.tool.target` variable, as shown in [Different rules per target](#different-rules-per-target). For the other policies that you can scope to an individual target, see [MCP target policies]({{< link-hextra path="/documentation/mcp/mcp-target-policies" >}}).

You can configure MCP authorization rules in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
The following steps add the same `mcpAuthorization` policy as the **Simplified (MCP)** example in the **Config file** tab.

1. Create a configuration with an MCP target, but no authorization policy. You add the policy in the UI.
   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   mcp:
     port: 3000
     targets:
     - name: everything
       stdio:
         cmd: npx
         args: ["@modelcontextprotocol/server-everything"]
   ```
2. Start agentgateway with this configuration.
3. Open [http://localhost:15000/ui/mcp/policies](http://localhost:15000/ui/mcp/policies) (**MCP** > **Policies**), and click the **MCP authorization** tile.
4. Add each of the following rules. For each rule, click **Add rule**, keep the **Allow** effect, and replace the example expression in the editor.
   1. `mcp.tool.name == "echo"` allows anyone to call the `echo` tool.
   2. `jwt.sub == "test-user" && mcp.tool.name == "add"` allows only `test-user` to call the `add` tool.
   3. `mcp.tool.name == "printEnv" && jwt.nested.key == "value"` allows users with the claim `nested.key == value` to call the `printEnv` tool.

   {{< reuse-image src="img/ui-mcp-policy-authorization.png" srcDark="img/ui-mcp-policy-authorization-dark.png" alt="MCP authorization drawer with three allow rules for the echo, add, and printEnv tools" >}}

5. Click **Save policy**.

The UI saves each rule as an object with an `allow` key, such as `- allow: mcp.tool.name == "echo"`, instead of the legacy string form in the **Config file** tab. Both forms behave the same.

You can also add an MCP authorization policy in the **Route policies** section of a route in **Traffic** > **Routes**. The **Routing-based** example uses an inline `mcp` backend, which the UI edits only as raw YAML. For that example, use the **Config file** tab.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
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
{{% /tab %}}
{{< /tabs >}}

> [!NOTE]
> Try out CEL expressions in the built-in [CEL playground]({{< link-hextra path="/reference/cel/playground/" >}}) in the agentgateway UI before using them in your configuration.

## Role-based access with JWT claims

When you combine MCP authorization with [MCP authentication]({{< link-hextra path="/documentation/configuration/security/mcp-authn" >}}), you can write rules that reference JWT claims. The following configuration restricts tools based on the authenticated user's identity and role:

- The MCP authentication policy validates JWTs against a local authorization server, such as Keycloak, running on port 9000.
- Any authenticated user can call the `echo` tool.
- Only the user `test-user` can call the `add` tool.
- Only users with the nested claim `nested.key == "value"` can call the `printEnv` tool.

{{< tabs >}}
{{% tab name="UI" %}}
1. Start agentgateway with a configuration that has an MCP target, but no policies. You add the policies in the UI.
   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   mcp:
     port: 3000
     targets:
     - name: everything
       stdio:
         cmd: npx
         args: ["@modelcontextprotocol/server-everything"]
   ```
2. Open [http://localhost:15000/ui/mcp/policies](http://localhost:15000/ui/mcp/policies) (**MCP** > **Policies**), and click the **MCP authentication** tile.
   1. In the **Signing keys** section, select **Remote URL**, and enter `http://localhost:9000/.well-known/jwks.json` for the **JWKS URL**.
   2. Enter `http://localhost:9000` for the **Issuer**.
   3. In **Audiences**, enter `http://localhost:3000/mcp`, and click **Add**.
   4. In **Resource metadata YAML**, enter the following YAML.
      ```yaml
      resource: http://localhost:3000/mcp
      scopesSupported:
      - read:all
      bearerMethodsSupported:
      - header
      ```
   5. Click **Save policy**. The authorization server must be running, because agentgateway fetches the JWKS when it loads the policy.
3. Click the **MCP authorization** tile, and add each of the following rules. For each rule, click **Add rule**, keep the **Allow** effect, and replace the example expression in the editor.
   1. `mcp.tool.name == "echo"`
   2. `jwt.sub == "test-user" && mcp.tool.name == "add"`
   3. `mcp.tool.name == "printEnv" && jwt.nested.key == "value"`
4. Click **Save policy**.

For more information about the authentication form, see [MCP authentication]({{< link-hextra path="/documentation/configuration/security/mcp-authn" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
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
{{% /tab %}}
{{< /tabs >}}

## Different rules per target

When you multiplex several MCP servers behind a single agentgateway listener, you can apply different authorization rules to each target by matching on the `mcp.tool.target` variable in a single policy. In the following configuration:

- Any user can access tools on the `public-tools` target.
- Only users with `admin` in the JWT `roles` claim can access tools on the `admin-tools` target.
- The JWT is validated against a local authorization server running on port 9000.

> [!NOTE]
> Per-target rules filter tools after each target responds. Agentgateway still initializes `admin-tools` and lists its tools for clients without the admin role. Add a [target condition]({{< link-hextra path="/integrations/mcp/servers/virtual/#target-conditions" >}}) to exclude the target for those clients. See [About MCP guardrails]({{< link-hextra path="/documentation/mcp/guardrails/about" >}}) to compare the options.

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

## CEL variables

The following MCP-specific CEL variables are available in authorization rules:

| Variable | Type | Availability | Description |
|----------|------|-------------|-------------|
| `mcp.tool.name` | `string` | Request-time | The name of the tool being called. |
| `mcp.tool.target` | `string` | Request-time | The target backend handling the tool call. |
| `mcp.tool.arguments` | `map` | Post-request | The JSON arguments passed to the tool call (not set in `mcpAuthorization` rules). |
| `mcp.tool.result` | `any` | Post-request | The tool call result payload (access logs only). |
| `mcp.tool.error` | `any` | Post-request | The tool call error payload (access logs only). |
| `mcp.prompt.name` | `string` | Request-time | The name of the prompt being accessed. |
| `mcp.resource.name` | `string` | Request-time | The name of the resource being accessed. |
| `mcp.methodName` | `string` | Request-time | The MCP JSON-RPC method name, such as `tools/call` or `tools/list`. |
| `mcp.sessionId` | `string` | Post-request | The MCP session ID. |

Request-time variables are available during authorization and can be used in `mcpAuthorization` rules. Post-request variables are available in access log CEL expressions. Route-level HTTP policies, such as `authorization` and `localRateLimit`, can also read `mcp.sessionId` and `mcp.tool.arguments` when the request arrives. For more information, see the [CEL variables reference]({{< link-hextra path="/reference/cel/variables" >}}).

When you also configure [MCP authentication]({{< link-hextra path="/documentation/configuration/security/mcp-authn" >}}), claims from the validated JWT are available to your rules as well:

| Variable | Type | Availability | Description |
|----------|------|-------------|-------------|
| `jwt.sub` | `string` | Request-time | The `sub` (subject) claim from the JWT. |
| `jwt.<claim>` | `any` | Request-time | Any top-level or nested JWT claim, such as `jwt.roles` or `jwt.nested.key`. |
| `has(jwt.<claim>)` | `bool` | Request-time | Whether a JWT claim is present. |

### Tool arguments are not available during authorization

`mcp.tool.arguments` isn't set when `mcpAuthorization` rules run, so the rules can't reference it. Base authorization decisions on `mcp.tool.name` and `mcp.tool.target` instead. To allow or deny a call based on its arguments, use a route-level `authorization` policy, which can read `mcp.tool.arguments`.

To inspect tool arguments, use an access log policy, which evaluates post-request:

```yaml
frontendPolicies:
  accessLog:
    add:
      tool_args: 'mcp.tool.arguments'
```

See [MCP observability]({{< link-hextra path="/documentation/mcp/mcp-observability" >}}) for the full example, and the [CEL reference]({{< link-hextra path="/reference/cel/" >}}) for additional variables.
