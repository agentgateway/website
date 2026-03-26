Promote a query parameter to a request header by using [CEL expressions]({{< link-hextra path="/reference/cel/" >}}). The example uses `request.uri` with the `contains()` function and a conditional expression to read a query parameter value and inject it as a request header before the request reaches the upstream.

This configuration is useful when a client passes information as a query parameter but the backend service expects it as a header.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Promote a query parameter to a request header

In this example, a client passes a feature flag as the `beta` query parameter. The backend service expects this as the `x-beta-features` request header. The transformation reads `request.uri` and sets the header to `enabled` when `beta=true` is present, and `disabled` when it is absent.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with your transformation rules.

   ```yaml {paths="query"}
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
           set:
           - name: x-beta-features
             value: 'request.uri.contains("beta=true") ? "enabled" : "disabled"'
   EOF
   ```

   {{< doc-test paths="query" >}}
   YAMLTest -f - <<'EOF'
   - name: verify x-beta-features header is set to enabled when beta=true is present
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/get?beta=true"
       method: GET
       headers:
         host: www.example.com
     source:
       type: local
     expect:
       statusCode: 200
       bodyJsonPath:
         - path: "$.headers[\"X-Beta-Features\"][0]"
           comparator: equals
           value: enabled
   - name: verify x-beta-features header is set to disabled when beta=true is absent
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/get"
       method: GET
       headers:
         host: www.example.com
     source:
       type: local
     expect:
       statusCode: 200
       bodyJsonPath:
         - path: "$.headers[\"X-Beta-Features\"][0]"
           comparator: equals
           value: disabled
   EOF
   {{< /doc-test >}}

2. Send a request with the `beta=true` query parameter. Verify that you get back a 200 HTTP response code and that the `x-beta-features` header is set to `enabled` in the headers echoed back by httpbin.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi "http://$INGRESS_GW_ADDRESS:80/get?beta=true" \
    -H "host: www.example.com:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi "localhost:8080/get?beta=true" \
   -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[1,2,21,22,23]}
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   ...

   {
     "args": {
       "beta": [
         "true"
       ]
     },
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
       "X-Beta-Features": [
         "enabled"
       ]
     },
     "origin": "10.244.0.6:12345",
     "url": "http://www.example.com/get?beta=true"
   }
   ```

3. Send a request without the `beta=true` query parameter. Verify that the `x-beta-features` header is set to `disabled`.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/get \
    -H "host: www.example.com:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/get \
   -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[1,2,17,18,19]}
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
       ],
       "X-Beta-Features": [
         "disabled"
       ]
     },
     "origin": "10.244.0.6:12345",
     "url": "http://www.example.com/get"
   }
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="query"}
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
```
