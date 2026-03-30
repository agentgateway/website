Use [CEL expressions]({{< link-hextra path="/reference/cel/" >}}) to inject, modify, and remove response headers. The example uses the `request.headers[]` context variable to extract a request header value and injects the value into a response header. You also explore how to combine  `set`, `add`, and `remove` operations in a single transformation.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Inject response headers

The gateway intercepts the upstream response and modifies its headers before returning them to the client. You can combine `set`, `add`, and `remove` operations in a single policy so that the gateway applies all three operations in one pass. This configuration is useful when you need to enrich responses with values from the original request or strip internal headers that should not reach the client.

In this example, all three operations are applied together:

* `x-gateway-response` (`set`): Reads the value of the `x-gateway-request` request header and sets it as a response header.
* `x-response-raw` (`set`): Set to the static value `hello`.
* `access-control-allow-origin` (`add`): Appends `https://example.com`. Because httpbin already returns `access-control-allow-origin: *`, the response ends up with two entries for that header.
* `access-control-allow-credentials` (`remove`): Strips the header from the response before it reaches the client.


1. Send a request to the httpbin app. The `access-control-allow-origin` header exists before setting the {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/response-headers \
    -H "host: www.example.com:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/response-headers \
   -H "host: www.example.com" 
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[3,4,5,6]}
   ...
   * Request completely sent off
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < access-control-allow-origin: *
   access-control-allow-origin: *
   < content-type: application/json; encoding=utf-8
   content-type: application/json; encoding=utf-8
   < content-length: 3
   content-length: 3
   ```

2. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with your transformation rules.

   ```yaml {paths="inject-response-headers"}
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

   {{< doc-test paths="inject-response-headers" >}}
   YAMLTest -f - <<'EOF'
   - name: verify injected response headers are present and removed header is absent
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/response-headers"
       method: GET
       headers:
         host: www.example.com
         x-gateway-request: my-custom-value
     source:
       type: local
     expect:
       statusCode: 200
       headers:
         - name: x-gateway-response
           comparator: equals
           value: my-custom-value
         - name: x-response-raw
           comparator: equals
           value: hello
   EOF
   {{< /doc-test >}}

3. Send a request to the httpbin app and include the `x-gateway-request` request header. Verify the following:
   * You get back a 200 HTTP response code.
   * The response includes the injected headers.
   * The response contains two `access-control-allow-origin` values.
   * The response omits `access-control-allow-credentials`.

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

   `access-control-allow-origin` appears twice: the original `*` from httpbin and the appended `https://example.com` added by the transformation. `access-control-allow-credentials` is absent because it was removed.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="inject-response-headers"}
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
```
