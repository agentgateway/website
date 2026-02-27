Early request header modification allows you to add, set, or remove HTTP request headers at the listener level, before route selection and other request processing occurs.

This capability is especially useful for security and sanitization use cases, where you want to ensure that sensitive headers cannot be faked by downstream clients and are only set by trusted components such as external authentication services.

Early request header modification is configured on an `{{< reuse "agw-docs/snippets/trafficpolicy.md" >}}` using the `transformation` field. This policy is attached directly to a proxy and applies header mutations before route selection.

The configuration uses the {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} and supports the following operations:

- `add`
- `set`
- `remove`

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Remove a reserved header {#remove}

Remove a header that is reserved for use by another service, such as an external authentication service.

1. Create an HTTPRoute resource that routes requests to the httpbin app through the Gateway that you created before you began.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: httpbin-route
     namespace: httpbin
   spec:
     hostnames:
     - transformation.example
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches: 
       - path:
           type: PathPrefix
           value: /
       backendRefs:
       - name: httpbin
         namespace: httpbin
         port: 8000
       name: http
   EOF
   ```
2. Send a test request to the sample httpbin app with a reserved header, such as `x-user-id`.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}  
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:8080/headers -H "host: transformation.example" -H "x-user-id: reserved-user"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing"%}}
   ```sh
   curl -i localhost:8080/headers -H "host: transformation.example" -H "x-user-id: reserved-user"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output: Note that the `X-User-Id` header is present in the request.

   ```json {linenos=table,hl_lines=[12,13,14],linenostart=1}
   {
     "headers": {
       "Accept": [
         "*/*"
       ],
       "Host": [
         "transformation.example"
       ],
       "User-Agent": [
         "curl/8.7.1"
       ],
       "X-User-Id": [
         "reserved-user"
       ]
     }
   }
   ```

3. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} with a transformation to remove the `x-user-id` header. You can choose to apply the removal on the HTTPRoute or the Gateway. 

   {{< tabs tabTotal="2" items="Route-level,Gateway-level" >}}
   {{% tab tabName="Route-level" %}}

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: remove-reserved-header
     namespace: httpbin
   spec:
     targetRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: httpbin-route
     traffic:
       transformation:
         request:
           remove:
             - x-user-id
   EOF
   ```

   {{% /tab %}}
   {{% tab tabName="Gateway listener" %}}

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: remove-reserved-header
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
       - group: gateway.networking.k8s.io
         kind: Gateway
         name: agentgateway-proxy
         sectionName: http
     traffic:
       phase: PreRouting
       transformation:
         request:
           remove:
             - x-user-id
   EOF
   ```
   {{% /tab %}}
   {{< /tabs >}}

4. Repeat the test request to the sample httpbin app. The `x-user-id` header is no longer present in the response.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}  
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:8080/headers -H "host: transformation.example" -H "x-user-id: reserved-user"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing"%}}
   ```sh
   curl -i localhost:8080/headers -H "host: transformation.example" -H "x-user-id: reserved-user"
   ```
   {{% /tab %}}
   {{< /tabs >}}
   Example output: Note that the `X-User-Id` header is present in the request.

   ```json {linenos=table,hl_lines=[12,13],linenostart=1}
   {
     "headers": {
       "Accept": [
         "*/*"
       ],
       "Host": [
         "transformation.example"
       ],
       "User-Agent": [
         "curl/8.7.1"
       ]
     }
   }
   ```



## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}} Run the following commands.

```sh
kubectl delete httproute httpbin-route -n httpbin
kubectl delete AgentgatewayPolicy remove-reserved-header -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete AgentgatewayPolicy remove-reserved-header -n httpbin
```
