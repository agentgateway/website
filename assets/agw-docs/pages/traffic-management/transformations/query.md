Change the request path and HTTP method when a request header is present by using [CEL expressions]({{< link-hextra path="/reference/cel/" >}}). The example uses `request.headers[]`, `request.path`, and `request.method` with a ternary expression to conditionally set the `:path` and `:method` pseudo headers.

## About pseudo headers

Pseudo headers are special headers that are used in HTTP/2 to provide metadata about the request or response in a structured way. Although they look like traditional HTTP/1.x headers, they come with specific characteristics:

* Must always start with a colon (`:`).
* Must appear before regular headers in the HTTP/2 frame.
* Contain details about the request or response.

Common pseudo headers include:
* `:method`: The HTTP method that is used, such as GET or POST.
* `:scheme`: The protocol that is used, such as `http` or `https`.
* `:authority`: The hostname and port number that the request is sent to.
* `:path`: The path of the request.


{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Update request paths and HTTP methods

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with your transformation rules. The policy rewrites the path to `/post` and the method to `POST` when the `foo: bar` request header is present. When the header is absent, the path and method are unchanged.

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
           - name: ":path"
             value: 'request.headers["foo"] == "bar" ? "/post" : request.path'
           - name: ":method"
             value: 'request.headers["foo"] == "bar" ? "POST" : request.method'
   EOF
   ```

   {{< doc-test paths="query" >}}
   YAMLTest -f - <<'EOF'
   - name: verify path and method are rewritten when foo=bar header is present
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/get"
       method: GET
       headers:
         host: www.example.com
         foo: bar
     source:
       type: local
     expect:
       statusCode: 200
       bodyJsonPath:
         - path: "$.url"
           comparator: contains
           value: "/post"
   EOF
   {{< /doc-test >}}

2. Send a request to the `/get` endpoint and include the `foo: bar` header to trigger the transformation. Verify that you get back a 200 HTTP response code. The httpbin `/post` endpoint only accepts `POST` requests, so a 200 response confirms both the path rewrite and the method change succeeded.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/get \
    -H "foo: bar" \
    -H "host: www.example.com:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/get \
   -H "foo: bar" \
   -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[1,2,13,14,24]}
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   ...
   {
     "args": {},
     "headers": {
        "Accept": [
          "*/*"
        ],
        "Content-Length": [
        "0"
        ],
        "Foo": [
        "bar"
        ],
        "Host": [
        "www.example.com:8080"
        ],
        "User-Agent": [
        "curl/7.77.0"
        ]
    },
    "origin": "127.0.0.6:48539",
    "url": "http://www.example.com:8080/post",
    "data": "",
    "files": null,
    "form": null,
    "json": null
   }
   ```

3. Send another request to the `/get` endpoint. This time, omit the `foo: bar` header. Verify that you get back a 200 HTTP response code and that the request path is not rewritten.

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
   ```console {hl_lines=[1,2,19]}
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
        "www.example.com:8080"
        ],
        "User-Agent": [
        "curl/7.77.0"
        ]
    },
    "origin": "127.0.0.6:46209",
    "url": "http://www.example.com:8080/get"
   }
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="query"}
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
```

