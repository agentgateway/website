---
title: MCP target policies
weight: 50
description: Scope policies to a single MCP server inside a multiplexed (virtual) MCP backend.
test:
  mcp-target-policies:
  - file: ${versionRoot}/mcp/mcp-target-policies.md
    path: mcp-target-policies
---

Apply policies at the MCP target level to control behavior for individual MCP servers within a multiplexed backend.

{{< doc-test paths="mcp-target-policies" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Authentication per target": the example config is accepted by agentgateway
#     (--validate-only), covering `mcp.targets[].policies` with `backendAuth.key`
#     and `backendTLS.hostname` set per target. This example documented a
#     `backendTLS.sni` field until this test was added; the schema calls it
#     `hostname` ("Server name to use for TLS verification and SNI"), and `sni` was
#     rejected as an unknown field.
#   * "Supported policy types": each of the three listed policies
#     (`backendAuth`, `backendTLS`, `requestHeaderModifier`) is accepted at the MCP
#     target level. The table also listed `responseHeaderModifier` until this test
#     was added; agentgateway rejects it there as an unknown field, so it moved to
#     the unsupported note.
#   * "Policy inheritance": a config that sets a policy at both the backend group
#     level and the target level is accepted, so the documented two-level shape is
#     valid.
#   * All three unsupported policies from the note (`mcpAuthorization`, `ai`, `a2a`)
#     are rejected as unknown fields at the target level, same as
#     `responseHeaderModifier`.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That target-level policies actually override backend-level ones at request
#     time - requires config/traffic the page omits; both example targets point at
#     placeholder MCP servers (service-a.example.com) that the test cannot stand up,
#     and the page shows no request to inspect.
#   * The "Best practices" bullets - prose guidance, not runnable.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}

export SERVICE_A_API_KEY="${SERVICE_A_API_KEY:-test}"
export SERVICE_B_API_KEY="${SERVICE_B_API_KEY:-test}"
{{< /doc-test >}}


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

> **Note:** The following policies are **not supported** at the MCP target level. They must be configured at the backend level instead:
> - `mcpAuthorization`: Fine-grained authorization rules for tools, prompts, and resources.
> - `ai`: LLM processing policies such as prompt guards, overrides, defaults, and model aliases.
> - `a2a`: Mark traffic as agent-to-agent.
> - `responseHeaderModifier`: Modify response headers. Target-level policies apply to the connection that agentgateway opens to the target, so configure response header changes on the route or the backend instead.

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

{{< doc-test paths="mcp-target-policies" >}}
cat <<'EOF' > config.yaml
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
        hostname: service-a.example.com
  
  - name: service-b
    mcp:
      host: https://service-b.example.com/mcp
    policies:
      backendAuth:
        key: "$SERVICE_B_API_KEY"
      backendTLS:
        hostname: service-b.example.com
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

## Learn more

- [MCP Authorization]({{< link-hextra path="/mcp/mcp-authz" >}})
- [Backend Authentication]({{< link-hextra path="/configuration/security/backend-authn" >}})
- [Configuration Reference]({{< link-hextra path="/reference/configuration/schema/" >}})

{{< doc-test paths="mcp-target-policies" >}}
# "Supported policy types": the two header-modifier policies the table lists are also
# accepted at the target level, and "Policy inheritance": a policy set at the backend
# group level alongside a target-level override is a valid shape.
cat <<'EOF' > config-all-policies.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - mcp:
      targets:
      - name: service-a
        mcp:
          host: https://service-a.example.com/mcp
        policies:
          requestHeaderModifier:
            add:
              x-target: service-a
          backendAuth:
            key: "$SERVICE_A_API_KEY"
          backendTLS:
            hostname: service-a.example.com
    policies:
      backendAuth:
        key: "$SERVICE_B_API_KEY"
      responseHeaderModifier:
        add:
          x-from-backend: service-a
EOF
agentgateway -f config-all-policies.yaml --validate-only
echo "✓ All three documented target-level policies plus the backend/target inheritance shape are accepted"

# The unsupported note says responseHeaderModifier belongs on the route or backend,
# not the target. Confirm agentgateway actually rejects it at the target level, so the
# note cannot drift back to claiming it is supported.
cat <<'EOF' > config-bad-target-policy.yaml
mcp:
  port: 3000
  targets:
  - name: service-a
    mcp:
      host: https://service-a.example.com/mcp
    policies:
      responseHeaderModifier:
        add:
          x-from-target: service-a
EOF
if agentgateway -f config-bad-target-policy.yaml --validate-only >/dev/null 2>&1; then
  echo "FAIL: responseHeaderModifier was accepted at the MCP target level, so the unsupported note is now wrong"
  exit 1
fi
echo "✓ responseHeaderModifier is rejected at the MCP target level, as the note states"

# The note also lists mcpAuthorization, ai, and a2a as unsupported at the target
# level. Confirm all three are rejected the same way responseHeaderModifier is.
for policy in mcpAuthorization ai a2a; do
  cat <<EOF > "config-bad-$policy.yaml"
mcp:
  port: 3000
  targets:
  - name: service-a
    mcp:
      host: https://service-a.example.com/mcp
    policies:
      $policy: {}
EOF
  if agentgateway -f "config-bad-$policy.yaml" --validate-only >/dev/null 2>&1; then
    echo "FAIL: $policy was accepted at the MCP target level, so the unsupported note is now wrong"
    exit 1
  fi
  echo "✓ $policy is rejected at the MCP target level, as the note states"
done
{{< /doc-test >}}
