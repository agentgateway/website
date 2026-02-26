Set an idle timeout for HTTP/1 traffic to terminate the connection to a downstream or upstream service if there are no active streams. 

## About idle timeouts

The idle timeout applies when there is no activity on the connection, no bytes sent or received. It does not limit how long a single request or response can take. For example, calling httpbin’s `/delay` keeps a request active, so the connection is not idle and you get a successful 200 response after the time specified. To limit how long a request can run, use a [request timeout]({{< ref "request.md" >}}) for this scenario instead.

{{< callout type="info" >}}
The idle timeout is configured for entire HTTP/1 connections from a downstream service to the gateway proxy, and to the upstream service. 
{{< /callout >}}


{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Set up idle timeouts

1. Create an HTTPRoute for the `/headers` route.

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
           value: /headers
       backendRefs:
       - kind: Service
         name: httpbin
         port: 8000
   EOF
   ```

1. Create an AgentgatewayPolicy with the idle timeout configuration. In this example, you apply an idle timeout of 1 second, which is short for testing purposes. You might choose to use 20-30 seconds as a more realistic timeout.

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
         http1IdleTimeout: 1s
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
              "http1IdleTimeout": "1s",
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
3. Send a request along the `/headers` path of the httpbin and verify that it was successful. 
 
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/headers --http1.1 -H "host: idle.example:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/headers --http1.1 -H "host: idle.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```
   ...
   < HTTP/1.1 200 OK
   ...
   {
    "headers": {
      "Accept": [
        "*/*"
      ],
      "Host": [
        "idle.example"
      ],
      "User-Agent": [
        "curl/8.7.1"
      ]
    }
   }
   ```
      
## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}} Run the following commands.
   
```sh
kubectl delete httproute idle-timeout -n httpbin
kubectl delete AgentgatewayPolicy idle-time -n {{< reuse "agw-docs/snippets/namespace.md" >}} 
```


