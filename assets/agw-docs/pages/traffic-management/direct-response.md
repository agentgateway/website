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
   ```yaml {paths="direct-response"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: direct-response
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

2. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with a `directResponse` configuration. The policy is applied on the HTTPRoute that you created earlier and returns a 200 HTTP response code with a custom message body.
   ```yaml {paths="direct-response"}
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: direct-response
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

   
{{< doc-test paths="direct-response" >}}
YAMLTest -f - <<'EOF'
- name: wait for direct-response HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: direct-response
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF
{{< /doc-test >}}

{{< doc-test paths="direct-response" >}}
YAMLTest -f - <<'EOF'
- name: direct-response - /status/404 returns 200 with custom body
  retries: 5
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/status/404"
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
    bodyContains:
    - "Status: Healthy"
EOF
{{< /doc-test >}}

3. Send a request along the `/status/404` path of the httpbin app. Typically, this path returns a 404 HTTP response code. However, because you apply a direct response to this route, the request returns a 200 HTTP response code with a custom message instead as defined in your policy. Verify that you see the 200 HTTP response code with your custom message.  
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

{{< version include-if="1.2.x" >}}
## Conditional execution

To return a direct response only when a CEL expression matches, use the `conditional` field on your `directResponse` policy. For example, you can return `410 Gone` on deprecated paths and let every other request reach the backend. For details, see [Conditional policies]({{< link-hextra path="/reference/conditional-policies" >}}).
{{< /version >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}} Run the following commands.

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} health-response -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete httproute direct-response -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

