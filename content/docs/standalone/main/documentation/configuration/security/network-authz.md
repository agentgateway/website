---
title: Network authorization
weight: 13
description: Enforce access control at the L4 level using CEL expressions.
---

Attaches to: {{< badge content="Frontend" path="/documentation/configuration/overview/">}}

Network authorization enforces access control at the L4 (transport) level, before HTTP processing. You can enforce policies for non-HTTP traffic such as raw TCP and TLS connections, and layer L4+L7 controls when you combine policies with [HTTP authorization]({{< link-hextra path="/documentation/configuration/security/http-authz/" >}}).

Network authorization uses [CEL expressions]({{< link-hextra path="/reference/cel/" >}}) evaluated against the connection's source and destination context.

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

gateways:
  default:
    port: 3000
routes:
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

Some CEL variables are unset for some connections. A rule that references an unset variable never matches. A `require` rule then rejects the connection, and a `deny` rule lets the connection through. For when each variable is set, see [CEL context](#cel-context).

## CEL context

The following CEL variables are available in network authorization rules. For every variable that agentgateway exposes, see the [CEL reference]({{< link-hextra path="/reference/cel/" >}}).

| Variable | Type | Description |
|----------|------|-------------|
| `source.address` | `string` | IP address of the downstream connection. |
| `source.port` | `int` | Port of the downstream connection. |
| `source.spiffeId` | `string` | SPIFFE ID of the client certificate, which is the certificate's first `spiffe://` URI Subject Alternative Name (SAN). Set only when the gateway verifies client certificates. |
| `source.identity` | `object` | Istio-format identity of the client certificate, with the `trustDomain`, `namespace`, and `serviceAccount` fields. Set only when the SPIFFE ID has the `spiffe://<trust-domain>/ns/<namespace>/sa/<service-account>` format. Compare its fields, not the whole object, with a string. |
| `source.subjectAltNames` | `list(string)` | Subject Alternative Names from the client certificate. |
| `source.subject`, `source.subjectCn`, `source.issuer` | `string` | Subject, subject common name (CN), and issuer of the client certificate. |
| `destination.address` | `string` | IP address on agentgateway that the downstream connection was made to. This is the local address of the listener, not the address of the backend that the connection is routed to. |
| `destination.port` | `int` | Port on agentgateway that the downstream connection was made to. |
| `destination.hostname` | `string` | Server Name Indication (SNI) hostname that agentgateway read from the TLS handshake. Set only on listeners with the `TLS` protocol. Unset on HTTP and HTTPS listeners, even when the client sends SNI, and when the client sends no SNI. See the warning that follows. |

> [!WARNING]
> `destination.hostname` is set only on listeners with the `TLS` protocol. It is unset on HTTP and HTTPS listeners, even when the client sends SNI, and for clients that send no SNI. A `require` rule that references an unset variable never matches, so the rule denies every such connection. Verify it against the traffic you expect before you rely on it.

## Examples

### Allow only private network ranges

```yaml
frontendPolicies:
  networkAuthorization:
    rules:
    - allow: 'cidr("10.0.0.0/8").containsIP(source.address) || cidr("172.16.0.0/12").containsIP(source.address) || cidr("192.168.0.0/16").containsIP(source.address)'
```

### Require mTLS client identity

Admit only clients whose certificate carries a specific SPIFFE ID. The gateway must verify client certificates, so set `root` in its `tls` settings to the CA that issued them. Without `root`, the client certificate variables are unset, and this rule rejects every connection.

```yaml
frontendPolicies:
  networkAuthorization:
    rules:
    - require: 'source.spiffeId == "spiffe://cluster.local/ns/default/sa/my-service"'

gateways:
  default:
    port: 3443
    tls:
      cert: certs/cert.pem
      key: certs/key.pem
      root: certs/ca.pem
routes:
- backends:
  - host: localhost:8080
```

You can match the same client in other ways:

* `'"spiffe://cluster.local/ns/default/sa/my-service" in source.subjectAltNames'` checks every SAN in the client certificate.
* `'source.identity.namespace == "default" && source.identity.serviceAccount == "my-service"'` checks parts of an Istio-format SPIFFE ID.

Do not compare `source.identity` with a SPIFFE ID string. `source.identity` is an object, so the comparison never matches, and the rule rejects every client.

### Require TLS SNI

For TLS connections, use `destination.hostname` to require a specific SNI hostname before the connection proceeds. Because this is a `require` rule, a connection that carries no SNI does not match it and is rejected. Apply the policy only to listeners with the `TLS` protocol.

```yaml
frontendPolicies:
  networkAuthorization:
    rules:
    - require: 'destination.hostname == "db.internal.example.com"'
```

### Layered L4+L7 controls

Combine network authorization with HTTP authorization for defense in depth.

```yaml
frontendPolicies:
  networkAuthorization:
    rules:
    - allow: 'cidr("10.0.0.0/8").containsIP(source.address)'

gateways:
  default:
    port: 3000
routes:
- backends:
  - host: localhost:8080
  policies:
    authorization:
      rules:
      - require: 'jwt.aud == "my-service"'
```

In this example, only connections from the `10.0.0.0/8` range are accepted at the network level, and those connections must also present a valid JWT with the correct audience claim.
