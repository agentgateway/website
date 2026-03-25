Use the `filterKeys()` and `merge()` [CEL functions]({{< link-hextra path="/reference/cel/#functions-policy-all" >}}) together with `json()` and `toJson()` to sanitize a JSON request body before it reaches the upstream. `filterKeys()` removes unwanted fields by testing each key against a predicate. `merge()` combines two maps, with the second map's values overwriting any matching keys in the first. `toJson()` serializes the resulting map back to a JSON string.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Filter and merge request body fields

In this example, an incoming request body contains internal metadata fields prefixed with `x_` that should not be forwarded to the upstream. After stripping those fields, default values for `model` and `max_tokens` are merged in.

For example, a request body of `{"messages": [...], "model": "gpt-3.5-turbo", "x_trace_id": "abc", "x_user_session": "xyz"}` is forwarded upstream as `{"messages": [...], "model": "gpt-4o", "max_tokens": 2048}`.

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
           body: 'toJson(json(request.body).filterKeys(k, !k.startsWith("x_")).merge({"model": "gpt-4o", "max_tokens": 2048}))'
   EOF
   ```

   The expression breaks down as follows:
   * `json(request.body)`: Parses the raw request body string into a map.
   * `.filterKeys(k, !k.startsWith("x_"))`: Keeps only the keys that do not start with `x_`, stripping internal metadata fields.
   * `.merge({"model": "gpt-4o", "max_tokens": 2048})`: Merges in the default values, overwriting any existing `model` value and adding `max_tokens`.
   * `toJson(...)`: Serializes the resulting map back to a JSON string for the request body.

2. Send a POST request to the httpbin app with a JSON body that includes internal metadata fields. Verify that you get back a 200 HTTP response code and that the `x_` fields are absent from the forwarded body.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/post \
    -H "host: www.example.com:80" \
    -H "content-type: application/json" \
    -d '{"messages": [{"role": "user", "content": "hello"}], "model": "gpt-3.5-turbo", "x_trace_id": "abc123", "x_user_session": "xyz789"}'
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/post \
   -H "host: www.example.com" \
   -H "content-type: application/json" \
   -d '{"messages": [{"role": "user", "content": "hello"}], "model": "gpt-3.5-turbo", "x_trace_id": "abc123", "x_user_session": "xyz789"}'
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

   The `x_trace_id` and `x_user_session` fields are absent. The `model` value is overwritten to `gpt-4o` and `max_tokens` is added.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} transformation -n httpbin
```
