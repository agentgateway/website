Learn how to return a customized response body by using [CEL expressions]({{< link-hextra path="/reference/cel/" >}}). The examples use `request.path`, `request.method`, `request.headers[]`, `request.body`, `json()`, and `string()` to construct a dynamic response body string.


{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}


## Inject request header fields into a request body

In this example, you set the response body to a JSON string built from request context variables. The gateway intercepts the upstream response and replaces the body with the CEL expression result before returning it to the client. The upstream never sees the change — only the client receives the modified body. This is useful for tying responses back to request traces.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource that sets the response body to a JSON object containing the request path, method, and `x-request-id` header value.

   ```yaml {paths="inject-header-into-body"}
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
           body: '"{\"path\": \"" + request.path + "\", \"method\": \"" + request.method + "\", \"request-id\": \"" + request.headers["x-request-id"] + "\"}"'
   EOF
   ```

   {{< doc-test paths="inject-header-into-body" >}}
   YAMLTest -f - <<'EOF'
   - name: verify response body contains request path and x-request-id header value
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/get"
       method: GET
       headers:
         host: www.example.com
         x-request-id: alice
     source:
       type: local
     expect:
       statusCode: 200
       bodyJsonPath:
         - path: "$.path"
           comparator: equals
           value: "/get"
         - path: "$.request-id"
           comparator: equals
           value: "alice"
   EOF
   {{< /doc-test >}}

2. Send a request to the httpbin app and include an `x-request-id` request header. Verify that you get back a 200 HTTP response code and that the response body contains the transformed output with the request header value.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/get \
    -H "host: www.example.com:80" \
    -H "x-request-id: alice"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/get \
   -H "host: www.example.com" \
   -H "x-request-id: alice"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[1,2,8]}
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < content-type: application/json
   content-type: application/json
   < content-length: 49
   content-length: 49

   {"path": "/get", "method": "GET", "request-id": "alice"}
   ```

## Inject request body fields into a response body

In this example, you parse a JSON request body using `json()` to extract a field and include it in the response body. Use `request.body` to access the raw incoming request body as a string.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource that reads the `name` field from the JSON request body and echoes it back in the response.

   ```yaml {paths="inject-body-field-into-body"}
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
           body: '"{\"hello\": \"" + string(json(request.body).name) + "\"}"'
   EOF
   ```

   {{< doc-test paths="inject-body-field-into-body" >}}
   YAMLTest -f - <<'EOF'
   - name: verify response body echoes name field from request body
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/post"
       method: POST
       headers:
         host: www.example.com
         content-type: application/json
       body: '{"name": "alice"}'
     source:
       type: local
     expect:
       statusCode: 200
       bodyJsonPath:
         - path: "$.hello"
           comparator: equals
           value: "alice"
   EOF
   {{< /doc-test >}}

2. Send a POST request to the httpbin app with a JSON body. Verify that you get back a 200 HTTP response code and that the response body contains the `name` value from your request.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/post \
    -H "host: www.example.com:80" \
    -H "content-type: application/json" \
    -d '{"name": "alice"}'
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/post \
   -H "host: www.example.com" \
   -H "content-type: application/json" \
   -d '{"name": "alice"}'
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[1,2,8]}
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < content-type: application/json
   content-type: application/json
   < content-length: 17
   content-length: 17

   {"hello": "alice"}
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="inject-header-into-body,inject-body-field-into-body"}
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
```

