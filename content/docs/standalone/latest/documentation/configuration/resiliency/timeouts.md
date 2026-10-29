---
title: Timeouts
weight: 10
description: Set request and backend timeouts to prevent long-running requests.
---

Attaches to: {{< badge content="Route" path="/documentation/configuration/routes/">}} {{< badge content="Backend" path="/documentation/configuration/backends/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

Request {{< gloss "Timeout" >}}timeouts{{< /gloss >}} allow returning an error for requests that take too long to complete.

> [!NOTE]
> Timeouts bound how long a request might take. To stop an intermediary from closing a long-lived MCP stream that is merely idle, use `sseKeepAlive` on the MCP backend instead. For more information, see [Keep idle MCP streams alive]({{< link-hextra path="/documentation/mcp/configuration-modes#sse-keep-alive" >}}).

## Route Timeouts

You can configure these types of timeouts on a route.

|Timeout|Description|
|-|-|
|`requestTimeout`|The time budget for an incoming request, including the total time across retries, before agentgateway returns response headers to the client. It does not limit the duration of a response body streamed to the client.|
|`backendRequestTimeout`|The time budget for each request to a backend, including receiving response headers and any response body that agentgateway buffers. With retries, each attempt has its own budget. Receiving headers does not reset or end the deadline for buffered body reads. The deadline does not limit a response body that agentgateway streams without buffering.|
|`responseIdleTimeout`|The maximum time to wait for the next frame from the upstream response body. Time spent processing the response body, buffering response guardrails, transforming the response, or waiting for the client to receive data does not count. Use this setting to terminate a backend that stalls mid-stream, without capping how long a legitimately long upstream response might run. The timeout is disabled when the field is unset or set to zero, and it never applies to responses that switch protocols, so upgraded WebSocket and CONNECT tunnels are not terminated by it.|

The `backendRequestTimeout` deadline also applies when agentgateway buffers a body for processing, such as CEL body inspection, non-SSE MCP responses, A2A responses, or external authorization response processing. For example, if the timeout is `5s` and the response headers arrive after `1s`, buffered body reads have only the remaining `4s`.

For streaming responses, use `responseIdleTimeout` to limit how long agentgateway waits for the next upstream body frame. This idle timeout can end a stalled stream while allowing a stream that continues to send data to run longer than `backendRequestTimeout`.

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

## Backend Timeouts

In addition to route level timeouts, you can configure per-backend timeouts within the backend configuration section.

| Timeout          | Description                                                                                       |
|------------------|---------------------------------------------------------------------------------------------------|
| `requestTimeout` | The time budget for an HTTP request to this backend, including receiving response headers and any response body that agentgateway buffers. Buffered reads use the remaining budget; streamed response bodies are not limited by this deadline. |
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
