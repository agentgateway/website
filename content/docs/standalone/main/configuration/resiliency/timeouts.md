---
title: Timeouts
weight: 10
description: Set request and backend timeouts to prevent long-running requests.
test:
  timeouts:
  - file: content/docs/standalone/main/configuration/resiliency/timeouts.md
    path: timeouts
---

Attaches to: {{< badge content="Route" path="/configuration/routes/">}} {{< badge content="Backend" path="/configuration/backends/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="timeouts" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

Request {{< gloss "Timeout" >}}timeouts{{< /gloss >}} allow returning an error for requests that take too long to complete.

## Route Timeouts

You can configure two types of timeouts on a route.

|Timeout|Description|
|-|-|
|`requestTimeout`|The time from the start of an incoming request, until the end of the response headers is received. Note if there are retries, this includes the total time across retries.|
|`backendRequestTimeout`|The time from the start of a request to a backend, until the end of the response headers are completed. Note this is per-request, so with retries this is a per-retry timeout.|

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
{{< tab name="Routing-based" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
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
#   * The route-level timeout policy is accepted by agentgateway in both the
#     routing-based (binds) and simplified MCP (mcp.policies) forms.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That requests actually time out at runtime — requires a slow backend the
#     page omits to exceed the configured deadline.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        timeout:
          requestTimeout: 1s
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
{{< /doc-test >}}

## Backend Timeouts

In addition to route level timeouts, you can configure per-backend timeouts within the backend configuration section.

| Timeout          | Description                                                                                       |
|------------------|---------------------------------------------------------------------------------------------------|
| `requestTimeout` | The time from the start of an HTTP request to a backend until the response headers are completed. |
| `connectTimeout` | The time from the start of a TCP connection to a backend until the connection is established.     |

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - host: localhost:8080
        policies:
          http:
            requestTimeout: 1s
          tcp:
            connectTimeout:
              secs: 10
              nanos: 0
            # Required when setting tcp connection options; {} keeps keepalive defaults
            keepalives: {}
```

{{< doc-test paths="timeouts" >}}
# WHAT THIS TEST VALIDATES:
#   * The backend-level http/tcp timeout example config is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That backend request and connect timeouts actually fire at runtime —
#     requires a slow/unreachable backend the page omits to trigger them.
cat <<'EOF' > config2.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - host: localhost:8080
        policies:
          http:
            requestTimeout: 1s
          tcp:
            connectTimeout:
              secs: 10
              nanos: 0
            # Required when setting tcp connection options; {} keeps keepalive defaults
            keepalives: {}
EOF
agentgateway -f config2.yaml --validate-only
{{< /doc-test >}}
