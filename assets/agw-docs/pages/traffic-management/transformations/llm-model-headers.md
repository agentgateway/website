Use [CEL expressions]({{< link-hextra path="/reference/cel/" >}}) to inject LLM model information as response headers. This is useful for detecting silent fallbacks, where a request is redirected to a different model without the client being notified.

## Before you begin

[Set up httpbun as a mock LLM backend.]({{< link-hextra path="/llm/providers/httpbun/" >}})

## Inject model headers from request and response bodies

Parse the `model` field from the incoming request body and the upstream response body using `json()`, then inject them as response headers. This lets you compare which model was requested against which model actually responded.

* `json(request.body).model`: Reads the `model` field from the incoming request body.
* `json(response.body).model`: Reads the `model` field from the upstream response body.

1. Create a {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource that targets the httpbun HTTPRoute and injects the model fields as response headers.

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
             value: 'string(json(request.body).model)'
           - name: x-actual-model
             value: 'string(json(response.body).model)'
   EOF
   ```

   {{< doc-test paths="llm-model-headers" >}}
   YAMLTest -f - <<'EOF'
   - name: verify model headers are injected from request and response bodies
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
   ```console {hl_lines=[1,2,7,8,9,10]}
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < content-type: application/json
   content-type: application/json
   < x-powered-by: httpbun/8cb6c4f90cf49eb4509e7ae699c27b9f85f383c5
   x-powered-by: httpbun/8cb6c4f90cf49eb4509e7ae699c27b9f85f383c5
   < x-requested-model: gpt-4
   x-requested-model: gpt-4
   < x-actual-model: gpt-4
   x-actual-model: gpt-4
   ...
   ```

   When a fallback model handles the request, `x-actual-model` will differ from `x-requested-model`:
   ```console {hl_lines=[4,5]}
   < x-requested-model: gpt-4o
   < x-actual-model: gpt-4o-mini
   ```

## Detect fallback with the llm context variables

When agentgateway routes to an AI backend, the `llm` CEL context provides first-class variables that are parsed directly from the LLM protocol layer rather than from raw body strings:

* `llm.requestModel`: The model name agentgateway parsed from the original request.
* `llm.responseModel`: The model name the upstream LLM provider reported in the response.

Use [`metadata`]({{< link-hextra path="/traffic-management/transformations/templating-language/#cel-functions" >}}) to compute each value once and reference it by name. This setup avoids repeating the `default()` fallback expression in every header and keeps the `x-model-fallback` condition readable:

```yaml
traffic:
  transformation:
    response:
      metadata:
        requestedModel: 'default(llm.requestModel, string(json(request.body).model))'
        actualModel: 'default(llm.responseModel, string(json(response.body).model))'
      set:
      - name: x-requested-model
        value: metadata.requestedModel
      - name: x-actual-model
        value: metadata.actualModel
      - name: x-model-fallback
        value: 'metadata.requestedModel != metadata.actualModel ? "true" : "false"'
```

The `default()` fallback is written once per value rather than repeated in every header and in the comparison.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="llm-model-headers"}
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} llm-model-headers -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
