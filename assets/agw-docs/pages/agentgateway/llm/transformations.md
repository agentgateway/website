Use LLM request transformations to dynamically compute and set fields in LLM requests using {{< gloss "CEL (Common Expression Language)" >}}Common Expression Language (CEL){{< /gloss >}} expressions. Transformations let you enforce policies such as capping token usage or conditionally modifying request parameters, without changing client code.

To learn more about CEL, see the following resources:

- [CEL expression reference]({{< link-hextra path="/reference/cel/" >}})
- [cel.dev tutorial](https://cel.dev/tutorials/cel-get-started-tutorial)

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

## Configure LLM request transformations

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource to apply an LLM request transformation. The following example caps `max_tokens` to 10, regardless of what the client requests.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: cap-max-tokens
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       app: agentgateway
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: openai
     backend:
       ai:
         transformations:
         - field: max_tokens
           expression: "min(llmRequest.max_tokens, 10)"
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `backend.ai.transformations` | A list of LLM request field transformations. |
   | `field` | The name of the LLM request field to set. Maximum 256 characters. |
   | `expression` | A CEL expression that computes the value for the field. Use the `llmRequest` variable to access the original LLM request body. Maximum 16,384 characters. |

   {{< callout type="info" >}}
   You can specify up to 64 transformations per policy. Transformations take priority over `overrides` for the same field. If an expression fails to evaluate, the field is silently removed from the request.

   Thinking budget fields, such as `reasoning_effort` and `thinking_budget_tokens` can also be set or capped by using transformations. This way, operators can enforce reasoning limits centrally without requiring client changes. For example, use `"field": "reasoning_effort"` with the expression `"medium"` to cap all requests to medium reasoning efforts regardless of what the client sends.
   {{< /callout >}}

2. Send a request with `max_tokens` set to a value greater than 10. The transformation caps it to 10 before the request reaches the LLM provider. Verify that the `completion_tokens` value in the response is 10 or fewer, the response is capped and the `finish_reason` is set to `length`. 

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}

   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "$INGRESS_GW_ADDRESS/openai" \
   -H "content-type: application/json" \
   -d '{
     "model": "gpt-3.5-turbo",
     "max_tokens": 5000,
     "messages": [
       {
         "role": "user",
         "content": "Tell me a short story"
       }
     ]
   }' | jq 
   ```
   {{% /tab %}}

   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/openai" \
   -H "content-type: application/json" \
   -d '{
     "model": "gpt-3.5-turbo",
     "max_tokens": 5000,
     "messages": [
       {
         "role": "user",
         "content": "Tell me a short story"
       }
     ]
   }' | jq 
   ```
   {{% /tab %}}

   {{< /tabs >}}

   Example output: 
   ```console {hl_lines=[5,28]}
   {
     "model": "gpt-3.5-turbo-0125",
     "usage": {
       "prompt_tokens": 12,
       "completion_tokens": 10,
       "total_tokens": 22,
       "completion_tokens_details": {
         "reasoning_tokens": 0,
         "audio_tokens": 0,
         "accepted_prediction_tokens": 0,
         "rejected_prediction_tokens": 0
       },
       "prompt_tokens_details": {
         "cached_tokens": 0,
         "audio_tokens": 0
       }
     },
     "choices": [
       {
         "message": {
           "content": "Once upon a time, in a small village nestled",
           "role": "assistant",
           "refusal": null,
           "annotations": []
         },
         "index": 0,
         "logprobs": null,
         "finish_reason": "length"
       }
     ],
     ...
   }
   ```

## Inject LLM model information as response headers

Use [CEL expressions]({{< link-hextra path="/reference/cel/" >}}) to inject LLM model information as response headers. This strategy is useful for detecting silent fallbacks, where a request is redirected to a different model without the client being notified. However, this setup might not be suitable for streaming responses.

### Inject model headers from request and response bodies

Parse the `model` field from the incoming request body and the upstream response body using `json()`, then inject them as response headers. This configuration lets you compare which model was requested against which model actually responded.

* `json(request.body).model`: Reads the `model` field from the incoming request body.
* `json(response.body).model`: Reads the `model` field from the upstream response body.

1. Create a {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource that targets the OpenAI provider's HTTPRoute and injects the model fields as response headers.

   ```yaml {paths="llm-model-headers"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: llm-model-headers
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       app: agentgateway
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: openai
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
   ```console {hl_lines=[1,2,5,6,7,8]}
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < content-type: application/json
   content-type: application/json
   < x-requested-model: gpt-4
   x-requested-model: gpt-4
   < x-actual-model: gpt-4
   x-actual-model: gpt-4
   ...
   ```

   Actual model values might differ slightly from the requested model, even if the same model is used. Some responses might include a unique identifier as part of the model name. In these circumstances, you might use the `contains()` function to verify.

   When a fallback model handles the request, `x-actual-model` differs from `x-requested-model`:
   ```console {hl_lines=[2,4]}
   < x-requested-model: gpt-4o
   x-requested-model: gpt-4o
   < x-actual-model: gpt-4o-mini
   x-actual-model: gpt-4o-mini
   ```

### Detect fallback with the llm context variables

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

```shell
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} -n {{< reuse "agw-docs/snippets/namespace.md" >}} -l app=agentgateway
```
