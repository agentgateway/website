Rewrite path prefixes in requests by using the `URLRewrite` filter. 

For more information, see the [{{< reuse "agw-docs/snippets/k8s-gateway-api-name.md" >}} documentation](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#httpurlrewritefilter).

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Rewrite prefix path

Use the [HTTPPathModifier](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#httppathmodifiertype) to rewrite path prefixes. 

### In-cluster services

1. Create an HTTPRoute resource for the httpbin app that configures an `URLRewrite` filter to rewrite prefix paths. In this example, all incoming requests that match the `/headers` prefix path on the `rewrite.example` domain are rewritten to the `/anything` prefix path. 
    
   Because the `ReplacePrefixPath` path modifier is used, only the path prefix is replaced during the rewrite. For example, requests to `http://rewrite.example/headers` are rewritten to `https://rewrite.example/anything`. However, for longer paths, such as in `http://rewrite.example/headers/200`, only the prefix is replaced and the path is rewritten to `http://rewrite.example/anything/200`. 
   
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
               value: /headers
         filters:
           - type: URLRewrite
             urlRewrite:
               path:
                 type: ReplacePrefixMatch
                 replacePrefixMatch: /anything
         backendRefs:
           - name: httpbin
             port: 8000
   EOF
   ```

   |Setting|Description|
   |--|--|
   |`spec.parentRefs`| The name and namespace of the Gateway that serves this HTTPRoute. In this example, you use the `agentgateway-proxy` gateway that was created as part of the get started guide. |
   |`spec.rules.filters.type`| The type of filter that you want to apply to incoming requests. In this example, the `URLRewrite` filter is used.|
   |`spec.rules.filters.urlRewrite.path.type`| The type of HTTPPathModifier that you want to use. In this example, `ReplacePrefixMatch` is used, which replaces only the path prefix.  |
   | `spec.rules.filters.urlRewrite.path.replacePrefixMatch` | The path prefix you want to rewrite to. In this example, you replace the prefix path with the `/anything` prefix path. |
   |`spec.rules.backendRefs`|The backend destination you want to forward traffic to. In this example, all traffic is forwarded to the httpbin app that you set up as part of the get started guide. |

2. Send a request to the httpbin app along the `/headers` path on the `rewrite.example` domain. Verify that you get back a 200 HTTP response code and that your request is rewritten to the `/anything` path. 
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
   ```console {hl_lines=[3]}
   ...
   "origin": "10.0.9.36:50660",
   "url": "http://rewrite.example/anything",
   "data": "",
   "files": null,
   "form": null,
   "json": null
   ...
   ```

3. Send another request to the httpbin app. This time, you send it along the `/headers/200` path on the `rewrite.example` domain. Verify that you get back a 200 HTTP response code and that your request path is rewritten to `/anything/200`.  
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/headers/200 -H "host: rewrite.example:80"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/headers/200 -H "host: rewrite.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}
   
   Example output:
   ```console {hl_lines=[3]}
   ...
   "origin": "10.0.9.36:50660",
   "url": "http://rewrite.example/anything/200",
   "data": "",
   "files": null,
   "form": null,
   "json": null
   ...
   ```

### External services

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
   
2. Create an HTTPRoute resource that matches incoming traffic on the `/headers` path for the `external-rewrite.example` domain and forwards traffic to the {{< reuse "/agw-docs/snippets/backend.md" >}} that you created. Because the {{< reuse "/agw-docs/snippets/backend.md" >}} expects a different domain, you use the `URLRewrite` filter to rewrite the hostname from `external-rewrite.example` to `httpbin.org`. In addition, you rewrite the `/headers` path prefix to `/anything`. 
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
        - matches:
          - path:
              type: PathPrefix
              value: /headers
          filters:
          - type: URLRewrite
            urlRewrite:
              hostname: "httpbin.org"
              path: 
                type: ReplacePrefixMatch
                replacePrefixMatch: /anything   
          backendRefs:
          - name: httpbin
            kind: {{< reuse "/agw-docs/snippets/backend.md" >}}
            group: agentgateway.dev
   EOF
   ```

2. Send a request to the `external-rewrite.example` domain on the `/headers` path. Verify that you get back a 200 HTTP response code and that the request was rewritten to `httpbin.org/anything`. 
   
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
   ```console {hl_lines=[2,3,25,34]}
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
     "args": {}, 
     "data": "", 
    "files": {}, 
     "form": {}, 
     "headers": {
       "Accept": "*/*", 
       "Host": "httpbin.org", 
       "User-Agent": "curl/8.7.1", 
       "X-Amzn-Trace-Id": "Root=1-68599cdc-5d3c0d9a1ac2aa482effb24b"
     }, 
     "json": null, 
     "method": "GET", 
     "url": "http://httpbin.org/anything"
   }
   ```


## Rewrite full path

Use the [HTTPPathModifier](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#httppathmodifiertype) to rewrite full paths. 

### In-cluster services

1. Create an HTTPRoute resource for the httpbin app that configures an `URLRewrite` filter to rewrite prefix paths. In this example, all incoming requests that match the `/headers` prefix path on the `rewrite.example` domain are rewritten to `/anything`. 
    
   Because the `ReplaceFullPath` path modifier is used, requests to `http://rewrite.example/headers` and `http://rewrite.example/headers/200` both are rewritten to `https://rewrite.example/anything`.
   
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
               value: /headers
         filters:
           - type: URLRewrite
             urlRewrite:
               path:
                 type: ReplaceFullPath
                 replaceFullPath: /anything
         backendRefs:
           - name: httpbin
             port: 8000
   EOF
   ```

   |Setting|Description|
   |--|--|
   |`spec.parentRefs`| The name and namespace of the Gateway that serves this HTTPRoute. In this example, you use the `agentgateway-proxy` gateway that was created as part of the get started guide. |
   |`spec.rules.filters.type`| The type of filter that you want to apply to incoming requests. In this example, the `URLRewrite` filter is used.|
   |`spec.rules.filters.urlRewrite.path.type`| The type of HTTPPathModifier that you want to use. In this example, `ReplaceFullPath` is used, which replaces the full path prefix.  |
   | `spec.rules.filters.urlRewrite.path.replaceFullPath` | The path prefix you want to rewrite to. In this example, you replace the full prefix path with the `/anything` prefix path. |
   |`spec.rules.backendRefs`|The backend destination you want to forward traffic to. In this example, all traffic is forwarded to the httpbin app that you set up as part of the get started guide. |

3. Send a request to the httpbin app along the `/headers` path on the `rewrite.example` domain. Verify that you get back a 200 HTTP response code and that your request is rewritten to the `/anything` path. 
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
   ```console {hl_lines=[3]}
   ...
   "origin": "10.0.9.36:50660",
   "url": "http://rewrite.example/anything",
   "data": "",
   "files": null,
   "form": null,
   "json": null
   ...
   ```

4. Send another request to the httpbin app. This time, you send it along the `/headers/200` path on the `rewrite.example` domain. Verify that you also get back a 200 HTTP response code and that the full path is rewritten to the `/anything` path.
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/headers/200 -H "host: rewrite.example:80"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/headers/200 -H "host: rewrite.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[3]}
   ...
   "origin": "10.0.9.36:50660",
   "url": "http://rewrite.example/anything",
   "data": "",
   "files": null,
   "form": null,
   "json": null
   ...
   ```

### External services

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
   
2. Create an HTTPRoute resource that matches incoming traffic on the `external-rewrite.example` domain and forwards traffic to the {{< reuse "/agw-docs/snippets/backend.md" >}} that you created. Because the {{< reuse "/agw-docs/snippets/backend.md" >}} expects a different domain, you use the `URLRewrite` filter to rewrite the hostname from `external-rewrite.example` to `httpbin.org`. In addition, you rewrite any existing paths to `/anything`. 
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
              path:
                type: ReplaceFullPath
                replaceFullPath: /anything 
          backendRefs:
          - name: httpbin
            kind: {{< reuse "/agw-docs/snippets/backend.md" >}}
            group: agentgateway.dev
   EOF
   ```

2. Send a request to the `external-rewrite.example` domain on the `/header` path. Verify that you get back a 200 HTTP response code and that the request was rewritten to `httpbin.org/anything`. 
   
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/header -H "host: external-rewrite.example:80"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/header -H "host: external-rewrite.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}
   
   Example output: 
   ```console {hl_lines=[2,3,25,34]}
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
     "args": {}, 
     "data": "", 
    "files": {}, 
     "form": {}, 
     "headers": {
       "Accept": "*/*", 
       "Host": "httpbin.org", 
       "User-Agent": "curl/8.7.1", 
       "X-Amzn-Trace-Id": "Root=1-68599cdc-5d3c0d9a1ac2aa482effb24b"
     }, 
     "json": null, 
     "method": "GET", 
     "url": "http://httpbin.org/anything"
   }
   ```

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}
## Backend-specific path rewrites

To rewrite the path for one backend only, add the `URLRewrite` filter to the `backendRefs` entry of that backend instead of to the rule. When the rule has more than one backend, requests to the other backends keep their original path. For an example that splits traffic between two backends, see [Backend-specific host rewrites]({{< link-hextra path="/documentation/traffic-management/rewrite/host/#backend-specific-host-rewrites" >}}).

1. Create an HTTPRoute that rewrites the `/headers` prefix path to the `/anything` prefix path for the requests that the gateway forwards to the httpbin app on the `backend-path-rewrite.example` domain.
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: backend-path-rewrite
     namespace: httpbin
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     hostnames:
       - backend-path-rewrite.example
     rules:
       - matches:
           - path:
               type: PathPrefix
               value: /headers
         backendRefs:
           - name: httpbin
             port: 8000
             filters:
               - type: URLRewrite
                 urlRewrite:
                   path:
                     type: ReplacePrefixMatch
                     replacePrefixMatch: /anything
   EOF
   ```

   |Setting|Description|
   |--|--|
   |`spec.rules.matches`| The request to match. To use `ReplacePrefixMatch` in a backend filter, the rule must have exactly one match, and that match must be a `PathPrefix` match. Otherwise, the Kubernetes API server rejects the HTTPRoute when you apply it. |
   |`spec.rules.backendRefs.filters.type`| The filter that applies only to the requests that the gateway forwards to this backend. In this example, the `URLRewrite` filter is used. |
   |`spec.rules.backendRefs.filters.urlRewrite.path.type`| The type of HTTPPathModifier that you want to use. In this example, `ReplacePrefixMatch` is used, which replaces only the path prefix. Do not also add a `ReplacePrefixMatch` rewrite to the `filters` of the rule. The backend rewrite runs after the rule rewrite and cannot find the matched prefix in the rewritten path, so the request fails with a 500 HTTP response code. |
   |`spec.rules.backendRefs.filters.urlRewrite.path.replacePrefixMatch`| The path prefix that you want to rewrite to. In this example, you replace the `/headers` prefix with the `/anything` prefix. |

2. Send a request along the `/headers` path on the `backend-path-rewrite.example` domain. Verify that you get back a 200 HTTP response code and that your request is rewritten to the `/anything` path.
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/headers -H "host: backend-path-rewrite.example:80"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/headers -H "host: backend-path-rewrite.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[3]}
   ...
   "origin": "10.244.0.31:44800",
   "url": "http://backend-path-rewrite.example/anything",
   "data": "",
   "files": null,
   "form": null,
   "json": null
   ...
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
If you created the backend-specific path rewrite, delete its HTTPRoute.

```sh
kubectl delete httproute backend-path-rewrite -n httpbin
```
{{< /version >}}
