---
title: Network authorization
weight: 13
---

Attach to:
{{< badge content="Frontend" path="/configuration/overview/">}}

Network authorization enforces access control at the L4 (transport) level, before HTTP processing. You can enforce policies for non-HTTP traffic such as raw TCP and TLS connections, and layer L4+L7 controls when combined with [HTTP authorization]({{< link-hextra path="/configuration/security/http-authz/" >}}).

Network authorization uses [CEL expressions]({{< link-hextra path="/reference/cel/" >}}) evaluated against the connection's source context.

## Configuration

Configure network authorization as a frontend policy under `frontendPolicies.networkAuthorization`.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  networkAuthorization:
    rules:
    - allow: 'source.address == "10.0.0.0" || source.address == "10.0.0.1"'
    - deny: 'source.address == "192.168.1.100"'
    - require: 'source.port > 1024'

binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - host: localhost:8080
```

## Rules

Network authorization supports the same rule types as HTTP authorization:

| Rule type | Behavior |
|-----------|----------|
| `allow` | If any `allow` rule matches, the connection is permitted. |
| `deny` | If any `deny` rule matches, the connection is rejected. |
| `require` | All `require` rules must match for the connection to proceed. |

Evaluation order:
1. If there are no rules, the connection is allowed.
2. If any `deny` rule matches, the connection is rejected.
3. All `require` rules must match.
4. If any `allow` rule matches, the connection is allowed.
5. If only `deny` rules exist, unmatched connections are allowed (denylist semantics).
6. If `allow` rules exist but none matched, the connection is rejected (allowlist semantics).

## CEL context

The following CEL variables are available in network authorization rules:

| Variable | Type | Description |
|----------|------|-------------|
| `source.address` | `string` | IP address of the downstream connection. |
| `source.port` | `int` | Port of the downstream connection. |
| `source.tls.identity` | `string` | Client certificate identity (if mTLS). |
| `source.tls.subject_alt_names` | `list(string)` | Subject Alternative Names from the client certificate. |

## Examples

### Allow only private network ranges

```yaml
frontendPolicies:
  networkAuthorization:
    rules:
    - allow: 'source.address.startsWith("10.") || source.address.startsWith("172.16.") || source.address.startsWith("192.168.")'
```

### Require mTLS client identity

```yaml
frontendPolicies:
  networkAuthorization:
    rules:
    - require: 'source.tls.identity == "spiffe://cluster.local/ns/default/sa/my-service"'
```

### Layered L4+L7 controls

Combine network authorization with HTTP authorization for defense in depth.

```yaml
frontendPolicies:
  networkAuthorization:
    rules:
    - allow: 'source.address.startsWith("10.")'

binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - host: localhost:8080
      policies:
        authorization:
          rules:
          - require: 'jwt.aud == "my-service"'
```

In this example, only connections from the `10.0.0.0/8` range are accepted at the network level, and those connections must also present a valid JWT with the correct audience claim.
