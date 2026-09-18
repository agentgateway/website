---
title: Timeouts
weight: 10
description: Set request and backend timeouts to prevent long-running requests.
test:
  timeouts:
  - file: ${versionRoot}/documentation/configuration/resiliency/timeouts.md
    path: timeouts
---

Attaches to: {{< badge content="Route" path="/documentation/configuration/routes/">}} {{< badge content="Backend" path="/documentation/configuration/backends/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="timeouts" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

Request {{< gloss "Timeout" >}}timeouts{{< /gloss >}} allow returning an error for requests that take too long to complete.

## Route Timeouts

You can configure these types of timeouts on a route.

|Timeout|Description|
|-|-|
|`requestTimeout`|The time from the start of an incoming request, until the end of the response headers is received. Note if there are retries, this time includes the total time across retries. The response body is not included, so use `responseIdleTimeout` to bound gaps between body frames.|
|`backendRequestTimeout`|The time from the start of a request to a backend, until the end of the response headers are completed. Note this time is per-request, so with retries this time is a per-retry timeout. Like `requestTimeout`, this retry process stops applying once the response headers arrive.|
|`responseIdleTimeout`|The maximum time the response body may go without producing data. The window restarts on every body frame, so this bounds the gap between frames rather than the total time a response may take. Use it to terminate a backend that stalls mid-stream, without capping how long a legitimately long response may run. The timeout is disabled when the field is unset or set to zero, and it never applies to responses that switch protocols, so upgraded WebSocket and CONNECT tunnels are not terminated by it.|

Because `requestTimeout` and `backendRequestTimeout` both stop at the response headers, neither one places any bound on how long a response body may take, and neither can tell a stalled stream from a slow one. That gap is what `responseIdleTimeout` covers, which matters most for streaming responses that are expected to run for a long time.

{{< tabs >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    timeout:
      requestTimeout: 1s
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```
{{< /tab >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  policies:
    timeout:
      requestTimeout: 30s
      responseIdleTimeout: 5s
  models:
  - name: gpt-4o-mini
    provider: openai
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
    timeout:
      requestTimeout: 1s
  backends:
  - host: localhost:8080
```
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="timeouts" >}}
# WHAT THIS TEST VALIDATES:
#   * The route-level timeout policy is accepted by agentgateway in all three
#     forms the page shows: routing-based (gateways), simplified MCP
#     (mcp.policies) and simplified LLM (llm.policies).
#   * That `responseIdleTimeout` is a real field on both the routing-based and
#     the simplified LLM forms. It is the newest of the three timeouts, so a
#     rename upstream would otherwise reach the page as prose nobody can run.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That requests actually time out at runtime — requires a slow backend the
#     page omits to exceed the configured deadline.
#   * That the idle window genuinely restarts per body frame — needs a streaming
#     backend that stalls mid-response, which no fixture here provides.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- policies:
    timeout:
      requestTimeout: 1s
      responseIdleTimeout: 30s
  backends:
  - host: localhost:8080
EOF
agentgateway -f config.yaml --validate-only

cat <<'EOF' > config-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    timeout:
      requestTimeout: 1s
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config-mcp.yaml --validate-only

cat <<'EOF' > config-llm.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  policies:
    timeout:
      requestTimeout: 30s
      responseIdleTimeout: 5s
  models:
  - name: gpt-4o-mini
    provider: openai
EOF
agentgateway -f config-llm.yaml --validate-only
{{< /doc-test >}}

## Backend Timeouts

In addition to route level timeouts, you can configure per-backend timeouts within the backend configuration section.

| Timeout          | Description                                                                                       |
|------------------|---------------------------------------------------------------------------------------------------|
| `requestTimeout` | The time from the start of an HTTP request to a backend until the response headers are completed. |
| `connectTimeout` | The time from the start of a TCP connection to a backend until the connection is established.     |

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: localhost:8080
    policies:
      http:
        requestTimeout: 1s
      tcp:
        connectTimeout: 10s
```

{{< doc-test paths="timeouts" >}}
# WHAT THIS TEST VALIDATES:
#   * The backend-level http/tcp timeout example config is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That backend request and connect timeouts actually fire at runtime —
#     requires a slow/unreachable backend the page omits to trigger them.
cat <<'EOF' > config2.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: localhost:8080
    policies:
      http:
        requestTimeout: 1s
      tcp:
        connectTimeout: 10s
EOF
agentgateway -f config2.yaml --validate-only
{{< /doc-test >}}
