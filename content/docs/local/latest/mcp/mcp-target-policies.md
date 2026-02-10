---
title: MCP target policies
weight: 50
description: Apply policies to individual MCP backend targets
---

Apply policies at the MCP target level to control behavior for individual MCP servers within a multiplexed backend.

## Overview

MCP target policies allow you to configure policies for specific MCP backend targets, rather than applying them globally to all targets in a backend. This is useful when you have multiple MCP servers with different security, authorization, or routing requirements.

Policies are merged from the backend group level down to the target level, with more specific policies taking precedence.

### Best practices

- **Use backend-level policies for common settings**: Apply shared policies at the backend level to reduce duplication.
- **Use target-level policies for exceptions**: Override specific targets that need different behavior.
- **Be explicit about authorization**: Always configure authorization policies, even if permissive.
- **Test policy inheritance**: Verify that policies merge correctly by checking logs and testing access.

### Supported policy types

The following policies can be configured at the MCP target level.

| Policy | Description |
|--------|-------------|
| `mcpAuthorization` | Fine-grained authorization rules for tools, prompts, and resources |
| `backendAuth` | Backend authentication (API key, passthrough, AWS, GCP, Azure) |
| `backendTLS` | TLS configuration for backend connections |
| `requestHeaderModifier` | Modify request headers |
| `responseHeaderModifier` | Modify response headers |
| `ai` | LLM processing policies (prompt guards, overrides, defaults, model aliases) |
| `a2a` | Mark traffic as agent-to-agent |

### Policy inheritance

Policies are merged hierarchically:

1. **Backend group level**: Policies defined at `backends[].policies`
2. **Target level**: Policies defined at `backends[].mcp.targets[].policies`

Target-level policies override backend-level policies for the same policy type.

## Before you begin

[Set up MCP multiplexed backends]({{< link-hextra path="/mcp/connect/multiplex/" >}}).

## Configuration examples

Target-level policies are configured as part of an MCP backend. 

The configuration path is: `binds[].listeners[].routes[].backends[].mcp.targets[].policies`, such as in the following examples.

### Authorization per target

Apply different authorization rules to different MCP servers.

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - mcp:
          targets:
          - name: public-tools
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
            policies:
              mcpAuthorization:
                rules:
                # Allow anyone to access tools from this server
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

### Authentication per target

Use different authentication methods for different targets.

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - mcp:
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

### LLM policies per target

Apply different prompt guards to different MCP servers.

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - mcp:
          targets:
          - name: production-llm
            mcp:
              host: https://prod-llm.example.com
            policies:
              ai:
                promptGuard:
                  - regex:
                      deny:
                        - pattern: ".*password.*"
                        - pattern: ".*secret.*"
          
          - name: sandbox-llm
            mcp:
              host: https://sandbox-llm.example.com
            # No prompt guard for sandbox environment
```

### Inheritance

In this example:
- `public-server` allows anonymous access (target policy overrides backend policy).
- `restricted-server` requires authentication (uses backend policy).

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        # Route-level policy applies to all backends
        cors:
          allowOrigins: ["*"]
      backends:
      - mcp:
          # Backend-level policy applies to all targets
          policies:
            mcpAuthorization:
              rules:
                # Default: require authentication
                - 'has(jwt.sub)'
          
          targets:
          - name: public-server
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
            # Target-level policy overrides backend-level
            policies:
              mcpAuthorization:
                rules:
                  # Override: allow anonymous access for this target
                  - 'true'
          
          - name: restricted-server
            stdio:
              cmd: npx
              args: ["@mycompany/restricted-server"]
            # This target uses the backend-level policy (requires auth)
```

## Learn more

- [MCP Authorization]({{< link-hextra path="/mcp/mcp-authz" >}})
- [Backend Authentication]({{< link-hextra path="/configuration/security/backend-authn" >}})
- [Configuration Reference]({{< link-hextra path="/reference/configuration" >}})
