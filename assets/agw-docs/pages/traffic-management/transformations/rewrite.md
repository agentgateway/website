Use the `with()` and `regexReplace()` [CEL functions]({{< link-hextra path="/reference/cel/#functions-policy-all" >}}) together with `request.path` to rewrite dynamic path segments before forwarding the request to the upstream.

`with()` binds a complex expression to a temporary variable to avoid evaluating it multiple times. `regexReplace()` replaces text matching a regular expression with a replacement string. Together, they are useful for sanitizing dynamic values such as replacing numeric IDs in a path with a placeholder before the request reaches the upstream service.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Rewrite dynamic path segments

In this example, you bind `request.path` to a temporary variable using `with()`, then use `regexReplace()` to replace any numeric path segments with `{id}`. Setting the result on the `:path` pseudo header rewrites the actual request path forwarded to the upstream.

For example, a request to `/users/12345/orders/67890` is forwarded upstream as `/users/{id}/orders/{id}`.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with your transformation rules.

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
           - name: :path
             value: 'request.path.with(p, p.regexReplace("/[0-9]+", "/{id}"))'
   EOF
   ```

2. Send a request to the httpbin app using a path with numeric IDs. Verify that you get back a 200 HTTP response code and that the `url` field in the response body shows the normalized path that was forwarded to the upstream.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/anything/users/12345/orders/67890 \
    -H "host: www.example.com:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/anything/users/12345/orders/67890 \
   -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[1,2,14]}
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
       ]
     },
     "origin": "10.244.0.6:12345",
     "url": "http://www.example.com/anything/users/{id}/orders/{id}"
   }
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
```
