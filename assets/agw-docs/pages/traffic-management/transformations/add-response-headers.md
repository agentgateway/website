Use [CEL expressions]({{< link-hextra path="/reference/cel/" >}}) to encode and decode base64 values in request headers and add the results as response headers.


{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Decode base64 headers

1. Encode a string to base64.
   ```sh
   echo -n "transformation test" | base64
   ```

   Example output:
   ```
   dHJhbnNmb3JtYXRpb24gdGVzdA==
   ```

2. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with your transformation rules. Make sure to create the {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} in the same namespace as the HTTPRoute resource. In the following example, you decode the base64-encoded value from the `x-base64-encoded` request header and populate the decoded value into an `x-base64-decoded` header starting from the 11th character. Use `add` instead of `set` when you want to append a multi-value header rather than reset it entirely.

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
           add:
           - name: x-base64-decoded
             value: 'string(base64.decode(request.headers["x-base64-encoded"])).substring(11)'
   EOF
   ```

3. Send a request to the httpbin app and include your base64-encoded string in the `x-base64-encoded` request header. Verify that you get back a 200 HTTP response code and that you see the trimmed decoded value of your base64-encoded string in the `x-base64-decoded` response header.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/response-headers \
    -H "host: www.example.com:80" \
    -H "x-base64-encoded: dHJhbnNmb3JtYXRpb24gdGVzdA=="
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/response-headers \
   -H "host: www.example.com" \
   -H "x-base64-encoded: dHJhbnNmb3JtYXRpb24gdGVzdA=="
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[2,3,12,13]}
   * Mark bundle as not supporting multiuse
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
   < x-base64-decoded: ion test
   x-base64-decoded: ion test
   ```

## Encode a header value to base64

In this example, you read a plain-text request header and add its base64-encoded value as a response header.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource that reads the `x-user-id` request header and encodes it to base64 before adding it as the `x-user-id-encoded` response header.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: transformation-encode
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
   ```console {hl_lines=[12,13]}
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

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation-encode -n httpbin
```

