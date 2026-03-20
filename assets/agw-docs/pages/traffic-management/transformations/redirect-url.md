Extract the values of common request headers to generate a redirect URL using CEL expressions.

## About pseudo headers

Pseudo headers are special headers that are used in HTTP/2 to provide metadata about the request or response in a structured way. Although they look like traditional HTTP/1.x headers, they come with specific characteristics:

* Must always start with a colon (`:`).
* Must appear before regular headers in the HTTP/2 frame.
* Contain details about the request or response.

Common pseudo headers include:
* `:method`: The HTTP method that is used, such as GET or POST.
* `:scheme`: The protocol that is used, such as http or https.
* `:authority`: The hostname and port number that the request is sent to.
* `:path`: The path of the request.


{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Set up redirect URLs

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with the following transformation rules:
   * Build a redirect URL by concatenating the scheme, hostname, and path from the request context.
   * `request.headers["host"]` contains the hostname from the request.
   * `request.path` is set to the request path.
   * The redirect URL is added to the `x-forwarded-uri` request header before forwarding to the upstream.

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
     transformation:
       request:
         add:
         - name: x-forwarded-uri
           value: '"https://" + request.headers["host"] + request.path'
   EOF
   ```

2. Send a request to the httpbin app. Verify that you get back a 200 HTTP response code and that you see the redirect URL in the `x-forwarded-uri` request header echoed back by httpbin.

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
   ```console {hl_lines=[2,3,18,19]}
   ...
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
         "curl/8.7.1"
       ],
       "X-Forwarded-Uri": [
         "https://www.example.com/get"
       ]
     },
     "origin": "10.0.9.76",
     "url": "http://www.example.com:8080/get"
   }
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
```

