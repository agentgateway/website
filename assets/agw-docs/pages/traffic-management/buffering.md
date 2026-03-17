Fine-tune connection speeds for read and write operations by setting a connection buffer limit.


## About buffer limits

By default, {{< reuse "/agw-docs/snippets/agentgateway.md" >}} allows up to 2mb of HTTP body to be buffered into memory for each gateway. For large requests that must be buffered and that exceed the default buffer limit, {{< reuse "/agw-docs/snippets/agentgateway.md" >}} either disconnects the connection to the downstream service if headers were already sent, or returns a 413 HTTP response code. To make sure that large requests can be sent and received, you can specify the maximum number of bytes that can be buffered between the gateway and the downstream service. Alternatively, when using {{< reuse "/agw-docs/snippets/agentgateway.md" >}} as an edge proxy, configuring the buffer limit can be important when dealing with untrusted downstreams. By setting the limit to a small number, such as 32768 bytes (32KiB), you can better guard against potential attacks or misconfigured downstreams that could excessively use the proxy's resources.

The buffer limit is configured at the Gateway level via a {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Set up buffer limits per gateway

Use a {{< reuse "/agw-docs/snippets/trafficpolicy.md" >}} to set a buffer limit on your Gateway, which applies to all routes served by the Gateway.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that sets the maximum HTTP body buffer size.

   ```yaml {paths="buffering"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
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
   | `maxBufferSize` | The maximum size of HTTP body that can be buffered into memory. Defaults to 2mb if unset. Minimum value: 1. |

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
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} maxbuffer -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
