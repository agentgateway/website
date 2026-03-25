Remove sensitive or internal headers from requests before they reach the upstream. The example uses the `remove` operation.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Remove request headers

In this example, you remove the `x-internal-token` request header before the request is forwarded to the upstream. This configuration prevents internal credentials from being exposed to the backend service.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with your transformation rules.

   ```yaml
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
           - x-internal-token
   EOF
   ```

2. Send a request to the httpbin app and include the `x-internal-token` request header. Verify that you get back a 200 HTTP response code and that the `x-internal-token` header is not present in the headers echoed back by httpbin.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/get \
    -H "host: www.example.com:80" \
    -H "x-internal-token: my-secret-token"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/get \
   -H "host: www.example.com" \
   -H "x-internal-token: my-secret-token"
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

   The `x-internal-token` header is absent from the echoed headers, confirming it was stripped before the request reached the upstream.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
```
