Use the `directResponse` API to directly respond to incoming requests without forwarding them to services. Instead, you return a pre-defined body and HTTP status code to the client.

## About direct responses

When you configure a direct response, the gateway proxy intercepts requests to specific routes and directly sends back a predefined response. Common use cases include: 

* **Static responses**: You might have endpoints for which sending back static responses is sufficient.
* **Health checks**: You might configure health checks for the gateway. 
* **Redirects**: You might redirect users to new locations, such as when an endpoint is now available at a different address. 
* **Test responses**: You can simulate responses from backend services without forwarding the request to the actual service. 

### Limitation

You cannot configure multiple direct response resources on the same route. If you configure multiple direct responses, only the oldest is applied.  


### Schema validation
The following rule is applied during schema validation: 
* The `status` field can define a valid HTTP status code in the 200-599 range. 


{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Set up direct responses 

1. Create an HTTPRoute resource that routes traffic with the `/` path.
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: health-check
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: agentgateway-system
     rules:
       - matches:
           - path:
               type: PathPrefix
               value: /
   EOF
   ```

2. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with a `directResponse`. Traffic along the `/` path is not forwarded. Instead, a custom message is returned with the successful response.
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: health-response
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: direct-response
     traffic:
       directResponse:
         status: 200
         body: "Status: Healthy"
   EOF
   ```

   
3. Send a request along the `/status/404` path. Verify that your request succeeds, that you get back a 200 HTTP response code, and the custom message is included instead of returning a `404` error.  
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/status/404
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/status/404
   ```
   {{% /tab %}}
   {{< /tabs >}}
   
   Example output: 
   ```
   ...
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < content-length: 15
   content-length: 15
   < 

   * Connection #0 to host localhost left intact
   Status: Healthy% 
   ```
   
## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}} Run the following commands.

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} health-response -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete httproute health-check -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

