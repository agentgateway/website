---
title: Body buffering
weight: 17
description: Buffer request and response bodies before forwarding them.
---

Attaches to: {{< badge content="Route" path="/configuration/routes/" >}}

Use the `policies.buffer` policy to buffer request or response bodies in the proxy before the bodies are forwarded. By default, agentgateway streams bodies. When you configure `policies.buffer`, the proxy accumulates the configured body direction in memory until the body is complete, and then forwards it.

> [!NOTE]
> This policy is different from gateway-level buffering, which configures the `frontendPolicies.http.maxBufferSize` limit used by policies that need buffering.

## Buffer settings

You can configure request buffering, response buffering, or both.

| Field | Description | Default |
| -- | -- | -- |
| `policies.buffer.request.maxBytes` | Maximum number of request body bytes to buffer. | Uses the global proxy buffer setting, which defaults to 2 MiB. |
| `policies.buffer.request.failureMode` | Behavior when the request body exceeds `maxBytes`: `failClosed` to reject the request, or `failOpen` to continue. | `failClosed` |
| `policies.buffer.response.maxBytes` | Maximum number of response body bytes to buffer. | Uses the global proxy buffer setting, which defaults to 2 MiB. |
| `policies.buffer.response.failureMode` | Behavior when the response body exceeds `maxBytes`: `failClosed` to reject the response, or `failOpen` to continue. | `failClosed` |

The `maxBytes` value is a number of bytes, such as `65536` for 64 KiB. Large buffered bodies can increase proxy memory usage, so set strict limits for routes that receive untrusted or large payloads. When a body exceeds the applicable buffer limit, agentgateway rejects the body if possible. If response headers were already sent before the limit is exceeded, the proxy closes the connection.

## Buffer request and response bodies

Use the route's `policies` block to configure body buffering.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: localhost:8080
  policies:
    buffer:
      request:
        maxBytes: 65536
      response:
        maxBytes: 262144
```
