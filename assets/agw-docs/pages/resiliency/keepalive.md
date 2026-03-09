Manage idle and stale connections with TCP and HTTP keepalive.

## About keepalive

With keepalive, the kernel sends probe packets with only an acknowledgement flag (ACK) to the TCP or HTTP/2 socket of the destination after the connection was idle for a specific amount of time. This way, the connection does not have to be re-established repeatedly, which could otherwise lead to latency spikes. If the destination returns the packet with an acknowledgement flag (ACK), the connection is determined to be alive. If not, the probe can fail a certain number of times before the connection is considered stale. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} can then close the stale connection, which can help avoid longer timeouts and retries on broken or stale connections.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## TCP keepalive

### Set up TCP keepalive

1. Create a {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that applies TCP keepalive settings to the httpbin service. 
   ```yaml 
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: httpbin-keepalive
     namespace: httpbin
   spec:
     targetRefs:
     - kind: Gateway
       name: agentgateway-proxy
       group: gateway.networking.k8s.io
     frontend:
       tcp:
         keepalive:
           retries: 3
           time: 30s
           interval: 5s
   EOF
   ```  
   
   | Setting | Description | 
   | -- | -- | 
   | `retries` | The maximum number of retries to send without a response before a connection is considered stale. | 
   | `time` | The number of seconds a connection needs to be idle before retries are sent. |
   | `interval` | The number of seconds between retries.  |  

2. Port-forward the gateway proxy on port 15000. 
   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
   ```

3. Get the config dump and verify that the keepalive policy is set as you configured it.
      
      Example `jq` command:
      ```sh
      curl -s http://localhost:15000/config_dump | jq '[.policies[] | select(.policy.frontend != null and .policy.frontend.tCP != null and .policy.frontend.tCP.keepalives != null)] | .[0]'

      ```
      
      Example output: 
      ```json {linenos=table,hl_lines=[18,19,20,21,22,23],filename="http://localhost:15000/config_dump"}
      {
         "key": "frontend/httpbin/httpbin-keepalive:frontend-tcp:httpbin/agentgateway-proxy",
         "name": {
            "kind": "AgentgatewayPolicy",
            "name": "httpbin-keepalive",
            "namespace": "httpbin"
         },
         "target": {
            "gateway": {
               "gatewayName": "agentgateway-proxy",
               "gatewayNamespace": "httpbin",
               "listenerName": null
            }
         },
         "policy": {
            "frontend": {
               "tCP": {
               "keepalives": {
                  "enabled": true,
                  "time": "30s",
                  "interval": "5s",
                  "retries": 3
               }
               }
            }
         }
      }
      ```

    
### Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}} Run the following command.

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} httpbin-keepalive -n httpbin
```

## HTTP keepalive


### Set up HTTP keepalive

1. Create a {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that applies HTTP keepalive settings to the httpbin service. 
   ```yaml 
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: httpbin-keepalive
     namespace: httpbin
   spec:
     targetRefs:
     - kind: Gateway
       name: agentgateway-proxy
       group: gateway.networking.k8s.io
     frontend:
       http:
         http2KeepaliveInterval: 5s
         http2KeepaliveTimeout: 30s
   EOF
   ```  
   
   | Setting | Description | 
   | -- | -- | 
   | `http2KeepaliveInterval` | The number of seconds to keep the connection alive.  |
   | `http2KeepaliveTimeout` | The number of seconds a connection needs to be idle. |
   

2. Port-forward the gateway proxy on port 15000. 
   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
   ```

3. Get the config dump and verify that the keepalive policy is set as you configured it.
      
      Example `jq` command:
      ```sh
      curl -s http://localhost:15000/config_dump | jq '[.policies[] | select(.policy.frontend != null and .policy.frontend.hTTP != null and .policy.frontend.hTTP.http2KeepaliveInterval != null)] | .[0]'


      ```
      
      Example output: 
      ```json {linenos=table,hl_lines=[24,25],filename="http://localhost:15000/config_dump"}
      {
         "key": "frontend/httpbin/httpbin-keepalive:frontend-http:httpbin/agentgateway-proxy",
         "name": {
            "kind": "AgentgatewayPolicy",
            "name": "httpbin-keepalive",
            "namespace": "httpbin"
         },
         "target": {
            "gateway": {
               "gatewayName": "agentgateway-proxy",
               "gatewayNamespace": "httpbin",
               "listenerName": null
            }
         },
         "policy": {
            "frontend": {
               "hTTP": {
               "maxBufferSize": 2097152,
               "http1MaxHeaders": null,
               "http1IdleTimeout": "10m0s",
               "http2WindowSize": null,
               "http2ConnectionWindowSize": null,
               "http2FrameSize": null,
               "http2KeepaliveInterval": "5s",
               "http2KeepaliveTimeout": "30s"
               }
            }
         }
      }
      ```

    
### Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}} Run the following command.

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} httpbin-keepalive -n httpbin
```



