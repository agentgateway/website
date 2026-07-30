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
- **Be explicit about authorization**: Always configure authorization policies at the backend level, even if permissive.
- **Test policy inheritance**: Verify that policies merge correctly by checking logs and testing access.

### Supported policy types

The following policies can be configured at the MCP target level.

| Policy | Description |
|--------|-------------|
| `backendAuth` | Backend authentication (API key, passthrough, AWS, GCP, Azure) |
| `backendTLS` | TLS configuration for backend connections |
| `requestHeaderModifier` | Modify request headers |
| `responseHeaderModifier` | Modify response headers |

> **Note:** The following policies are **not supported** at the MCP target level. They must be configured at the backend level instead:
> - `mcpAuthorization`: Fine-grained authorization rules for tools, prompts, and resources.
> - `ai`: LLM processing policies such as prompt guards, overrides, defaults, and model aliases.
> - `a2a`: Mark traffic as agent-to-agent.

### Policy inheritance

Policies are merged hierarchically:

1. **Backend group level**: Policies defined at `backends[].policies`
2. **Target level**: Policies defined at `backends[].mcp.targets[].policies`

Target-level policies override backend-level policies for the same policy type.

## Before you begin

[Set up MCP multiplexed backends]({{< link-hextra path="/mcp/connect/virtual" >}}).

## Configuration examples

Target-level policies are configured under `mcp.targets[].policies`.

### Authentication per target

Use different authentication methods for different targets.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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
        sni: service-a.example.com
  
  - name: service-b
    mcp:
      host: https://service-b.example.com/mcp
    policies:
      backendAuth:
        key: "$SERVICE_B_API_KEY"
      backendTLS:
        sni: service-b.example.com
```

## Learn more

- [MCP Authorization]({{< link-hextra path="/mcp/mcp-authz" >}})
- [Backend Authentication]({{< link-hextra path="/configuration/security/backend-authn" >}})
- [Configuration Reference]({{< link-hextra path="/reference/configuration/schema/" >}})
