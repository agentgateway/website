Set the route-level timeout with an HTTPRoute or {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}. To ensure that your apps are available even if they are temporarily unavailable, you can use timeouts alongside [Retries]({{< link-hextra path="/resiliency/retry/" >}}).

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Set up timeouts {#timeouts}
   
Specify timeouts for specific routes. 

1. Configure a timeout for specific routes by using the Kubernetes Gateway API-native configuration in an HTTPRoute or by using an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}. 
   {{< tabs tabTotal="3" items="Option 1: HTTPRoute (Kubernetes GW API),Option 2: AgentgatewayPolicy,Option 3: Gateway listener" >}}
   {{% tab tabName="Option 1: HTTPRoute (Kubernetes GW API)" %}}

   1. Configure the HTTPRoute. In the following example, you set a timeout of 2 seconds for the `/delay` path of the httpbin app. 

      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: gateway.networking.k8s.io/v1
      kind: HTTPRoute
      metadata:
        name: httpbin-timeout
        namespace: httpbin
      spec:
        hostnames:
        - timeout.example
        parentRefs:
        - name: agentgateway-proxy
          namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        rules:
        - matches: 
          - path:
              type: PathPrefix
              value: /delay
          backendRefs:
          - name: httpbin
            port: 8000
            namespace: httpbin
          timeouts:
            request: 2s
      EOF
      ```

   2. Verify that the gateway proxy is configured to apply the timeout to a request.

      1. Port-forward the gateway proxy on port 15000.

         ```sh
         kubectl port-forward deploy/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
         ```

      2. Find the route configuration for the cluster in the config dump. Verify that the timeout policy is set as you configured it. In the output for the following `jq` command, the `delay` prefix is included because it has a timeout set.
        
         Example `jq` command:
        
         ```sh
         curl -s http://localhost:15000/config_dump | jq '[.binds[].listeners | to_entries[] | .value.routes | to_entries[] | select(.value.inlinePolicies[]? | has("timeout")) | .value] | .[0]'
         ```

         Example output:
         ```json {linenos=table,hl_lines=[10,11,12,25,26,27,28,29,30],filename="http://localhost:15000/config_dump"}
         {
            "key": "httpbin/httpbin-timeout.0.0.http",
            "name": "httpbin-timeout",
            "namespace": "httpbin",
            "hostnames": [
              "timeout.example"
            ],
            "matches": [
              {
                "path": {
                  "pathPrefix": "/delay"
                }
              }
            ],
            "backends": [
              {
                "weight": 1,
                "service": {
                  "name": "httpbin/httpbin.httpbin.svc.cluster.local",
                  "port": 8000
                }
              }
            ],
            "inlinePolicies": [
              {
                "timeout": {
                  "requestTimeout": "2s"
                }
              }
            ]
         }

         ```

   {{% /tab %}}
   {{% tab tabName="Option 2: EnterpriseKgatewayTrafficPolicy"  %}}
   
   1. Configure the HTTPRoute. In the following example, you set a timeout of 2 seconds for the `/delay` path of the httpbin app and add an HTTPRoute rule name to the path. You use the rule name later to apply the timeout to a particular route. 
      ```yaml
      kubectl apply -n httpbin -f- <<EOF
      apiVersion: gateway.networking.k8s.io/v1
      kind: HTTPRoute
      metadata:
        name: httpbin-timeout
        namespace: httpbin
      spec:
        hostnames:
        - timeout.example
        parentRefs:
        - name: agentgateway-proxy
          namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        rules:
        - matches: 
          - path:
              type: PathPrefix
              value: /delay
          backendRefs:
          - kind: Service
            name: httpbin
            port: 8000
          name: timeout
      EOF
      ```
   

   2. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} with your timeout settings and use the `targetRefs.sectionName` to apply the timeout to a specific HTTPRoute rule. In this example, you apply the policy to the `timeout` rule that points to the `/delay` path in your HTTPRoute resource.

      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
      kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
      metadata:
        name: timeout
        namespace: httpbin
      spec:
        targetRefs:
        - kind: HTTPRoute
          group: gateway.networking.k8s.io
          name: httpbin-timeout
          sectionName: timeout
        traffic:
          timeouts:
            request: 2s
      EOF
      ```

   3. Find the route configuration for the cluster in the config dump. Verify that the timeout policy is set as you configured it. 
        
      Example `jq` command:
        
      ```sh
      curl -s http://localhost:15000/config_dump | jq '[.policies[] | select(.policy.traffic.timeout?)] | .[0]'
      ```

      Example output:
      ```json {linenos=table,hl_lines=[16,17,18,19,20,21],filename="http://localhost:15000/config_dump"}
      {
         "key": "traffic/httpbin/timeout:timeout:httpbin/httpbin-timeout/timeout",
         "name": {
           "kind": "AgentgatewayPolicy",
           "name": "timeout",
           "namespace": "httpbin"
         },
         "target": {
           "route": {
             "name": "httpbin-timeout",
             "namespace": "httpbin",
             "ruleName": "timeout"
           }
         },
         "policy": {
           "traffic": {
             "phase": "route",
             "timeout": {
               "requestTimeout": "2s"
             }
           }
         }
      }
      ```
   
   {{% /tab %}}

   {{% tab tabName="Option 3: Gateway listener"  %}}
   
   1. Create an HTTPRoute that configures a route to the `/delay` path of the httpbin app. 
      ```yaml
      kubectl apply -n httpbin -f- <<EOF
      apiVersion: gateway.networking.k8s.io/v1
      kind: HTTPRoute
      metadata:
        name: httpbin-timeout
        namespace: httpbin
      spec:
        hostnames:
        - timeout.example
        parentRefs:
        - name: agentgateway-proxy
          namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        rules:
        - matches: 
          - path:
              type: PathPrefix
              value: /delay
          backendRefs:
          - kind: Service
            name: httpbin
            port: 8000
          name: timeout
      EOF
      ```
   

   2. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} with your timeout settings and use the `targetRefs.sectionName` to apply the timeout to a Gateway listener. 

      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
      kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
      metadata:
        name: timeout
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
      spec:
        targetRefs:
        - kind: Gateway
          group: gateway.networking.k8s.io
          name: agentgateway-proxy
          sectionName: http
        traffic:
          timeouts:
            request: 2s
      EOF
      ```

   3. Find the route configuration for the cluster in the config dump. Verify that the timeout policy is set as you configured it. 
        
      Example `jq` command:
        
      ```sh
      curl -s http://localhost:15000/config_dump | jq '[.policies[] | select(.policy.traffic.timeout?)] | .[0]'
      ```

      Example output:
      ```json {linenos=table,hl_lines=[16,17,18,19,20],filename="http://localhost:15000/config_dump"}
      {
        "key": "traffic/agentgateway-system/timeout:timeout:agentgateway-system/agentgateway-proxy/http",
        "name": {
          "kind": "AgentgatewayPolicy",
          "name": "timeout",
          "namespace": "agentgateway-system"
        },
        "target": {
          "gateway": {
            "gatewayName": "agentgateway-proxy",
            "gatewayNamespace": "agentgateway-system",
            "listenerName": "http"
          }
        },
        "policy": {
          "traffic": {
            "phase": "route",
            "timeout": {
              "requestTimeout": "2s"
            }
          }
        }
      }
      ```
   
   {{% /tab %}}
   {{< /tabs >}}

4. Send a request along the `/delay` path of the httpbin. This path delays requests for the number of seconds that you specify. In this example, you delay the request by 1 second. Because the delay is shorter than the timeout that you configured, the request succeeds and a 200 HTTP response code is returned.  
 
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/delay/1 -H "host: timeout.example:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/delay/1 -H "host: timeout.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```
   ...
   < HTTP/1.1 200 OK
   ...
   ```

5. Review the logs of the httpbin app and verify that you can see the successful request.

   ```sh
   kubectl logs -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
   -l gateway.networking.k8s.io/gateway-name=agentgateway-proxy \
   --tail=1 | grep -E 'timeout.example' 
   ```
  
   Example output:

   ```txt
   info	request gateway=agentgateway-system/agentgateway-proxy
   listener=http route=httpbin/timeout endpoint=10.244.0.13:8080
   src.addr=127.0.0.1:34300 http.method=GET http.host=timeout.example
   http.path=/delay/1 http.version=HTTP/1.1 http.status=200
   protocol=http duration=0ms
   ```

6. Repeat the request along the `/delay` path. This time, you use a delay that is longer than the request timeout that you previously specified and therefore simulates an app that is slow to respond. Verify that the request times out and that you get back a 504 HTTP response code. 
 
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/delay/5 -H "host: timeout.example:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/delay/5 -H "host: timeout.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```
   ...
   < HTTP/1.1 504 Gateway Timeout
   ...
   request timeout%    
   ```

7. From the logs, the request took longer than 2 seconds, which triggered the request timeout.

   ```sh
   kubectl logs -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
   -l gateway.networking.k8s.io/gateway-name=agentgateway-proxy \
   --tail=1 | grep -E 'timeout.example' 
   ```
  
   Example output:

   ```txt
   info	request gateway=agentgateway-system/agentgateway-proxy listener=http
   route=httpbin/httpbin-timeout endpoint=10.244.0.21:8080 src.addr=127.0.0.1:43640
   http.method=GET http.host=timeout.example http.path=/delay/5 http.version=HTTP/1.1
   http.status=504 protocol=http error="upstream call timeout" duration=2001ms
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}} Run the following commands.

1. Delete the HTTPRoute resource. 
  ```sh
  kubectl delete httproute httpbin-timeout -n httpbin
  ```
2. If you created an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}, delete it from the namespace you created it in.
  ```sh
  kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} timeout -n httpbin
  kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} timeout -n {{< reuse "agw-docs/snippets/namespace.md" >}}
  ```