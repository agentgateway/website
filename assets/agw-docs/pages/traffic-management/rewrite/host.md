Replace the host header value before forwarding a request to a backend service by using the `URLRewrite` filter. 

For more information, see the [{{< reuse "agw-docs/snippets/k8s-gateway-api-name.md" >}} documentation](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#httpurlrewritefilter).

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## In-cluster service host rewrites

1. Create an HTTPRoute resource for the httpbin app that uses the `URLRewrite` filter to rewrite the hostname of the request. In this example, all incoming requests on the `rewrite.example` domain are rewritten to the `www.example.com` host.
   ```yaml
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

   > [!NOTE]
   > The following request returns a 200 HTTP response code, because you set up an HTTPRoute for the httpbin app on the `www.example.com` domain as part of the getting started guide. If you chose a different domain for your example, make sure that you have an HTTPRoute that can be reached under the host you want to rewrite to. 
   
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/headers -H "host: rewrite.example:80"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
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

## External service host rewrites

1. Create an {{< reuse "/agw-docs/snippets/backend.md" >}} that represents your external service. The following example creates an {{< reuse "/agw-docs/snippets/backend.md" >}} for the `httpbin.org` domain. 
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "/agw-docs/snippets/backend.md" >}}
   metadata:
     name: httpbin
     namespace: httpbin
   spec:
     static:
       host: httpbin.org
       port: 80
   EOF
   ```
   
2. Create an HTTPRoute resource that matches incoming traffic on the `external-rewrite.example` domain and forwards traffic to the {{< reuse "/agw-docs/snippets/backend.md" >}} that you created. Because the {{< reuse "/agw-docs/snippets/backend.md" >}} expects a different domain, you use the `URLRewrite` filter to rewrite the hostname from `external-rewrite.example` to `httpbin.org`. 
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
            kind: {{< reuse "/agw-docs/snippets/backend.md" >}}
            group: agentgateway.dev
   EOF
   ```

2. Send a request to the `external-rewrite.example` domain. Verify that you get back a 200 HTTP response code and that you see the `Host: httpbin.org` header in your response. 
   
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/headers -H "host: external-rewrite.example:80"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
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

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}
## Backend-specific host rewrites

When a rule splits traffic between backends that expect different hosts, rewrite the host for one backend only. To do so, add the `URLRewrite` filter to the `backendRefs` entry of that backend instead of to the rule. Requests to the other backends in the rule keep their original host.

1. Create an HTTPRoute that splits traffic on the `backend-host-rewrite.example` domain between the in-cluster httpbin app and the `httpbin.org` {{< reuse "/agw-docs/snippets/backend.md" >}} that you created in the [external service](#external-service-host-rewrites) section. Only the requests to `httpbin.org` are rewritten to the `httpbin.org` host.
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: backend-host-rewrite
     namespace: httpbin
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     hostnames:
       - backend-host-rewrite.example
     rules:
       - backendRefs:
           - name: httpbin
             port: 8000
             weight: 50
           - name: httpbin
             kind: {{< reuse "/agw-docs/snippets/backend.md" >}}
             group: agentgateway.dev
             weight: 50
             filters:
               - type: URLRewrite
                 urlRewrite:
                   hostname: "httpbin.org"
   EOF
   ```

   |Setting|Description|
   |--|--|
   |`spec.rules.backendRefs.weight`| The share of requests that each backend gets. In this example, each backend gets half of the requests. |
   |`spec.rules.backendRefs.filters.type`| The filter that applies only to the requests that the gateway forwards to this backend. In this example, the `URLRewrite` filter is used. The in-cluster httpbin backend has no filter, so its requests keep the `backend-host-rewrite.example` host. |
   |`spec.rules.backendRefs.filters.urlRewrite.hostname`| The hostname that you want to rewrite to for the requests that the gateway forwards to this backend. |

2. Send six requests to the `backend-host-rewrite.example` domain, and print the `Host` header that each backend received. Verify that the requests to the in-cluster httpbin app keep the `backend-host-rewrite.example` host, and that the requests to `httpbin.org` have the `httpbin.org` host.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   for i in $(seq 1 6); do
     curl -s http://$INGRESS_GW_ADDRESS:80/headers -H "host: backend-host-rewrite.example" | jq -c '.headers.Host'
   done
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   for i in $(seq 1 6); do
     curl -s localhost:8080/headers -H "host: backend-host-rewrite.example" | jq -c '.headers.Host'
   done
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output: The in-cluster httpbin app returns the host as a list, and `httpbin.org` returns it as a string. Because the gateway splits the traffic by weight, the order of your output differs.
   ```console
   ["backend-host-rewrite.example"]
   "httpbin.org"
   "httpbin.org"
   ["backend-host-rewrite.example"]
   "httpbin.org"
   ["backend-host-rewrite.example"]
   ```
{{< /version >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete httproute httpbin-rewrite -n httpbin
kubectl delete httproute backend-rewrite -n httpbin
kubectl delete {{< reuse "/agw-docs/snippets/backend.md" >}} httpbin -n httpbin
```

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}
If you created the backend-specific host rewrite, delete its HTTPRoute.

```sh
kubectl delete httproute backend-host-rewrite -n httpbin
```
{{< /version >}}



