Learn how to return a customized response body using [CEL expressions](/reference/cel/).

In this guide, you set a custom response body by evaluating a CEL expression against the request context. You can use request context variables such as `request.path`, `request.method`, and `request.headers["name"]` to construct a dynamic response body string.


{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Inject response bodies

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with your transformation rules. In the following example, you set the response body to a JSON object that includes the request path, method, and the value of the `x-request-id` request header. This example is useful for tying responses back to request traces.

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
           body: '"{\"path\": \"" + request.path + "\", \"method\": \"" + request.method + "\", \"request-id\": \"" + request.headers["x-request-id"] + "\"}"'
   EOF
   ```

2. Send a request to the httpbin app and include an `x-request-id` request header. Verify that you get back a 200 HTTP response code and that the response body contains the transformed output with the request header value.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/get \
    -H "host: www.example.com:80" \
    -H "x-request-id: abc-123"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/get \
   -H "host: www.example.com" \
   -H "x-request-id: abc-123"
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

   {"path": "/get", "method": "GET", "request-id": "abc-123"}
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
```

