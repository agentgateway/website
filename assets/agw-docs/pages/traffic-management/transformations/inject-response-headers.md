Use [CEL expressions]({{< link-hextra path="/reference/cel/" >}}) to extract values from request headers and add them to your responses.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Inject request headers into response headers

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with the following transformation rules:
   * `x-gateway-response`: Use the value from the `x-gateway-request` request header and populate it into an `x-gateway-response` response header.
   * `x-podname`: Retrieve the value of the `x-pod-name` request header and add it to the `x-podname` response header.
   * `x-response-raw`: Adds a static string value of `hello` to the `x-response-raw` response header.
   * `x-replace`: Replaces the pattern-to-replace text in the `foo` header with a random number.
   * Use `set` instead of `add` to reset the value entirely.

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
           - name: x-pod-name
             value: 'request.headers["x-pod-name"]'
           - name: x-response-raw
             value: '"hello"'
           - name: x-replace
             value: 'request.headers["x-foo"].replace("pattern-to-replace", string(random()))'
   EOF
   ```

2. Send a request to the httpbin app and include the `x-gateway-request`, `x-response-raw`, `x-pod-name`, and `x-foo` request headers. Verify that you get back a 200 HTTP response code and that the following response headers are included:
   * `x-gateway-response` that is set to the value of the `x-gateway-request` request header.
   * `x-pod-name` that is set to the value of the `x-pod-name` request header.
   * `x-response-raw` that is set to `hello`.
   * `x-replace` that is set to a random number.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/response-headers \
    -H "host: www.example.com:80" \
    -H "x-gateway-request: my custom request header" \
    -H "x-pod-name: my-pod" \
    -H "x-foo: pattern-to-replace"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/response-headers \
   -H "host: www.example.com" \
   -H "x-gateway-request: my custom request header" \
   -H "x-pod-name: my-pod" \
   -H "x-foo: pattern-to-replace"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```console {hl_lines=[3,4,13,14,15,16,17,18,19,20,21]}
   ...
   * Request completely sent off
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
   < x-gateway-response: my custom request header
   x-gateway-response: my custom request header
   < x-pod-name: my-pod
   x-pod-name: my-pod
   < x-response-raw: hello
   x-response-raw: hello
   < x-replace: 0.3102405135686197
   x-replace: 0.3102405135686197
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
```

