Fine-tune connection speeds for read and write operations by setting a connection buffer limit.


## About buffer limits

By default, {{< reuse "/agw-docs/snippets/agentgateway.md" >}} allows up to 2 MiB of HTTP body to be buffered into memory for each gateway.

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" %}}
Requests that are routed to an LLM backend are the exception and use a larger default of 32 MiB, because a single large-context prompt can exceed the general-traffic limit on its own.

| Buffering happens | Default limit |
|-|-|
| Before the request is routed anywhere | 2 MiB |
| After the request is routed to an LLM backend | 32 MiB |

For example, a policy that runs in the `PreRouting` phase buffers before route selection, so it uses the 2 MiB limit even when the request is bound for an LLM backend.
{{% /version %}}

For large requests that must be buffered and that exceed the default buffer limit, {{< reuse "/agw-docs/snippets/agentgateway.md" >}} either disconnects the connection to the downstream service if headers were already sent, or returns a 413 HTTP response code. To make sure that large requests can be sent and received, you can use `maxBufferSize` to specify the maximum number of bytes that can be buffered between the gateway and the downstream service. The buffer limit is configured at the Gateway level via a {{< reuse "agw-docs/snippets/policy.md" >}}.{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}} The value that you set replaces both defaults, so LLM requests use that value instead of 32 MiB.{{< /version >}}

{{< version exclude-if="1.5.x" >}}For MCP traffic, if a JSON-RPC request body exceeds this limit, the client receives HTTP 413 and a response body that includes the configured byte limit. Malformed JSON that stays within the limit receives HTTP 400.{{< /version >}}

### Choose a buffer limit

The value you choose depends on how large a body your policies must be able to read and how much memory you are willing to spend on buffering.

- **Set it at least as large as the largest body that a policy must inspect.** A policy that needs a complete body cannot act on a body that exceeds the limit, so the request fails instead of being evaluated. Body-based authorization and an external processor that runs in a buffered mode are the common cases.
- **Account for concurrency, not a single request.** The limit applies to each buffered request, so the worst case is roughly the limit multiplied by the number of requests that buffer at the same time. A generous limit on a busy gateway is a larger commitment than it appears.
- **Set a small limit when the gateway faces untrusted downstreams.** When using {{< reuse "/agw-docs/snippets/agentgateway.md" >}} as an edge proxy, a small number such as 32768 bytes (32KiB) better guards against potential attacks or misconfigured downstreams that could excessively use the proxy's resources.
{{% version exclude-if="1.0.x,1.1.x,1.2.x,2.2.x" %}}- **Keep the Gateway limit conservative and raise it only where it is needed.** A [route-level buffer policy]({{< link-hextra path="/documentation/traffic-management/buffer/" >}}) defaults to the Gateway setting, so you can leave the shared limit low and lift it on the routes that carry large bodies.{{% /version %}}

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Set up buffer limits per gateway

Use a {{< reuse "/agw-docs/snippets/policy.md" >}} to set a buffer limit on your Gateway, which applies to all routes served by the Gateway.

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that sets the maximum HTTP body buffer size.

   ```yaml {paths="buffering"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: maxbuffer
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - kind: Gateway
       name: agentgateway-proxy
       group: gateway.networking.k8s.io
     frontend:
       http:
         maxBufferSize: 2097152
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `maxBufferSize` | The maximum size of HTTP body that can be buffered into memory.|

2. Port-forward the gateway proxy on port 15000.
   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
   ```

3. Get the config dump and verify that the policy is set as you configured it.

   Example `jq` command:
   ```sh
   curl -s http://localhost:15000/config_dump | jq '[.policies[] | select(.policy.frontend != null and .policy.frontend.hTTP != null and .policy.frontend.hTTP.maxBufferSize != null)] | .[0]'
   ```

   Example output:
   ```json {linenos=table,hl_lines=[18],filename="http://localhost:15000/config_dump"}
   {
     "key": "frontend/agentgateway-system/maxbuffer:frontend-http:agentgateway-system/agentgateway-proxy",
     "name": {
       "kind": "AgentgatewayPolicy",
       "name": "maxbuffer",
       "namespace": "agentgateway-system"
     },
     "target": {
       "gateway": {
        "gatewayName": "agentgateway-proxy",
        "gatewayNamespace": "agentgateway-system",
        "listenerName": null
      }
    },
    "policy": {
      "frontend": {
        "hTTP": {
          "maxBufferSize": 2097152,
          "http1MaxHeaders": null,
          "http1IdleTimeout": null,
          "http2WindowSize": null,
          "http2ConnectionWindowSize": null,
          "http2FrameSize": null,
          "http2KeepaliveInterval": null,
          "http2KeepaliveTimeout": null
        }
      }
    }
   }
   ```

{{< doc-test paths="buffering" >}}
YAMLTest -f - <<'EOF'
- name: wait for maxbuffer policy in config dump
  retries: 20
  http:
    url: http://localhost:15000
    skipSslVerification: true
    method: GET
    path: /config_dump
  source:
    type: pod
    usePortForward: true
    selector:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: agentgateway-proxy
  expect:
    bodyContains:
    - '"maxBufferSize"'
    - '2097152'
EOF
{{< /doc-test >}}

### Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} maxbuffer -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
