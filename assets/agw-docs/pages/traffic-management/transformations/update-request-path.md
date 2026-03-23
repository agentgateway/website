Change the request path and HTTP method when a request header is present. To update the path and HTTP method the `:path` and `:method` pseudo headers are used.

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

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with the following transformation rules:
   * If the request contains the `foo:bar` header, the request path is rewritten to the `/post` path. In addition, the HTTP method is changed to the `POST` method.
   * If the request does not contain the `foo:bar` header, the request path and method do not change.

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
     backend:
       transformation:
         request:
           set:
           - name: ":path"
             value: 'request.headers["foo"] == "bar" ? "/post" : request.path'
           - name: ":method"
             value: 'request.headers["foo"] == "bar" ? "POST" : request.method'
   EOF
   ```

2. Send a request to the `/get` endpoint of the httpbin app. Include the `foo: bar` request header to trigger the request transformation. Verify that you get back a 200 HTTP response code and that your request path is rewritten to the `/post` endpoint. The `/post` endpoint accepts requests only if the HTTP `POST` method is used. The 200 HTTP response code therefore also indicates that the HTTP method was successfully changed from `GET` to `POST`.

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
   ```console {hl_lines=[1,2,24]}
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

3. Send another request to the `/get` endpoint of the httpbin app. This time, you omit the `foo: bar` header. Verify that you get back a 200 HTTP response code and that the request path is not rewritten to the `/post` endpoint.

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

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
```

