---
title: MCP target policies
weight: 50
description: Scope policies to a single MCP server inside a multiplexed (virtual) MCP backend.
---

Apply policies at the MCP target level to control behavior for individual MCP servers within a multiplexed backend.


## Overview

MCP target policies allow you to configure policies for specific MCP backend targets, rather than applying them globally to all targets in a backend. This is useful when you have multiple MCP servers with different authentication or routing requirements.

Policies are merged from the backend group level down to the target level, with more specific policies taking precedence.

### Best practices

- **Use backend-level policies for common settings**: Apply shared policies at the backend level to reduce duplication.
- **Use target-level policies for exceptions**: Override specific targets that need different behavior.
- **Be explicit about authorization**: Always configure `mcpAuthorization` on the route, in `mcp.policies`, or in the backend policies, even if permissive.
- **Test policy inheritance**: Verify that policies merge correctly by checking logs and testing access.

### Supported policy types

The following policies can be configured at the MCP target level.

| Policy | Description |
|--------|-------------|
| `backendAuth` | Backend authentication (API key, passthrough, AWS, GCP, Azure) |
| `backendTLS` | TLS configuration for backend connections |
| `requestHeaderModifier` | Modify request headers |
| `transformations` | Modify request and response data for this target |
| `http` | HTTP settings for the connection, such as `requestTimeout` |
| `tcp` | TCP settings for the connection, such as `connectTimeout` |
| `backendTunnel` | Send the connection through a forward proxy |

Target-level policies apply to the connection that agentgateway opens to the target. They are not supported on `stdio` targets, because a subprocess has no backend connection. A `stdio` target that sets `policies` fails validation.

The following policies are **not supported** at the MCP target level.
- `mcpAuthorization` and `mcpGuardrails`: These policies apply to the full set of targets. Configure them on the route, in `mcp.policies`, or in the policies of the backend.
- `ai`: LLM processing policies such as prompt guards, overrides, defaults, and model aliases. Configure them on the backend instead.
- `a2a`: Mark traffic as agent-to-agent. Configure it on the backend instead.
- `responseHeaderModifier`: Modify response headers. Configure response header changes on the route or the backend instead.

### Policy inheritance

Policies are merged hierarchically:

1. **Backend group level**: Policies defined at `backends[].policies`
2. **Target level**: Policies defined at `backends[].mcp.targets[].policies`

Target-level policies override backend-level policies for the same policy type.

## Before you begin

[Set up MCP multiplexed backends]({{< link-hextra path="/integrations/mcp/servers/virtual" >}}).

## Configuration examples

Target-level policies are configured under `mcp.targets[].policies`.

### Authentication per target

Use different authentication methods for different targets.

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
mcp:
  port: 3000
  targets:
  - name: service-a
    mcp:
      host: https://service-a.example.com/mcp
    policies:
      backendAuth:
        key: "$SERVICE_A_API_KEY"
      backendTLS:
        hostname: service-a.example.com
  
  - name: service-b
    mcp:
      host: https://service-b.example.com/mcp
    policies:
      backendAuth:
        key: "$SERVICE_B_API_KEY"
      backendTLS:
        hostname: service-b.example.com
```

### Connection settings per target

Tune the connection to one target. The following example sets a longer request timeout and a connect timeout for `service-a` only.

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
mcp:
  port: 3000
  targets:
  - name: service-a
    mcp:
      host: https://service-a.example.com/mcp
    policies:
      http:
        requestTimeout: 30s
      tcp:
        connectTimeout: 5s
```

| Field | Description |
|-------|-------------|
| `policies.http.requestTimeout` | The maximum time to wait for a response from this target. |
| `policies.tcp.connectTimeout` | The maximum time to wait to establish the TCP connection to this target. |

## Learn more

- [MCP Authorization]({{< link-hextra path="/documentation/mcp/mcp-authz" >}})
- [Backend Authentication]({{< link-hextra path="/documentation/configuration/security/backend-authn" >}})
- [Configuration Reference]({{< link-hextra path="/reference/configuration/schema/" >}})
