Use the `default()` and `fail()` [CEL functions]({{< link-hextra path="/reference/cel/#functions-policy-all" >}}) with `json()`, `merge()`, and `toJson()` to control what happens when a field is absent from the request. `default(expression, fallbackValue)` returns the expression if it resolves, and the fallback if it does not. The fallback can be a value to substitute a default, or `fail()`, which skips the transformation entirely when the field is absent.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Apply default values to optional fields

The gateway inspects the JSON request body and fills in missing fields with default values before forwarding to the upstream. This configuration lets the upstream rely on certain fields always being present without requiring the client to send them.

In this example, `model` and `max_tokens` are optional. If a client omits them, the gateway adds the defaults before the request reaches the upstream.

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
           body: 'toJson(json(request.body).merge({"model": default(json(request.body).model, "gpt-4o"), "max_tokens": default(json(request.body).max_tokens, 2048)}))'
   EOF
   ```

   The expression breaks down as follows:
   * `json(request.body)`: Parses the raw request body string into a map.
   * `default(json(request.body).model, "gpt-4o")`: If `model` is absent, substitutes `"gpt-4o"`.
   * `default(json(request.body).max_tokens, 2048)`: If `max_tokens` is absent, substitutes `2048`.
   * `.merge({...})`: Applies the resolved values to the body, overwriting any existing keys.
   * `toJson(...)`: Serializes the resulting map back to a JSON string for the request body.

2. Send a request that omits the optional fields. Verify that defaults are applied in the forwarded body.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/post \
    -H "host: www.example.com:80" \
    -H "content-type: application/json" \
    -d '{"messages": [{"role": "user", "content": "hello"}]}'
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/post \
   -H "host: www.example.com" \
   -H "content-type: application/json" \
   -d '{"messages": [{"role": "user", "content": "hello"}]}'
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[1,2,8]}
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < content-type: application/json
   content-type: application/json
   ...

   {
     "data": "{\"max_tokens\":2048,\"messages\":[{\"content\":\"hello\",\"role\":\"user\"}],\"model\":\"gpt-4o\"}",
     ...
   }
   ```

   The `model` and `max_tokens` defaults are applied because they were not included in the original request.

## Skip a transformation when a field is absent

Using `fail()` as the fallback in `default(expression, fail())` skips the transformation entirely when the field cannot be resolved. This configuration is useful when you want to forward a value only if it actually exists in the request, rather than forwarding a placeholder or empty string.

In this example, the `x-user-id` request header is set from the `user_id` field in the request body. If `user_id` is present, the header is injected. If it is absent, the transformation is skipped and the header is not set.

1. Update the {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with your transformation rules.

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
           - name: x-user-id
             value: 'default(json(request.body).user_id, fail())'
   EOF
   ```

2. Send a request that includes `user_id` in the body. Verify that the `x-user-id` header is present in the forwarded request.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/post \
    -H "host: www.example.com:80" \
    -H "content-type: application/json" \
    -d '{"user_id": "alice123", "messages": [{"role": "user", "content": "hello"}]}'
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/post \
   -H "host: www.example.com" \
   -H "content-type: application/json" \
   -d '{"user_id": "alice123", "messages": [{"role": "user", "content": "hello"}]}'
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[1,2,10]}
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   ...

   {
     "headers": {
       "Content-Type": ["application/json"],
       "Host": ["www.example.com"],
       "User-Agent": ["curl/8.7.1"],
       "X-User-Id": ["alice123"]
     },
     ...
   }
   ```

3. Send a request that omits `user_id`. Verify that the `x-user-id` header is absent.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/post \
    -H "host: www.example.com:80" \
    -H "content-type: application/json" \
    -d '{"messages": [{"role": "user", "content": "hello"}]}'
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/post \
   -H "host: www.example.com" \
   -H "content-type: application/json" \
   -d '{"messages": [{"role": "user", "content": "hello"}]}'
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[1,2]}
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   ...

   {
     "headers": {
       "Content-Type": ["application/json"],
       "Host": ["www.example.com"],
       "User-Agent": ["curl/8.7.1"]
     },
     ...
   }
   ```

   The `X-User-Id` header is absent because `user_id` was not present in the request body and `fail()` caused the transformation to be skipped.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
```
