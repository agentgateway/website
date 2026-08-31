---
title: Network authorization
weight: 13
description: Enforce access control at the L4 level using CEL expressions.
test:
  network-authz:
  - file: ${versionRoot}/documentation/configuration/security/network-authz.md
    path: network-authz
---

Attaches to: {{< badge content="Frontend" path="/documentation/configuration/overview/">}}

{{< doc-test paths="network-authz" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Configuration": the example config is accepted by agentgateway
#     (--validate-only), covering `frontendPolicies.networkAuthorization.rules`
#     with all three rule types (`allow`, `deny`, `require`) and the
#     `source.address` / `source.port` CEL variables.
#   * "Examples": all three example configs are accepted - the private-range
#     allowlist (`cidr(...).containsIP(...)`), the mTLS `source.tls.identity`
#     requirement, and the layered L4+L7 config that combines
#     `networkAuthorization` with a route-level `authorization` policy.
#   * Allowlist semantics from the "Evaluation order" list, rule 6: with the
#     Configuration example loaded, a connection from localhost matches no `allow`
#     rule, so the connection is rejected at L4 before any HTTP response is sent
#     (the client sees a connection reset, not a status code).
#   * Evaluation order rule 4 (allow match): a variant of the Configuration
#     example with an `allow` rule that matches the test client's own address
#     (`127.0.0.1`) lets the connection reach HTTP routing - observed as a `503`
#     from the placeholder backend rather than a connection failure, confirming
#     network authorization is the thing that let it through.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * Evaluation order rules for `deny` match and denylist semantics - requires
#     spoofing the test client's own source IP/port, which isn't controllable
#     from userspace without a second host or network namespace.
#   * Evaluation order rule for `require` match/no-match - the test client's
#     ephemeral source port is always > 1024, so a `require: source.port > 1024`
#     rule always trivially passes; forcing a low source port isn't controllable
#     from userspace either.
#   * Evaluation order rule 1 (no rules): trivial by definition (no
#     `networkAuthorization` config at all behaves like any other page's
#     unauthenticated route), so a dedicated example would add no signal beyond
#     what every other doc test on this site already demonstrates.
#   * `source.tls.identity` and `source.tls.subject_alt_names` at runtime -
#     requires config/traffic the page omits; the page shows no TLS listener or
#     client certificate setup, so the mTLS example is only validated as config.
#   * The route-level `authorization` JWT requirement in the layered example -
#     external dependency; enforcing it needs a JWT issuer this page does not set
#     up. HTTP authorization is covered by its own guide.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

Network authorization enforces access control at the L4 (transport) level, before HTTP processing. You can enforce policies for non-HTTP traffic such as raw TCP and TLS connections, and layer L4+L7 controls when you combine policies with [HTTP authorization]({{< link-hextra path="/documentation/configuration/security/http-authz/" >}}).

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

gateways:
  default:
    port: 3000
routes:
- backends:
  - host: localhost:8080
```

{{< doc-test paths="network-authz" >}}
cat <<'EOF' > config.yaml
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
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

{{< doc-test paths="network-authz" >}}
# Load the Configuration example and confirm allowlist semantics (evaluation
# order rule 6): the test client connects from localhost, which matches none of
# the `allow` rules, so the connection must be rejected at L4. A rejected L4
# connection produces a transport error rather than an HTTP status, so this is
# asserted with curl rather than YAMLTest.
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null || true' EXIT
sleep 3

if curl -s -o /dev/null --max-time 5 http://localhost:3000/; then
  echo "FAIL: connection from a non-allowlisted source address was not rejected"
  exit 1
fi
echo "✓ Network authorization rejected a connection from a non-allowlisted source address"

kill $AGW_PID 2>/dev/null || true
wait $AGW_PID 2>/dev/null || true
{{< /doc-test >}}

{{< doc-test paths="network-authz" >}}
# Evaluation order rule 4 (allow match): the same shape as the Configuration
# example, but with an allow rule that matches the test client's own address
# (127.0.0.1) instead of the page's example addresses. If network authorization
# is what's gating the connection, it should now reach HTTP routing -- observed
# as a 503 from the placeholder backend at localhost:8080, not a connection
# failure.
cat <<'EOF' > config-allow-match.yaml
frontendPolicies:
  networkAuthorization:
    rules:
    - allow: 'source.address == "127.0.0.1"'
    - deny: 'source.address == "192.168.1.100"'
    - require: 'source.port > 1024'

gateways:
  default:
    port: 3000
routes:
- backends:
  - host: localhost:8080
EOF
agentgateway -f config-allow-match.yaml --validate-only

agentgateway -f config-allow-match.yaml &
AGW_PID=$!
sleep 3

STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3000/)
kill $AGW_PID 2>/dev/null || true
wait $AGW_PID 2>/dev/null || true
if [ "$STATUS" != "503" ]; then
  echo "FAIL: expected a 503 from the placeholder backend once network authorization allowed the connection, got $STATUS"
  exit 1
fi
echo "✓ Network authorization allowed a connection matching an allow rule through to HTTP routing"
{{< /doc-test >}}

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
    - allow: 'cidr("10.0.0.0/8").containsIP(source.address) || cidr("172.16.0.0/12").containsIP(source.address) || cidr("192.168.0.0/16").containsIP(source.address)'
```

{{< doc-test paths="network-authz" >}}
cat <<'EOF' > config-private.yaml
frontendPolicies:
  networkAuthorization:
    rules:
    - allow: 'cidr("10.0.0.0/8").containsIP(source.address) || cidr("172.16.0.0/12").containsIP(source.address) || cidr("192.168.0.0/16").containsIP(source.address)'
EOF
agentgateway -f config-private.yaml --validate-only
{{< /doc-test >}}

### Require mTLS client identity

```yaml
frontendPolicies:
  networkAuthorization:
    rules:
    - require: 'source.tls.identity == "spiffe://cluster.local/ns/default/sa/my-service"'
```

{{< doc-test paths="network-authz" >}}
cat <<'EOF' > config-mtls.yaml
frontendPolicies:
  networkAuthorization:
    rules:
    - require: 'source.tls.identity == "spiffe://cluster.local/ns/default/sa/my-service"'
EOF
agentgateway -f config-mtls.yaml --validate-only
{{< /doc-test >}}

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

{{< doc-test paths="network-authz" >}}
cat <<'EOF' > config-layered.yaml
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
EOF
agentgateway -f config-layered.yaml --validate-only
{{< /doc-test >}}

In this example, only connections from the `10.0.0.0/8` range are accepted at the network level, and those connections must also present a valid JWT with the correct audience claim.
