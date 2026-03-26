Use [CEL expressions]({{< link-hextra path="/reference/cel/" >}}) to encode and decode base64 values in request headers and add the results as response headers. The examples use the `base64.encode()`, `base64.decode()`, `bytes()`, and `string()` CEL functions, and the `request.headers[]` context variables.


{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}



## Encode a header value to base64

In this example, you read a plain-text request header and add its base64-encoded value as a response header.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource that reads the `x-user-id` request header and encodes it to base64 before adding it as the `x-user-id-encoded` response header.

   ```yaml {paths="encode"}
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
           - name: x-user-id-encoded
             value: 'base64.encode(bytes(request.headers["x-user-id"]))'
   EOF
   ```

   {{< doc-test paths="encode" >}}
   YAMLTest -f - <<'EOF'
   - name: verify x-user-id-encoded response header contains base64 value
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/response-headers"
       method: GET
       headers:
         host: www.example.com
         x-user-id: alice
     source:
       type: local
     expect:
       statusCode: 200
       headers:
         - name: x-user-id-encoded
           comparator: equals
           value: YWxpY2U=
   EOF
   {{< /doc-test >}}

2. Send a request to the httpbin app and include the `x-user-id` request header. Verify that you get back a 200 HTTP response code and that the `x-user-id-encoded` response header contains the base64-encoded value.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/response-headers \
    -H "host: www.example.com:80" \
    -H "x-user-id: alice"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/response-headers \
   -H "host: www.example.com" \
   -H "x-user-id: alice"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[1,2,11,12]}
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < access-control-allow-credentials: true
   access-control-allow-credentials: true
   < access-control-allow-origin: *
   access-control-allow-origin: *
   < content-type: application/json; encoding=utf-8
   content-type: application/json; encoding=utf-8
   < content-length: 3
   content-length: 3
   < x-user-id-encoded: YWxpY2U=
   x-user-id-encoded: YWxpY2U=
   ```

   You can verify the encoded value by decoding it locally:
   ```sh
   echo "YWxpY2U=" | base64 --decode
   ```

   Example output:
   ```
   alice
   ```

## Decode a base64 header value

In this example, you take the encoded value from the encode example (`YWxpY2U=`) and decode it back to its original plain-text value.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource that reads the `x-user-id-encoded` request header, decodes it from base64, and adds the result as the `x-user-id-decoded` response header.

   ```yaml {paths="decode"}
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
           - name: x-user-id-decoded
             value: 'string(base64.decode(request.headers["x-user-id-encoded"]))'
   EOF
   ```

   {{< doc-test paths="decode" >}}
   YAMLTest -f - <<'EOF'
   - name: verify x-user-id-decoded response header contains plain-text value
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/response-headers"
       method: GET
       headers:
         host: www.example.com
         x-user-id-encoded: YWxpY2U=
     source:
       type: local
     expect:
       statusCode: 200
       headers:
         - name: x-user-id-decoded
           comparator: equals
           value: alice
   EOF
   {{< /doc-test >}}

2. Send a request to the httpbin app and include the base64-encoded value from the encode example in the `x-user-id-encoded` request header. Verify that you get back a 200 HTTP response code and that the `x-user-id-decoded` response header contains the original plain-text value.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/response-headers \
    -H "host: www.example.com:80" \
    -H "x-user-id-encoded: YWxpY2U="
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/response-headers \
   -H "host: www.example.com" \
   -H "x-user-id-encoded: YWxpY2U="
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[1,2,11,12]}
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < access-control-allow-credentials: true
   access-control-allow-credentials: true
   < access-control-allow-origin: *
   access-control-allow-origin: *
   < content-type: application/json; encoding=utf-8
   content-type: application/json; encoding=utf-8
   < content-length: 3
   content-length: 3
   < x-user-id-decoded: alice
   x-user-id-decoded: alice
   ```
   
## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="encode,decode"}
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
```

