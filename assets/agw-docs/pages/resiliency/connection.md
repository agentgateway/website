Configure and manage HTTP connections to an upstream service. 

## Supported HTTP connection settings

You can use an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} to apply HTTP connection settings to a service in your cluster. These settings include idle connection timeouts or the maximum number of connections that an upstream service can receive. 

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Configure HTTP protocol connections {#http}

You can use an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} to configure connection options when handling upstream HTTP requests. Note that these options are applied to HTTP/1 and HTTP/2 requests only when indicated in the name. 

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that applies connection configuration to the httpbin app. 

   ```yaml
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: httpbin-policy
     namespace: httpbin
   spec:
     targetRefs:
       - name: httpbin
         group: ""
         kind: Service
     frontend:
       http:
         maxBufferSize: 2097152
         http1MaxHeaders: 15
         http1IdleTimeout: 10s
         http2WindowSize: 1
         http2ConnectionWindowSize: 
         http2FrameSize: 
         http2KeepaliveInterval: 5s
         http2KeepaliveTimeout: 30s
   ```

   | Setting | Description | 
   | -- | -- | 
   | `idleTimeout` | The idle timeout for connections. The idle timeout is defined as the period in which there are no active requests. When the idle timeout is reached, the connection is closed. Note that request-based timeouts mean that HTTP/2 PINGs do not keep the connection alive. If not specified, the idle timeout defaults to 1 hour. To disable idle timeouts, explicitly set this field to 0. **Warning**: Disabling the timeout has a highly likelihood of yielding connection leaks, such as due to lost TCP FIN packets.| 
   | `maxHeadersCount` | The maximum number of headers that can be sent in a connection. If not specified, the number defaults to 100. Requests that exceed this limit receive a 431 response for HTTP/1 and cause a stream reset for HTTP/2. | 
   | `maxStreamDuration` | The total duration to keep alive an HTTP request/response stream. If the time limit is reached, the stream is reset independent of any other timeouts. If not specified, this value is not set. | 
   | `maxRequestsPerConnection` | The maximum number of requests that can be sent per connection. | 
 

2. Port-forward the gateway proxy on port 15000. 
   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
   ```
   
3. Get the config dump and verify that the idle timeout policy is set as you configured it.
  
   Example `jq` command:
   ```sh
   curl -s http://localhost:15000/config_dump | jq '[.policies[] | select(.policy.frontend != null and .policy.frontend.hTTP != null and .policy.frontend.hTTP.http1IdleTimeout != null)] | .[0]'
   ```
  
   Example output: 
   ```json {linenos=table,hl_lines=[20],filename="http://localhost:15000/config_dump"}
   {
     "key": "frontend/agentgateway-system/idle-time:frontend-http:agentgateway-system/agentgateway-proxy",
     "name": {
       "kind": "AgentgatewayPolicy",
       "name": "idle-time",
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
          "http1IdleTimeout": "30s",
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
    
## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} httpbin-connection -n httpbin
```

## Next steps

You can learn more about these individual HTTP connection settings.

{{< cards >}}
  {{< card path="/resiliency/timeouts/idle/" title="Idle timeouts" subtitle="Set idle timeout settings." >}}
  {{< card path="/resiliency/keepalive/" title="Keepalive" subtitle="Set keepalive settings." >}}
{{< /cards >}}

