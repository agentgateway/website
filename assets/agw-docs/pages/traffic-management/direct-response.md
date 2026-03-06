Use the `directResponse` API to directly respond to incoming requests without forwarding them to services. Instead, you return a pre-defined body and HTTP status code to the client.

## About direct responses

When you configure a direct response, the gateway proxy intercepts requests to specific routes and directly sends back a predefined response. Common use cases include: 

* **Static responses**: You might have endpoints for which sending back static responses is sufficient.
* **Health checks**: You might configure health checks for the gateway. 
* **Redirects**: You might redirect users to new locations, such as when an endpoint is now available at a different address. 
* **Test responses**: You can simulate responses from backend services without forwarding the request to the actual service. 

### Limitations

Consider the following limitations before creating direct response resources in your cluster: 
* You cannot configure multiple direct response resources on the same route.
* You cannot combine a direct response with other route actions on the same route.<!--For example, you cannot configure a direct response and a `RequestRedirect` filter or `backendRefs` rule at the same time.--> If multiple route actions are defined, the route is replaced with a 500 HTTP response code and an error message is shown on the HTTPRoute. 
<!--* DirectResponse resources can be referenced by using an `ExtensionRef` filter only. If specified in a `backendRef` filter, the DirectResponse configuration is ignored. 
* No status information is currently populated to the DirectResponse resource.
* The DirectResponse CRD currently does not show a description when you run `kubectl explain directresponse`. -->

### Schema validation
The following rules are applied during schema validation: 
* The `body` field can have a size of up to 4KB. 
* The `status` field can define a valid HTTP status code in the 200-599 range. 


{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Set up direct responses 

1. Create an HTTPRoute resource that routes traffic with the `/health` path.
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
               value: /health
   EOF
   ```

2. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with a `directResponse`. Traffic along the `/health` path is not forwarded. Instead, a custom message is returned with the successful response.
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
         name: health-check
     traffic:
       directResponse:
         status: 200
         body: "Status: Healthy"
   EOF
   ```

   
3. Send a request along the `/health` path. Verify that your request succeeds, that you get back a 200 HTTP response code, and the custom message is included.  
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/health
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/health
   ```
   {{% /tab %}}
   {{< /tabs >}}
   
   Example output: 
   ```
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < content-length: 15
   content-length: 15
   < 

   * Connection #0 to host localhost left intact
   Status: Healthy% 
   ```
   
## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} health-response -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete httproute health-check -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

