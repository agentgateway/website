Set an idle timeout for HTTP/1 traffic to terminate the connection to a downstream or upstream service if there are no active streams. 

## About idle timeouts

An idle timeout configures the time a connection between a downstream client and an upstream service can stay open without sending any data or bytes. 

In HTTP/1.1, connections are usually kept alive so you can reuse them for multiple requests. For example, a request to your upstream service might include a database to retrieve data. If an idle timeout is set too low, the gateway proxy might terminate the connection to the downstream client if the database is slow to respond. This can lead to multiple issues on the client side, including silent connection closures, protocol errors, or increased latency, because the client must establish a new connection in order to proceed. Long idle timeouts however can cause resource exhaustion on the gateway proxy and increased latency for clients, because they need to wait for a new connection to open up on the gateway proxy. 

Note that idle timeouts do not configure how long an upstream service can take to respond to your request. Use [request timeouts]({{< ref "request.md" >}}) for this scenario instead.

{{< callout type="info" >}}
The idle timeout is configured for entire HTTP/1 connections from a downstream service to the gateway proxy, and to the upstream service. 
{{< /callout >}}


{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Set up idle timeouts


1. Create an AgentgatewayPolicy with the idle timeout configuration. In this example, you apply an idle timeout of 30 seconds. 

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: idle-time
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - kind: Gateway
       name: agentgateway-proxy
       group: gateway.networking.k8s.io
     frontend:
       http:
         http1IdleTimeout: 30s
   EOF
   ```

2. Verify that the gateway proxy is configured with the idle timeout.
   1. Port-forward the gateway proxy on port 15000.

      ```sh
      kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
      ```

   2. Get the config dump and verify that the idle timeout policy is set as you configured it.
      
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

{{< reuse "agw-docs/snippets/cleanup.md" >}} Run the following commands.
   
```sh
kubectl delete AgentgatewayPolicy idle-time -n {{< reuse "agw-docs/snippets/namespace.md" >}} 
```


