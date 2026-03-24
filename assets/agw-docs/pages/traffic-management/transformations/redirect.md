Use [CEL expressions]({{< link-hextra path="/reference/cel/" >}}) to construct a full request URL from context variables and forward it upstream as a request header. The example uses `request.scheme`, `request.host`, and `request.path`.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Forward the request URL upstream

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with the following transformation rules:
   * Build a URL by concatenating the scheme, hostname, and path from the request context.
   * `request.scheme` contains the scheme of the request, such as `http` or `https`.
   * `request.host` contains the hostname of the request.
   * `request.path` contains the path of the request.
   * The constructed URL is added to the `x-forwarded-uri` request header before forwarding to the upstream.

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
         request:
           set:
           - name: x-forwarded-uri
             value: 'request.scheme + "://" + request.host + request.path'
   EOF
   ```

2. Send a request to the httpbin app. Verify that you get back a 200 HTTP response code and that you see the constructed URL in the `x-forwarded-uri` request header echoed back by httpbin.

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
         "www.example.com"
       ],
       "User-Agent": [
         "curl/8.7.1"
       ],
       "X-Forwarded-Uri": [
         "http://www.example.com:80/get"
       ]
     },
     "origin": "10.244.0.6:59296",
     "url": "http://www.example.com/get"
   }
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
```

