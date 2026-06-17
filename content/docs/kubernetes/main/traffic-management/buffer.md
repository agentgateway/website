---
title: Body buffering
weight: 11
description: Buffer request and response bodies before forwarding them.
test: skip
---

Use the `traffic.buffer` policy to buffer request or response bodies in the gateway proxy before the bodies are forwarded. By default, agentgateway streams bodies. When you configure `traffic.buffer`, the proxy accumulates the configured body direction in memory until the body is complete, and then forwards it.

{{< callout type="info" >}}
This policy is different from [Buffering]({{< link-hextra path="/traffic-management/buffering/" >}}), which configures the gateway-level `frontend.http.maxBufferSize` limit used by policies that need buffering.
{{< /callout >}}

## Buffer settings

You can configure request buffering, response buffering, or both.

| Field | Description | Default |
| -- | -- | -- |
| `traffic.buffer.request.maxBytes` | Maximum number of request body bytes to buffer. | Uses the global proxy buffer setting, which defaults to `2Mi`. |
| `traffic.buffer.response.maxBytes` | Maximum number of response body bytes to buffer. | Uses the global proxy buffer setting, which defaults to `2Mi`. |

The `maxBytes` value accepts byte-size strings such as `32Ki`, `2Mi`, or `10M`. Large buffered bodies can increase proxy memory usage, so set strict limits for routes that receive untrusted or large payloads. When a body exceeds the applicable buffer limit, agentgateway rejects the body if possible. If response headers were already sent before the limit is exceeded, the proxy closes the connection.

## Before you begin

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Buffer request and response bodies

Use a {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} to configure body buffering for a Gateway, HTTPRoute, or route rule.

1. Create a policy that buffers request bodies up to `64Ki` and response bodies up to `256Ki`.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: body-buffer
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
     traffic:
       buffer:
         request:
           maxBytes: 64Ki
         response:
           maxBytes: 256Ki
   EOF
   ```

2. Review the policy.

   ```sh
   kubectl get {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} body-buffer -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o yaml
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} body-buffer -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
