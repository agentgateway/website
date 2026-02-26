Early request header modification allows you to add, set, or remove HTTP request headers at the listener level, before route selection and other request processing occurs.

This capability is especially useful for security and sanitization use cases, where you want to ensure that sensitive headers cannot be faked by downstream clients and are only set by trusted components such as external authentication services.

Early request header modification is configured on a `ListenerPolicy` using the `earlyRequestHeaderModifier` field. This policy is attached directly to a proxy and applies header mutations before route selection.

The configuration uses the standard Gateway API `HTTPHeaderFilter` format and supports the following operations:

- `add`
- `set`
- `remove`

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Remove a reserved header {#remove}

Remove a header that is reserved for use by another service, such as an external authentication service.

1. Create an HTTPRoute.

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
       namespace: agentgateway-system
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
         "www.example.com"
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

3. Create a transformation to remove the `x-user-id` header. You can choose to apply the removal on an  HTTPRoute with an AgentgatewayPolicy or Gateway listener. 

   {{< tabs tabTotal="2" items="HTTPRoute and rule (AgentgatewayPolicy),Gateway listener" >}}
   {{% tab tabName="HTTPRoute (EnterpriseAgentgatewayPolicy)" %}}

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: AgentgatewayPolicy
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
   apiVersion: agentgateway.dev/v1alpha1
   kind: AgentgatewayPolicy
   metadata:
     name: remove-reserved-header
     namespace: agentgateway-system
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

   ```json {linenos=table,hl_lines=[12,13,14],linenostart=1}
   {
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
     }
   }
   ```



## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete httproute httpbin-route -n httpbin
kubectl delete AgentgatewayPolicy remove-reserved-header -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete AgentgatewayPolicy remove-reserved-header -n httpbin
```
