Use [CEL expressions]({{< link-hextra path="/reference/cel/" >}}) to inject, modify, and remove headers in requests and responses. The example uses `request.headers[]` to extract a header value and combines `set`, `add`, and `remove` operations in a single transformation.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Inject response headers

In this example, you apply all three header operations in a single transformation:

* `set`: Extracts the `x-gateway-request` request header value and sets it as the `x-gateway-response` response header. Also injects a static `x-response-raw` header with the value `hello`. Use `set` to create a header or overwrite it if it already exists.
* `add`: Appends `https://example.com` to the `access-control-allow-origin` header. Because httpbin already returns `access-control-allow-origin: *`, the response ends up with two entries for that header. Use `add` when you want to append a value without overwriting what is already present.
* `remove`: Strips the `access-control-allow-credentials` header from the response before it reaches the client.

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
         response:
           set:
           - name: x-gateway-response
             value: 'request.headers["x-gateway-request"]'
           - name: x-response-raw
             value: '"hello"'
           add:
           - name: access-control-allow-origin
             value: '"https://example.com"'
           remove:
           - access-control-allow-credentials
   EOF
   ```

2. Send a request to the httpbin app and include the `x-gateway-request` request header. Verify that you get back a 200 HTTP response code and that the response includes the injected headers, contains two `access-control-allow-origin` values, and omits `access-control-allow-credentials`.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/response-headers \
    -H "host: www.example.com:80" \
    -H "x-gateway-request: my-custom-value"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/response-headers \
   -H "host: www.example.com" \
   -H "x-gateway-request: my-custom-value"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[3,4,5,6,9,10,15,16,16,16,19,20]}
   ...
   * Request completely sent off
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < x-response-raw: hello
   x-response-raw: hello
   < access-control-allow-origin: *
   access-control-allow-origin: *
   < access-control-allow-origin: https://example.com
   access-control-allow-origin: https://example.com
   < content-type: application/json; encoding=utf-8
   content-type: application/json; encoding=utf-8
   < content-length: 3
   content-length: 3
   < x-gateway-response: my-custom-value
   x-gateway-response: my-custom-value
   
   ```

   Note that `access-control-allow-origin` appears twice: the original `*` from httpbin and the appended `https://example.com` added by the transformation. `access-control-allow-credentials` does not appear because it was removed.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
```
