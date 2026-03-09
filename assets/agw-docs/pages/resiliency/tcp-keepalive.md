Manage idle and stale connections with TCP keepalive.

## About TCP keepalive

With keepalive, the kernel sends probe packets with only an acknowledgement flag (ACK) to the TCP socket of the destination after the connection was idle for a specific amount of time. This way, the connection does not have to be re-established repeatedly, which could otherwise lead to latency spikes. If the destination returns the packet with an acknowledgement flag (ACK), the connection is determined to be alive. If not, the probe can fail a certain number of times before the connection is considered stale. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} can then close the stale connection, which can help avoid longer timeouts and retries on broken or stale connections.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Set up TCP keepalive

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

4. Open the config dump and find the `kube_httpbin_httpbin_8000` cluster. Verify that you see all the connection settings that you enabled in your BackendConfigPolicy. 
   
   Example output
   ```console {hl_lines=[5,6,7,8]}
   ...
      "connect_timeout": "5s",
      "metadata": {},
      "upstream_connection_options": {
       "tcp_keepalive": {
        "keepalive_probes": 3,
        "keepalive_time": 30,
        "keepalive_interval": 5
       }
      }
     },
   ...
   ```
    
## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}} Run the following command.

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} httpbin-keepalive -n httpbin
```





