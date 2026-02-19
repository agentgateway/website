Set the route-level timeout with an HTTPRoute or {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}. To ensure that your apps are available even if they are temporarily unavailable, you can use timeouts alongside [Retries]({{< link-hextra path="/resiliency/retry/" >}}).

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Set up timeouts {#timeouts}
   
Specify timeouts for a specific route. 

1. Configure a timeout for a specific route by using the Kubernetes Gateway API-native configuration in an HTTPRoute or by using {{< reuse "agw-docs/snippets/kgateway.md" >}}'s {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}. In the following example, you set a timeout of 20 seconds for httpbin's `/headers` path. However, no timeout is set along the `/anything` path. 
   {{< tabs tabTotal="2" items="Option 1: HTTPRoute (Kubernetes GW API),Option 2: AgentgatewayPolicy" >}}
   {{% tab tabName="Option 1: HTTPRoute (Kubernetes GW API)" %}}

   1. Configure the HTTPRoute.

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
              value: /headers
          backendRefs:
          - name: httpbin
            port: 8000
            namespace: httpbin
          timeouts:
            request: 20s
            backendRequest: 2s
        - matches: 
          - path:
              type: PathPrefix
              value: /anything
          backendRefs:
          - name: httpbin
            port: 8000
            namespace: httpbin
      EOF
      ```

   2. Verify that the gateway proxy is configured to apply the timeout to a request.

      1. Port-forward the gateway proxy on port 15000.

         ```sh
         kubectl port-forward deploy/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
         ```

      2. Find the route configuration for the cluster in the config dump. Verify that the timeout policy is set as you configured it. The following `jq` command includes the `headers` prefix because it has a timeout set. The `anything` prefix is not included because it does not have a timeout.
        
         Example `jq` command:
        
         ```sh
         curl -s http://localhost:15000/config_dump | jq '[.binds[].listeners | to_entries[] | .value.routes | to_entries[] | select(.value.inlinePolicies[]? | has("timeout")) | .value] | .[0]'
         ```

         Example output:
         ```json {linenos=table,hl_lines=[25,26,27,28,29,30],filename="http://localhost:15000/config_dump"}
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
                  "pathPrefix": "/headers"
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
                  "requestTimeout": "20s",
                  "backendRequestTimeout": "2s"
                }
              }
            ]
         }

         ```

   {{% /tab %}}
   {{% tab tabName="Option 2: EnterpriseKgatewayTrafficPolicy"  %}}
   1. Install the experimental channel of the Kubernetes Gateway API.
      ```
      kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version.md" >}}/experimental-install.yaml --server-side
      ```
   
   2. Create the HTTPRoute with two routes, `/headers` and `/anything`, and add an HTTPRoute rule name to each path. You use the rule name later to apply the timeout to a particular route. 
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
              value: /headers
          backendRefs:
          - kind: Service
            name: httpbin
            port: 8000
          name: timeout
        - matches: 
          - path:
              type: PathPrefix
              value: /anything
          backendRefs:
          - kind: Service
            name: httpbin
            port: 8000
          name: no-timeout
      EOF
      ```
   
   3. Create a {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} with your timeout settings and use the `targetRefs.sectionName` to apply the timeout to a specific HTTPRoute rule. In this example, you apply the policy to the `timeout` rule that points to the `/headers` path in your HTTPRoute resource.
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
            request: 20s
      EOF
      ```

   4. Find the route configuration for the cluster in the config dump. Verify that the timeout policy is set as you configured it. 
        
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
               "requestTimeout": "20s"
             }
           }
         }
      }
      ```
   
   {{% /tab %}}
   {{< /tabs >}}




## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}
   
```sh
kubectl delete httproute httpbin-timeout -n httpbin
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} timeout -n httpbin
```
