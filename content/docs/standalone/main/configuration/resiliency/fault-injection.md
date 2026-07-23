---
title: Fault injection
weight: 20
description: Inject artificial latency into requests to test how your clients and services handle slow responses.
test:
  fault-injection:
  - file: ${versionRoot}/configuration/resiliency/fault-injection.md
    path: fault-injection
---

Attaches to: {{< badge content="Route" path="/configuration/routes/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="fault-injection" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

Fault injection adds artificial latency to matching requests before agentgateway forwards them to the backend. Use it to test how your clients and upstream services behave when responses are slow, such as verifying that timeouts, retries, and client-side deadlines work as expected.

The injected delay counts against the request timeout. If the delay is longer than the configured [request timeout]({{< link-hextra path="/configuration/resiliency/timeouts/" >}}), the request times out.

## Inject a delay

Set `delay.duration` in the route policies. The `duration` can be either of the following values.

| Value | Description |
| -- | -- |
| A duration string | A fixed latency to inject, such as `2s` or `500ms`. |
| A CEL expression | An expression that is evaluated against each request and returns a duration or a number of milliseconds. Use this option for conditional, probabilistic, or randomized delays. A non-positive result injects no delay. |

The following example injects a fixed 2-second delay before agentgateway forwards requests to the backend.

{{< tabs >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    delay:
      duration: 2s
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
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        delay:
          duration: 2s
      backends:
      - host: localhost:8080
```
{{< /tab >}}
{{< /tabs >}}

## Inject a probabilistic or random delay

Because `duration` accepts a CEL expression, you can inject latency into only a subset of requests, or add jitter. The expression returns either a duration or a number that is interpreted as milliseconds.

| Expression | Effect |
| -- | -- |
| `duration("500ms")` | A fixed 500ms delay, expressed as a CEL duration. |
| `random() < 0.1 ? 500 : 0` | A 500ms delay on approximately 10% of requests, and no delay otherwise. |
| `int(random() * 500)` | A random delay between 0 and 500ms (jitter) on every request. |

The following example delays approximately 10% of requests by 500ms.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        delay:
          duration: "random() < 0.1 ? 500 : 0"
      backends:
      - host: localhost:8080
```

{{< doc-test paths="fault-injection" >}}
# WHAT THIS TEST VALIDATES:
#   * The delay (fault injection) policy is accepted by agentgateway in the
#     routing-based, simplified MCP, and CEL-expression forms.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That the latency is actually injected at runtime — verifying that would
#     require timing a live request against a running backend, which this page
#     omits.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        delay:
          duration: 2s
      backends:
      - host: localhost:8080
EOF
agentgateway -f config.yaml --validate-only

cat <<'EOF' > config-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    delay:
      duration: 2s
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config-mcp.yaml --validate-only

cat <<'EOF' > config-cel.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        delay:
          duration: "random() < 0.1 ? 500 : 0"
      backends:
      - host: localhost:8080
EOF
agentgateway -f config-cel.yaml --validate-only
{{< /doc-test >}}
