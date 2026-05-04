Replace the host header value before forwarding a request to a backend service by using the `URLRewrite` filter. 

For more information, see the [{{< reuse "agw-docs/snippets/k8s-gateway-api-name.md" >}} documentation](https://gateway-api.sigs.k8s.io/reference/spec/#httpurlrewritefilter).

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## In-cluster service host rewrites

1. Create an HTTPRoute resource for the httpbin app that uses the `URLRewrite` filter to rewrite the hostname of the request. In this example, all incoming requests on the `rewrite.example` domain are rewritten to the `www.example.com` host.
   ```yaml {paths="host-rewrite"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: httpbin-rewrite
     namespace: httpbin
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     hostnames:
       - rewrite.example
     rules:
       - matches:
           - path:
               type: PathPrefix
               value: /
         filters:
           - type: URLRewrite
             urlRewrite:
               hostname: "www.example.com"
         backendRefs:
           - name: httpbin
             port: 8000
   EOF
   ```
   
   |Setting|Description|
   |--|--|
   |`spec.parentRefs`| The name and namespace of the Gateway that serves this HTTPRoute. In this example, you use the `agentgateway-proxy` gateway that was created as part of the get started guide. |
   |`spec.rules.filters.type`| The type of filter that you want to apply to incoming requests. In this example, the `URLRewrite` filter is used.|
   |`spec.rules.filters.urlRewrite.hostname`| The hostname that you want to rewrite requests to. |
   |`spec.rules.backendRefs`|The backend destination you want to forward traffic to. In this example, all traffic is forwarded to the httpbin app that you set up as part of the get started guide. |

2. Send a request to the httpbin app on the `rewrite.example` domain. Verify that you get back a 200 HTTP response code and that you see the `Host: www.example.com` header in your response. 

   {{< callout type="info" >}}
   The following request returns a 200 HTTP response code, because you set up an HTTPRoute for the httpbin app on the `www.example.com` domain as part of the getting started guide. If you chose a different domain for your example, make sure that you have an HTTPRoute that can be reached under the host you want to rewrite to. 
   {{< /callout >}}
   
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/headers -H "host: rewrite.example:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/headers -H "host: rewrite.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}
   
   Example output:
   ```console {hl_lines=[7,8]}
   ...
   {
    "headers": {
      "Accept": [
        "*/*"
      ],
      "Host": [
        "www.example.com"
      ],
      "User-Agent": [
        "curl/8.7.1"
      ]
    }
   }
   ```

{{< doc-test paths="host-rewrite" >}}
YAMLTest -f - <<'EOF'
- name: wait for httpbin-rewrite HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: httpbin
        name: httpbin-rewrite
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF
{{< /doc-test >}}

{{< doc-test paths="host-rewrite" >}}
for i in $(seq 1 60); do
  curl -s --max-time 5 -o /dev/null "http://${INGRESS_GW_ADDRESS}:80/headers" -H "host: rewrite.example" && break
  sleep 2
done
{{< /doc-test >}}

{{< doc-test paths="host-rewrite" >}}
YAMLTest -f - <<'EOF'
- name: host rewrite - rewrite.example rewrites host header to www.example.com
  retries: 1
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80"
    path: /headers
    method: GET
    headers:
      host: "rewrite.example"
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.headers.Host[0]"
        comparator: equals
        value: "www.example.com"
EOF
{{< /doc-test >}}

## External service host rewrites

1. Create an {{< reuse "/agw-docs/snippets/agentgateway/agentgatewaybackend.md" >}} that represents your external service. The following example creates an {{< reuse "/agw-docs/snippets/agentgateway/agentgatewaybackend.md" >}} for the `httpbin.org` domain. 
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "/agw-docs/snippets/agentgateway/agentgatewaybackend.md" >}}
   metadata:
     name: httpbin
     namespace: httpbin
   spec:
     static:
       host: httpbin.org
       port: 80
   EOF
   ```
   
2. Create an HTTPRoute resource that matches incoming traffic on the `external-rewrite.example` domain and forwards traffic to the {{< reuse "/agw-docs/snippets/agentgateway/agentgatewaybackend.md" >}} that you created. Because the {{< reuse "/agw-docs/snippets/agentgateway/agentgatewaybackend.md" >}} expects a different domain, you use the `URLRewrite` filter to rewrite the hostname from `external-rewrite.example` to `httpbin.org`. 
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: backend-rewrite
     namespace: httpbin
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     hostnames:
       - external-rewrite.example
     rules:
        - filters:
          - type: URLRewrite
            urlRewrite:
              hostname: "httpbin.org"
          backendRefs:
          - name: httpbin
            kind: {{< reuse "/agw-docs/snippets/agentgateway/agentgatewaybackend.md" >}}
            group: agentgateway.dev
   EOF
   ```

2. Send a request to the `external-rewrite.example` domain. Verify that you get back a 200 HTTP response code and that you see the `Host: httpbin.org` header in your response. 
   
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/headers -H "host: external-rewrite.example:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/headers -H "host: external-rewrite.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}
   
   Example output: 
   ```console {hl_lines=[2,3,21]}
   * Request completely sent off
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < content-type: application/json
   content-type: application/json
   < content-length: 268
   content-length: 268
   < server: envoy
   server: envoy
   < access-control-allow-origin: *
   access-control-allow-origin: *
   < access-control-allow-credentials: true
   access-control-allow-credentials: true
   < x-envoy-upstream-service-time: 2416
   x-envoy-upstream-service-time: 2416
   < 

   {
     "headers": {
       "Accept": "*/*", 
       "Host": "httpbin.org", 
       "User-Agent": "curl/8.7.1"
     }
   }   
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete httproute httpbin-rewrite -n httpbin
kubectl delete httproute backend-rewrite -n httpbin
kubectl delete {{< reuse "/agw-docs/snippets/agentgateway/agentgatewaybackend.md" >}} httpbin -n httpbin
```



