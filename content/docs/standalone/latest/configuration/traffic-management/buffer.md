---
title: Body buffering
weight: 17
description: Buffer request and response bodies before forwarding them.
---

Attaches to: {{< badge content="Listener" path="/configuration/listeners/" >}} {{< badge content="Route" path="/configuration/routes/" >}} {{< badge content="Backend" path="/configuration/backends/" >}}

Use the `policies.buffer` policy to buffer request or response bodies in the proxy before the bodies are forwarded. By default, agentgateway streams bodies. When you configure `policies.buffer`, the proxy accumulates the configured body direction in memory until the body is complete, and then forwards it.

{{< callout type="info" >}}
This policy is different from gateway-level buffering, which configures the `frontend.http.maxBufferSize` limit used by policies that need buffering.
{{< /callout >}}

## Buffer settings

You can configure request buffering, response buffering, or both.

| Field | Description | Default |
| -- | -- | -- |
| `policies.buffer.request.maxBytes` | Maximum number of request body bytes to buffer. | Uses the global proxy buffer setting, which defaults to `2Mi`. |
| `policies.buffer.response.maxBytes` | Maximum number of response body bytes to buffer. | Uses the global proxy buffer setting, which defaults to `2Mi`. |

The `maxBytes` value accepts byte-size strings such as `32Ki`, `2Mi`, or `10M`. Large buffered bodies can increase proxy memory usage, so set strict limits for routes that receive untrusted or large payloads. When a body exceeds the applicable buffer limit, agentgateway rejects the body if possible. If response headers were already sent before the limit is exceeded, the proxy closes the connection.

## Buffer request and response bodies

Use a `policies` block to configure body buffering at the listener, route, or backend level. The same `buffer` section works anywhere `policies` is supported.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - host: localhost:8080
        policies:
          buffer:
            request:
              maxBytes: 64Ki
            response:
              maxBytes: 256Ki
```
