Specify the number of times and duration for the gateway to try a connection to an unresponsive backend service.<!--
You might commonly use retries alongside [Timeouts]({{< link-hextra path="/resiliency/timeouts/">}}) to ensure that your apps are available even if they are temporarily unavailable. -->

{{< callout type="warning" >}} 
{{< reuse "agw-docs/versions/warn-experimental.md" >}}
{{< /callout >}}

## About request retries

A request retry is the number of times a request is retried if it fails. This setting can be useful to avoid your apps from failing if they are temporarily unavailable. With retries, calls are retried a certain number of times before they are considered failed. Retries can enhance your app's availability by making sure that calls don't fail permanently because of transient problems, such as a temporarily overloaded service or network.

<!-- TO DO: Is the sample app needed since another is installed? -->
{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}
 


## Step 1: Set up request retries {#setup-retries}

Set up retries to the sample app.

1. Install the experimental Kubernetes Gateway API CRDs.

   ```sh
   kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version.md" >}}/experimental-install.yaml --server-side
   ```
  
2. Create your retry rules. You can choose to apply a retry on an HTTPRoute by using the Kubernetes Gateway API-native approach, or to add a retry to a specific HTTPRoute rule or Gateway listener by using an {{< reuse "agw-docs/snippets/backend.md" >}} resource. 

   {{< tabs tabTotal="3" items="HTTPRoute (Kubernetes GW API),HTTPRoute and rule (AgentgatewayPolicy),Gateway listener" >}}
   {{% tab tabName="HTTPRoute (Kubernetes GW API)" %}}
   1. Step
      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: gateway.networking.k8s.io/v1
      kind: HTTPRoute
      metadata:
        name: retry
        namespace: httpbin
      spec:
        hostnames:
        - retry.example
        parentRefs:
        - name: agentgateway-proxy
          namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        rules:
        - matches: 
          - path:
              type: PathPrefix
              value: /
          backendRefs:
          - name: httpbin
            port: 8000
          retry:
            attempts: 3
            backoff: 1s
            codes: 
            - 500
            - 503
      EOF
      ```

      {{< reuse "agw-docs/snippets/review-table.md" >}}

      | Field | Description |
      |-------|-------------|
      | `hostnames` | The hostnames to match the request, such as `retry.example`. |
      | `parentRefs` | The gateway to which the request is sent. In this example, you select the `agentgateway-proxy` gateway that you set up before you began. |
      | `rules` | The rules to apply to requests. |
      | `matches` | The path to match the request. In this example, you match any requests to the sample app with path prefix `/`. |
      | `path` | The path to match the request.  |
      | `backendRefs` | The backend service to which the request is sent. In this example, you select the `httpbin` service that you set up in [before you begin](#before-you-begin). |
      | `retry.attempts` | The number of times to retry the request. In this example, you retry the request 3 times. |
      | `retry.backoff` | The duration to wait before retrying the request. In this example, you wait 1 second before retrying the request. |
      | `retry.codes` | The HTTP status codes for which the gateway retries the request. In this example, the request is retried if the backend returns 500 or 503. |

   2. Verify that the gateway proxy is configured to retry the request.

      1. Port-forward the gateway proxy on port 15000.

         ```sh
         kubectl port-forward deploy/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
         ```

      2. Find the route configuration for the cluster in the config dump. Verify that the retry policy is set as you configured it.
        
         Example `jq` command:
        
         ```sh
         curl -s http://localhost:15000/config_dump | jq '[.binds[].listeners | to_entries[] | .value.routes | to_entries[] | select(.value.name == "retry" and (.value.inlinePolicies[]? | has("retry"))) | .value] | .[0]'
         ```

         Example output:
         ```json {linenos=table,hl_lines=[26,27,28,29,30,31,32,33,34,35],filename="http://localhost:15000/config_dump"}
         ...
         {
           "key": "httpbin/retry.0.0.http",
           "name": "retry",
           "namespace": "httpbin",
           "hostnames": [
             "retry.example"
           ],
           "matches": [
             {
               "path": {
                 "pathPrefix": "/"
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
               "retry": {
                 "attempts": 3,
                 "backoff": "1s",
                 "codes": [
                   "500 Internal Server Error",
                   "503 Service Unavailable"
                 ]
               }
             }
           ]
         }
         ```
    
   {{% /tab %}}
   {{% tab tabName="HTTPRoute (EnterpriseAgentgatewayPolicy)" %}}
   1. Create an HTTPRoute that routes requests along the `retry.example` domain to the sample app.
      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: gateway.networking.k8s.io/v1
      kind: HTTPRoute
      metadata:
        name: retry
        namespace: httpbin
      spec:
        hostnames:
        - retry.example
        parentRefs:
        - name: agentgateway-proxy
          namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        rules:
        - matches: 
           - path:
              type: PathPrefix
              value: /
          backendRefs:
          - name: httpbin
            namespace: httpbin
            port: 8000 
      EOF
      ```

   2. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that applies a retry policy to the HTTPRoute rule. 
      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
      kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
      metadata:
        name: retry
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
      spec:
        targetRefs:
        - kind: HTTPRoute
          group: gateway.networking.k8s.io
          name: retry
        traffic:
          retry:
            attempts: 3
            backoff: 1s
            codes: 
            - 500
            - 503
      EOF
      ```
        
      {{< reuse "agw-docs/snippets/review-table.md" >}}

      | Field | Description |
      |-------|-------------|
      | `targetRefs.sectionName` | Select the HTTPRoute rule that you want to apply the policy to. |
      | `retry.attempts` | The number of times to retry the request. In this example, you retry the request 3 times. |
      | `retry.backoff` | The duration to wait before retrying the request. In this example, you wait 1 second before retrying the request. |
      | `retry.codes` | The condition that must be met for the gateway proxy to retry the request. In this example, the request is retried if a 500 or 503 HTTP response code is returned. | 


   3. Verify that the gateway proxy is configured to retry the request.

      1. Port-forward the gateway proxy on port 15000.

         ```sh
         kubectl port-forward deploy/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
         ```

      2. Find the route configuration for the cluster in the config dump. Verify that the retry policy is set as you configured it.
        
         Example `jq` command:
        
         ```sh
         curl -s http://localhost:15000/config_dump | jq '[.. | objects | select(has("policy") and .policy.traffic.retry?.attempts == 3 and .name.name? == "retry")] | .[0]'
         ```

         Example output:
         ```json {linenos=table,hl_lines=[19,20,21,22,23,24,25,26],filename="http://localhost:15000/config_dump"}
         ...
         {
           "key": "traffic/agentgateway-system/retry:retry:agentgateway-system/retry",
           "name": {
             "kind": "AgentgatewayPolicy",
             "name": "retry",
             "namespace": "agentgateway-system"
           },
           "target": {
             "route": {
               "name": "retry",
               "namespace": "agentgateway-system"
             }
           },
           "policy": {
             "traffic": {
               "phase": "route",
               "retry": {
                 "attempts": 3,
                 "backoff": "1s",
                 "codes": [
                   "500 Internal Server Error",
                   "503 Service Unavailable"
                 ]
               }
             }
           }
         }
         ...
         ```

    
   {{% /tab %}}
   {{% tab tabName="Gateway listener" %}}
   1. Create an HTTPRoute that routes requests along the `retry.example` domain to the sample app. 
      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: gateway.networking.k8s.io/v1
      kind: HTTPRoute
      metadata:
        name: retry
        namespace: httpbin
      spec:
        hostnames:
        - retry.example
        parentRefs:
        - name: agentgateway-proxy
          namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        rules:
        - matches: 
          - path:
              type: PathPrefix
              value: /
          backendRefs:
          - name: httpbin
            namespace: httpbin
            port: 8000 
      EOF
      ```
   2. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that applies a retry policy to the `agentgateway-proxy` Gateway listener. You set up this Gateway in the [before you begin](#before-you-begin) section.  
      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
      kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
      metadata:
        name: retry
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
      spec:
        targetRefs:
        - kind: Gateway
          group: gateway.networking.k8s.io
          name: agentgateway-proxy
          sectionName: http
        traffic:
          retry:
            attempts: 3
            backoff: 1s
            codes: 
            - 500
            - 503
      EOF
      ```
        
      | Field | Description |
      |-------|-------------|
      | `targetRefs.sectionName` | Select the Gateway listener that you want to apply the policy to. |
      | `retry.attempts` | The number of times to retry the request. In this example, you retry the request 3 times. |
      | `retry.backoff` | The duration to wait before retrying the request. In this example, you wait 1 second before retrying the request. |
      | `retry.codes` | The condition that must be met for the gateway proxy to retry the request. In this example, the request is retried if a 500 or 503 HTTP response code is returned. | 

   3. Verify that the gateway proxy is configured to retry the request.

      1. Port-forward the gateway proxy on port 15000.

         ```sh
         kubectl port-forward deploy/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
         ```

      2. Find the route configuration for the cluster in the config dump. Verify that the retry policy is set as you configured it.
        
         Example `jq` command:
        
         ```sh
         curl -s http://localhost:15000/config_dump | jq '[.. | objects | select(has("policy") and .policy.traffic.retry?.attempts == 3 and .name.name? == "retry")] | .[0]'
         ```

         Example output:
         ```json {linenos=table,hl_lines=[20,21,22,23,24,25,26,27],filename="http://localhost:15000/config_dump"}
         ...
         "policies": [
         {
           "key": "traffic/agentgateway-system/retry:retry:agentgateway-system/agentgateway-proxy/http",
           "name": {
             "kind": "AgentgatewayPolicy",
             "name": "retry",
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
               "retry": {
                 "attempts": 3,
                 "backoff": "1s",
                 "codes": [
                   "500 Internal Server Error",
                   "503 Service Unavailable"
                 ]
               }
             }
           }
         }]
         ...
         ```

   {{% /tab %}}
   {{< /tabs >}}


4. Send a request to the sample app. Verify that the request succeeds.
 
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/headers -H "host: retry.example:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/headers -H "host: retry.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output for a successful response:

   ```
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < access-control-allow-credentials: true
   access-control-allow-credentials: true
   < access-control-allow-origin: *
   access-control-allow-origin: *
   < content-type: application/json; encoding=utf-8
   content-type: application/json; encoding=utf-8
   < content-length: 146
   content-length: 146
   < 

   {
     "headers": {
       "Accept": [
         "*/*"
       ],
       "Host": [
         "retry.example"
       ],
       "User-Agent": [
         "curl/8.7.1"
      ]
     }
   }
   ```

5. Verify that the request was not retried.

   ```sh
   kubectl logs -n {{< reuse "agw-docs/snippets/namespace.md" >}} -l gateway.networking.k8s.io/gateway-name=agentgateway-proxy --tail=1 | grep -E 'retry.example' 
   ```
  
   Example output: The most recent log shows the successful request.

   ```txt
   info	request gateway=agentgateway-system/agentgateway-proxy listener=http route=httpbin/retry endpoint=10.244.0.13:8080 src.addr=127.0.0.1:34300 http.method=GET http.host=retry.example http.path=/headers http.version=HTTP/1.1 http.status=200 protocol=http duration=0ms
   ```


## Step 2: Trigger a retry {#trigger-retry}

Simulate a failure for the sample app so that you can verify that the request is retried.

1. Send another request to the httpbin app along the `/status/500` path. This path returns a 500 HTTP response code. Because the  agentgateway proxy is configured to retry a request when a 500 HTTP response code is received, the proxy starts retrying the request.
   
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/status/500 -H "host: retry.example:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/status/500 -H "host: retry.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```
   ...
   < HTTP/1.1 500 Internal Server Error
   ...
   ```

2. Verify that the request was retried. Look for `retry.attempt=3` in the output.

   ```sh
   kubectl logs -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
   -l gateway.networking.k8s.io/gateway-name=agentgateway-proxy \
   --tail=1 | grep -E 'retry.example' 
   ```

   Example output:
   ```
   info	request gateway=agentgateway-system/agentgateway-proxy listener=http route=httpbin/retry endpoint=10.244.0.21:8080 src.addr=127.0.0.1:59284 http.method=GET http.host=retry.example http.path=/status/500 http.version=HTTP/1.1 http.status=500 protocol=http retry.attempt=3 duration=1ms
   ```




## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Delete the HTTPRoute resource. 
   
   ```sh
   kubectl delete httproute retry -n httpbin
   ```
2. If you created an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}, delete it.
   ```sh
   kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} retry -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```





