Update the response status based on request query parameters by using [CEL expressions]({{< link-hextra path="/reference/cel/" >}}). The example uses `request.uri` and the `contains()` function with a conditional expression to set the `:status` pseudo header.


{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Change the response status on a route

In this example, the transformation applies after routing and targets a specific HTTPRoute. You change the value of the `:status` response header to 401 if the request URI contains the `foo=bar` query parameter. If the request URI does not contain `foo=bar`, you return a 403 HTTP response code.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with your transformation rules.

   ```yaml {paths="change-response-status"}
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
           - name: ":status"
             value: 'request.uri.contains("foo=bar") ? 401 : 403'
   EOF
   ```

   {{< doc-test paths="change-response-status" >}}
   YAMLTest -f - <<'EOF'
   - name: verify response status is 401 when foo=bar query parameter is present
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/response-headers?foo=bar"
       method: GET
       headers:
         host: www.example.com
     source:
       type: local
     expect:
       statusCode: 401
   - name: verify response status is 403 when foo=bar query parameter is absent
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/response-headers?foo=baz"
       method: GET
       headers:
         host: www.example.com
     source:
       type: local
     expect:
       statusCode: 403
   EOF
   {{< /doc-test >}}

2. Send a request to the httpbin app and include the `foo=bar` query parameter. Verify that you get back a 401 HTTP response code.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/response-headers?foo=bar \
    -H "host: www.example.com:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi "localhost:8080/response-headers?foo=bar" \
   -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[1,2]}
   < HTTP/1.1 401 Unauthorized
   HTTP/1.1 401 Unauthorized
   < access-control-allow-credentials: true
   access-control-allow-credentials: true
   < access-control-allow-origin: *
   access-control-allow-origin: *
   < content-type: application/json; encoding=utf-8
   content-type: application/json; encoding=utf-8
   < foo: bar
   foo: bar
   < content-length: 29
   content-length: 29

   {
     "foo": [
       "bar"
     ]
   }
   ```

3. Send another request to the httpbin app. This time, include the `foo=baz` query parameter. Verify that you get back a 403 HTTP response code.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/response-headers?foo=baz \
    -H "host: www.example.com:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi "localhost:8080/response-headers?foo=baz" \
   -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[1,2]}
   < HTTP/1.1 403 Forbidden
   HTTP/1.1 403 Forbidden
   < access-control-allow-credentials: true
   access-control-allow-credentials: true
   < access-control-allow-origin: *
   access-control-allow-origin: *
   < content-type: application/json; encoding=utf-8
   content-type: application/json; encoding=utf-8
   < foo: baz
   foo: baz
   < content-length: 29
   content-length: 29

   {
     "foo": [
       "baz"
     ]
   }
   ```


## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="change-response-status"}
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
```

