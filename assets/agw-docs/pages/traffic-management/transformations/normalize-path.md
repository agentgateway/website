Use the `with()` and `regexReplace()` [CEL functions]({{< link-hextra path="/reference/cel/#functions-policy-all" >}}) together to normalize a request path and forward it as a request header.

`with()` binds a complex expression to a temporary variable to avoid evaluating it multiple times. `regexReplace()` replaces text matching a regular expression with a replacement string. Together, they are useful for sanitizing dynamic values. For example, replacing numeric IDs in a path with a placeholder before forwarding the path upstream.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Normalize a request path

In this example, you bind `request.path` to a temporary variable using `with()`, then use `regexReplace()` to replace any numeric path segments with `{id}`. The normalized path is added to the `x-normalized-path` request header before forwarding to the upstream.

For example, a request to `/users/12345/orders/67890` produces `x-normalized-path: /users/{id}/orders/{id}`.

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
           - name: x-normalized-path
             value: 'request.path.with(p, p.regexReplace("/[0-9]+", "/{id}"))'
   EOF
   ```

2. Send a request to the httpbin app using a path with numeric IDs. Verify that you get back a 200 HTTP response code and that the `x-normalized-path` header in the echoed request contains the normalized path.

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
       "X-Normalized-Path": [
         "/anything/users/{id}/orders/{id}"
       ]
     },
     "origin": "10.244.0.6:12345",
     "url": "http://www.example.com/anything/users/12345/orders/67890"
   }
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
```
