When building or debugging transformations, you can log CEL variables to inspect what values are available at runtime. Configure an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with `spec.frontend.accessLog` to add custom attributes to the structured access log using CEL expressions.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Log CEL variables

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource that targets your Gateway and adds CEL variables as log attributes. Choose one of the following options:

   * **Log specific variables**: Map individual attribute names to CEL expressions. The attribute names on the left (`request_path`, `request_method`, `client_ip`) are arbitrary and become the keys in the structured log output.

     ```yaml
     kubectl apply -f- <<EOF
     apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
     kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
     metadata:
       name: access-logs
       namespace: agentgateway-system
     spec:
       targetRefs:
       - group: gateway.networking.k8s.io
         kind: Gateway
         name: agentgateway-proxy
       frontend:
         accessLog:
           attributes:
             add:
             - name: request_path
               expression: request.path
             - name: request_method
               expression: request.method
             - name: client_ip
               expression: source.address
     EOF
     ```

   * **Log only specific requests**: Add a `filter` CEL expression to log only requests that match a condition, such as error responses.

     ```yaml
     kubectl apply -f- <<EOF
     apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
     kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
     metadata:
       name: access-logs
       namespace: agentgateway-system
     spec:
       targetRefs:
       - group: gateway.networking.k8s.io
         kind: Gateway
         name: agentgateway-proxy
       frontend:
         accessLog:
           filter: response.code >= 400
           attributes:
             add:
             - name: request_path
               expression: request.path
             - name: status_code
               expression: string(response.code)
     EOF
     ```

2. Send a request through the gateway.

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

3. Check the agentgateway logs to verify that the CEL variables are being logged.

   ```sh
   kubectl logs -n agentgateway-system -l app.kubernetes.io/name=agentgateway-proxy
   ```

   Example output:

   ```json
   {
     "request_path": "/get",
     "request_method": "GET",
     "client_ip": "10.244.0.6"
   }
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} access-logs -n agentgateway-system
```
