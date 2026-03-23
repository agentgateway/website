Combine multiple transformation operations in a single policy to set, add, and remove headers in one request or response.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Combine set, add, and remove

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource that applies all three operations to the request in a single transformation:
   * `set`: Overwrites the `x-environment` header with a static value.
   * `add`: Appends a `x-request-id` header with a generated UUID.
   * `remove`: Strips the `x-internal-token` header before the request reaches the upstream.

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
           - name: x-environment
             value: '"production"'
           add:
           - name: x-request-id
             value: uuid()
           remove:
           - x-internal-token
   EOF
   ```

2. Send a request to the httpbin app. Include both `x-environment` and `x-internal-token` request headers to trigger all three operations. Verify that you get back a 200 HTTP response code and that:
   * `x-environment` is overwritten to `production`.
   * `x-request-id` is added with a UUID value.
   * `x-internal-token` is absent from the echoed headers.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/get \
    -H "host: www.example.com:80" \
    -H "x-environment: staging" \
    -H "x-internal-token: my-secret-token"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/get \
   -H "host: www.example.com" \
   -H "x-environment: staging" \
   -H "x-internal-token: my-secret-token"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[1,2,17,18,19,20,21,22]}
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
       "X-Environment": [
         "production"
       ],
       "X-Request-Id": [
         "3f0a1b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c"
       ]
     },
     "origin": "10.244.0.6:12345",
     "url": "http://www.example.com/get"
   }
   ```

   Note that `x-environment` is set to `production` (overwriting `staging`), `x-request-id` is added with a UUID, and `x-internal-token` is absent.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
```
