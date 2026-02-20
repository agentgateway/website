Customize the default idle timeout of 1 hour (3600s). 

## About idle timeouts

You can customize an idle timeout for a connection to a downstream or upstream service if there are no active streams.

Note that the idle timeout configures the timeout for the entire connection from a downstream service to the gateway proxy, and to the upstream service. 


{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Set up idle timeouts

1. Create an HTTPRoute.

   ```yaml
   kubectl apply -n httpbin -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: idle-timeout
     namespace: httpbin
   spec:
     hostnames:
     - idle.example
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches: 
       - path:
           type: PathPrefix
           value: /stream
       backendRefs:
       - kind: Service
         name: httpbin
         port: 8000
       name: timeout
     - matches: 
       - path:
           type: PathPrefix
           value: /headers
       backendRefs:
       - kind: Service
         name: httpbin
         port: 8000
       name: no-timeout
     - matches: 
       - path:
           type: PathPrefix
           value: /delay
       backendRefs:
       - kind: Service
         name: httpbin
         port: 8000
       name: delay-timeout
   EOF
   ```

1. Create an AgentgatewayPolicy with the idle timeout configuration. In this example, you apply an idle timeout of 2 seconds, which is short for testing purposes. A more realistic timeout might be 20-30 seconds.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: AgentgatewayPolicy
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
         http1IdleTimeout: 1s
   EOF
   ```

2. Verify that the gateway proxy is configured with the idle timeout.
   1. Port-forward the gateway proxy on port 15000.

      ```sh
      kubectl port-forward deployment/http -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
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
              "http1IdleTimeout": "5s",
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
kubectl delete httproute idle-timeout -n httpbin
kubectl delete AgentgatewayPolicy idle-time -n {{< reuse "agw-docs/snippets/namespace.md" >}} 
```


