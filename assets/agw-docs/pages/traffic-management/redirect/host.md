Redirect requests to a different host. 

For more information, see the [{{< reuse "agw-docs/snippets/k8s-gateway-api-name.md" >}} documentation](https://gateway-api.sigs.k8s.io/reference/spec/#httprequestredirectfilter).

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Set up host redirects

1. Create an HTTPRoute for the httpbin app. In the following example, requests for the `host.redirect.example` domain are redirected to the `www.example.com` hostname, and a 302 HTTP response code is returned to the user.
   ```yaml {paths="host-redirect"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: httpbin-redirect
     namespace: httpbin
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     hostnames:
       - host.redirect.example
     rules:
       - matches:
           - path:
               type: PathPrefix
               value: /
         filters:
           - type: RequestRedirect
             requestRedirect:
               hostname: "www.example.com"
               statusCode: 302
   EOF
   ```

4. Send a request to the httpbin app on the `host.redirect.example` domain and verify that you get back a 302 HTTP response code and the redirect location `www.example.com/headers`. 
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2"  >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/headers -H "host: host.redirect.example:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/headers -H "host: host.redirect.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output: 
   ```
   * Mark bundle as not supporting multiuse
   < HTTP/1.1 302 Found
   HTTP/1.1 302 Found
   < location: http://www.example.com/headers
   location: http://www.example.com/headers
   < server: envoy
   server: envoy
   < content-length: 0
   content-length: 0
   ```

{{< doc-test paths="host-redirect" >}}
YAMLTest -f - <<'EOF'
- name: wait for httpbin-redirect HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: httpbin
        name: httpbin-redirect
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF
{{< /doc-test >}}

{{< doc-test paths="host-redirect" >}}
for i in $(seq 1 60); do
  curl -s --max-time 5 -o /dev/null "http://${INGRESS_GW_ADDRESS}:80/headers" -H "host: host.redirect.example" && break
  sleep 2
done
{{< /doc-test >}}

{{< doc-test paths="host-redirect" >}}
YAMLTest -f - <<'EOF'
- name: host redirect - host.redirect.example returns 302 with location www.example.com
  retries: 1
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80"
    path: /headers
    method: GET
    headers:
      host: "host.redirect.example"
  source:
    type: local
  expect:
    statusCode: 302
    headers:
      - name: location
        comparator: contains
        value: www.example.com
EOF
{{< /doc-test >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete httproute httpbin-redirect -n httpbin --ignore-not-found
```



