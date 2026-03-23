Update the response status based on request query parameters by using [CEL expressions]({{< link-hextra path="/reference/cel/" >}}).

The transformation phase controls when the policy is evaluated:

- **`PostRouting`**: The transformation is applied after the routing decision is made. Target an HTTPRoute.
- **`PreRouting`**: The transformation is applied before routing decisions are made, acting as a gateway-level gate. Target a Gateway or Listener instead of an HTTPRoute.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## PostRouting: Change the response status on a route

In this example, the transformation applies after routing and targets a specific HTTPRoute.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with your transformation rules. You change the value of the `:status` pseudo response header to 401 if the request URI contains `foo=bar`. If the request URI does not contain `foo=bar`, you return a 403 HTTP response code.

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
         response:
           set:
           - name: ":status"
             value: 'request.uri.contains("foo=bar") ? 401 : 403'
   EOF
   ```

2. Send a request to the httpbin app and include the `foo=bar` query parameter. Verify that you get back a 401 HTTP response code.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/response-headers?foo=bar \
    -H "host: www.example.com:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi "localhost:8080/response-headers?foo=bar" \
   -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[1,2]}
   < HTTP/1.1 401 Unauthorized
   HTTP/1.1 401 Unauthorized
   < access-control-allow-credentials: true
   access-control-allow-credentials: true
   < access-control-allow-origin: *
   access-control-allow-origin: *
   < content-type: application/json; encoding=utf-8
   content-type: application/json; encoding=utf-8
   < foo: bar
   foo: bar
   < content-length: 29
   content-length: 29

   {
     "foo": [
       "bar"
     ]
   }
   ```

3. Send another request to the httpbin app. This time, include the `foo=baz` query parameter. Verify that you get back a 403 HTTP response code.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/response-headers?foo=baz \
    -H "host: www.example.com:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi "localhost:8080/response-headers?foo=baz" \
   -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[1,2]}
   < HTTP/1.1 403 Forbidden
   HTTP/1.1 403 Forbidden
   < access-control-allow-credentials: true
   access-control-allow-credentials: true
   < access-control-allow-origin: *
   access-control-allow-origin: *
   < content-type: application/json; encoding=utf-8
   content-type: application/json; encoding=utf-8
   < foo: baz
   foo: baz
   < content-length: 29
   content-length: 29

   {
     "foo": [
       "baz"
     ]
   }
   ```

## PreRouting: Change the response status on a Gateway

In this example, the same transformation applies before routing, targeting the Gateway. This means the status check applies to all routes on the Gateway, regardless of which backend serves the request.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with `phase: PreRouting` and a `targetRef` pointing to your Gateway.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: transformation-prerouting
     namespace: httpbin
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: http
     traffic:
       phase: PreRouting
       transformation:
         response:
           set:
           - name: ":status"
             value: 'request.uri.contains("foo=bar") ? 401 : 403'
   EOF
   ```

2. Send the same requests as in the PostRouting example. You get the same 401 and 403 responses, but the transformation now applies at the Gateway level before any routing decision is made.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/response-headers?foo=bar \
    -H "host: www.example.com:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi "localhost:8080/response-headers?foo=bar" \
   -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[1,2]}
   < HTTP/1.1 401 Unauthorized
   HTTP/1.1 401 Unauthorized
   < access-control-allow-credentials: true
   access-control-allow-credentials: true
   < access-control-allow-origin: *
   access-control-allow-origin: *
   < content-type: application/json; encoding=utf-8
   content-type: application/json; encoding=utf-8
   < foo: bar
   foo: bar
   < content-length: 29
   content-length: 29

   {
     "foo": [
       "bar"
     ]
   }
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation-prerouting -n httpbin
```

