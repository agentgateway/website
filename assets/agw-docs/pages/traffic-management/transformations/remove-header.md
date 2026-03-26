Remove headers from requests before they reach the upstream. Use this when a client sends headers that the backend service should not receive, such as internal routing hints, authentication tokens, or debugging headers added by a proxy.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Remove request headers

In this example, you remove the `x-debug-trace` request header before the request is forwarded to the upstream.

1. Send a request to the httpbin app and include the `x-debug-trace` request header. Verify that httpbin echoes it back in the response body.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -s http://$INGRESS_GW_ADDRESS:80/get \
    -H "host: www.example.com:80" \
    -H "x-debug-trace: true"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -s localhost:8080/get \
   -H "host: www.example.com" \
   -H "x-debug-trace: true"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[13,14,15]}
   {
     "args": {},
     "headers": {
       "Accept": [
         "*/*"
       ],
       "Host": [
         "www.example.com"
       ],
       "User-Agent": [
         "curl/8.7.1"
       ],
       "X-Debug-Trace": [
         "true"
       ]
     },
     "origin": "10.244.0.6:12345",
     "url": "http://www.example.com/get"
   }
   ```

   The `x-debug-trace` header is present in the echoed headers. 

2. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with your transformation rules.

   ```yaml {paths="remove-header"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: transformation
     namespace: httpbin
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: httpbin
     traffic:
       transformation:
         request:
           remove:
           - x-debug-trace
   EOF
   ```

   {{< doc-test paths="remove-header" >}}
   YAMLTest -f - <<'EOF'
   - name: verify x-debug-trace header is stripped from request
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/get"
       method: GET
       headers:
         host: www.example.com
         x-debug-trace: true
     source:
       type: local
     expect:
       statusCode: 200
   EOF
   {{< /doc-test >}}

3. Send another request with the `x-debug-trace` request header. Verify that you get back a 200 HTTP response code and that the `x-debug-trace` header is no longer present in the headers echoed back by httpbin.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/get \
    -H "host: www.example.com:80" \
    -H "x-debug-trace: true"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/get \
   -H "host: www.example.com" \
   -H "x-debug-trace: true"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[1,2]}
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   ...

   {
     "args": {},
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
     },
     "origin": "10.244.0.6:12345",
     "url": "http://www.example.com/get"
   }
   ```

   The `x-debug-trace` header is absent from the echoed headers, confirming it was stripped before the request reached the upstream.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="remove-header"}
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
```
