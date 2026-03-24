Use the `default()` and `fail()` [CEL functions]({{< link-hextra path="/reference/cel/#functions-policy-all" >}}) together with `json()` and `merge()` to enforce required fields and apply defaults on a JSON request body. `default(expression, fallbackValue)` returns the expression if it resolves, and the fallback if it does not. Using `fail()` as the fallback makes a field effectively required. If the field is absent, the expression fails and the request is rejected.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Validate required fields and apply defaults

In this example, the `messages` field is required. If it is missing from the request body, `fail()` rejects the request. The `model` and `max_tokens` fields are optional — if absent, they receive default values.

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
           body: 'string(json(request.body).merge({"messages": default(json(request.body).messages, fail()), "model": default(json(request.body).model, "gpt-4o"), "max_tokens": default(json(request.body).max_tokens, 2048)}))'
   EOF
   ```

   The expression breaks down as follows:
   * `default(json(request.body).messages, fail())` — `messages` is required. If it is absent, `fail()` rejects the request.
   * `default(json(request.body).model, "gpt-4o")` — `model` is optional. If absent, it defaults to `gpt-4o`.
   * `default(json(request.body).max_tokens, 2048)` — `max_tokens` is optional. If absent, it defaults to `2048`.
   * `.merge({...})` — applies all resolved values to the body, overwriting existing keys.

2. Send a request that omits the required `messages` field. Verify that the request is rejected.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/post \
    -H "host: www.example.com:80" \
    -H "content-type: application/json" \
    -d '{"model": "gpt-3.5-turbo"}'
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/post \
   -H "host: www.example.com" \
   -H "content-type: application/json" \
   -d '{"model": "gpt-3.5-turbo"}'
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[1,2]}
   < HTTP/1.1 400 Bad Request
   HTTP/1.1 400 Bad Request
   ```

3. Send a valid request that includes `messages` but omits the optional fields. Verify that defaults are applied.

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
     "data": "{\"messages\":[{\"role\":\"user\",\"content\":\"hello\"}],\"model\":\"gpt-4o\",\"max_tokens\":2048}",
     ...
   }
   ```

   The `model` and `max_tokens` defaults are applied because they were not included in the original request.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
```
