Use [CEL expressions]({{< link-hextra path="/reference/cel/" >}}) to inject LLM model information as response headers. The examples use `llm.requestModel` and `llm.responseModel` to surface which model was requested and which model actually handled the response. This configuration is useful for detecting silent fallbacks, where a request is redirected to a different model without the client being notified.

## Before you begin

[Set up httpbun as a mock LLM backend.]({{< link-hextra path="/llm/providers/httpbun/" >}})

## Inject requested and actual model as response headers

When a fallback model handles a request, the response body contains the actual model name, but nothing in the standard API response signals that a redirect occurred. By injecting `llm.requestModel` and `llm.responseModel` as response headers, you can compare the two values in the client or in an observability tool.

This example injects three headers:

* `x-requested-model`: The model name from the original request, extracted from `llm.requestModel`.
* `x-actual-model`: The model name reported by the upstream LLM provider in the response, extracted from `llm.responseModel`.
* `x-model-fallback`: Set to `"true"` when the requested and actual models differ, and `"false"` when they match.

1. Create a {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource that targets the httpbun HTTPRoute and injects model headers into every response.

   ```yaml {paths="llm-model-headers"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: llm-model-headers
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: httpbun-llm
     traffic:
       transformation:
         response:
           set:
           - name: x-requested-model
             value: 'llm.requestModel'
           - name: x-actual-model
             value: 'llm.responseModel'
           - name: x-model-fallback
             value: 'llm.requestModel != llm.responseModel ? "true" : "false"'
   EOF
   ```

   {{< doc-test paths="llm-model-headers" >}}
   YAMLTest -f - <<'EOF'
   - name: verify model headers are injected into the response
     http:
       url: "http://${INGRESS_GW_ADDRESS}/v1/chat/completions"
       method: POST
       headers:
         Content-Type: application/json
       body: '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hi"}]}'
     source:
       type: local
     expect:
       statusCode: 200
       headers:
         - name: x-requested-model
           comparator: equals
           value: gpt-4
         - name: x-actual-model
           comparator: equals
           value: gpt-4
         - name: x-model-fallback
           comparator: equals
           value: "false"
   EOF
   {{< /doc-test >}}

2. Send a chat completion request through the gateway and inspect the response headers.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi "http://$INGRESS_GW_ADDRESS/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hi"}]}'
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi "http://localhost:8080/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hi"}]}'
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[4,5,6]}
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < content-type: application/json
   < x-requested-model: gpt-4
   < x-actual-model: gpt-4
   < x-model-fallback: false
   ...
   ```

   When a fallback model handles the request instead of the requested model, the headers would show the difference:
   ```console {hl_lines=[4,5,6]}
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < content-type: application/json
   < x-requested-model: gpt-4o
   < x-actual-model: gpt-4o-mini
   < x-model-fallback: true
   ...
   ```

## Access model from request and response body

As an alternative to the `llm` context variables, you can extract the `model` field directly from the raw JSON request and response bodies using `json()`. Use this approach when you want to inspect the raw body fields directly, or when the `llm` context is not available for your route type.

* `json(request.body).model`: Reads the `model` field from the incoming request body.
* `json(response.body).model`: Reads the `model` field from the upstream response body.

1. Update the {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} to use body-based extraction instead.

   ```yaml {paths="llm-model-headers-body"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: llm-model-headers
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: httpbun-llm
     traffic:
       transformation:
         response:
           set:
           - name: x-requested-model
             value: 'string(json(request.body).model)'
           - name: x-actual-model
             value: 'string(json(response.body).model)'
   EOF
   ```

   The expression breaks down as follows:
   * `json(request.body)`: Parses the raw request body string into a map.
   * `.model`: Accesses the `model` field from the parsed map.
   * `string(...)`: Converts the value to a string for use as a header value.

   {{< callout type="info" >}}
   The `llm.requestModel` and `llm.responseModel` variables are the preferred approach for LLM routes because they are parsed by agentgateway from the LLM protocol layer. The `json()` body approach is useful when you need direct access to the raw body fields or when working with non-LLM JSON routes.
   {{< /callout >}}

   {{< doc-test paths="llm-model-headers-body" >}}
   YAMLTest -f - <<'EOF'
   - name: verify model headers are set from request and response body fields
     http:
       url: "http://${INGRESS_GW_ADDRESS}/v1/chat/completions"
       method: POST
       headers:
         Content-Type: application/json
       body: '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hi"}]}'
     source:
       type: local
     expect:
       statusCode: 200
       headers:
         - name: x-requested-model
           comparator: equals
           value: gpt-4
         - name: x-actual-model
           comparator: equals
           value: gpt-4
   EOF
   {{< /doc-test >}}

2. Send a chat completion request and verify the injected headers.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi "http://$INGRESS_GW_ADDRESS/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hi"}]}'
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi "http://localhost:8080/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hi"}]}'
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[4,5]}
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < content-type: application/json
   < x-requested-model: gpt-4
   < x-actual-model: gpt-4
   ...
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="llm-model-headers,llm-model-headers-body"}
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} llm-model-headers -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
```
