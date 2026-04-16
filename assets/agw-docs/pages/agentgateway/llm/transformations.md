Use LLM request transformations to dynamically compute and set fields in LLM requests using {{< gloss "CEL (Common Expression Language)" >}}Common Expression Language (CEL){{< /gloss >}} expressions. Transformations let you enforce policies such as capping token usage or conditionally modifying request parameters, without changing client code.

To learn more about CEL, see the following resources:

- [CEL expression reference]({{< link-hextra path="/reference/cel/" >}})
- [cel.dev tutorial](https://cel.dev/tutorials/cel-get-started-tutorial)

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}


## Configure LLM request transformations

{{< doc-test paths="llm-transformations" >}}
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: openai
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  rules:
    - backendRefs:
        - name: openai
          namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
          group: {{< reuse "agw-docs/snippets/group.md" >}}
          kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
{{< /doc-test >}}

{{< doc-test paths="llm-transformations" >}}
YAMLTest -f - <<'EOF'
- name: wait for openai HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: openai
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
EOF
{{< /doc-test >}}

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource to apply an LLM request transformation. The following example limits `max_completion_tokens` to no more than 10 by taking the smaller of the client's requested value and 10, regardless of what the client requests.

   ```yaml {paths="llm-transformations"}
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
         - field: max_completion_tokens
           expression: "min(llmRequest.max_completion_tokens, 10)"
   EOF
   ```

   {{< doc-test paths="llm-transformations" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for cap-max-tokens policy to be accepted
     wait:
       target:
         kind: AgentgatewayPolicy
         metadata:
           namespace: agentgateway-system
           name: cap-max-tokens
       jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 120
         intervalSeconds: 2
   EOF
   {{< /doc-test >}}

   | Setting | Description |
   | -- | -- |
   | `backend.ai.transformations` | A list of LLM request field transformations. |
   | `field` | The name of the LLM request field to set. Maximum 256 characters. |
   | `expression` | A CEL expression that computes the value for the field. Use the `llmRequest` variable to access the original LLM request body. Maximum 16,384 characters. |

   {{< callout type="info" >}}
   You can specify up to 64 transformations per policy. Transformations take priority over `overrides` for the same field. If an expression fails to evaluate, the field is silently removed from the request.

   Thinking budget fields, such as `reasoning_effort` and `thinking_budget_tokens` can also be set or capped by using transformations. This way, operators can enforce reasoning limits centrally without requiring client changes. For example, use `"field": "reasoning_effort"` with the expression `"medium"` to cap all requests to medium reasoning efforts regardless of what the client sends.
   {{< /callout >}}

2. Verify that the {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} is accepted.

   ```sh
   kubectl get {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} cap-max-tokens -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o jsonpath='{.status.ancestors[0].conditions[?(@.type=="Accepted")].status}'
   ```

3. Send a request with `max_completion_tokens` set to a value greater than 10. The transformation limits it to 10 before the request reaches the LLM provider. Verify that the `completion_tokens` value in the response is 10 or fewer and the `finish_reason` is set to `length`.

   {{< callout type="info" >}}
   Some older OpenAI models use `max_tokens` instead of `max_completion_tokens`. If the transformation does not appear to take effect, check the model's API documentation for the correct field name and update the transformation's `field` value accordingly.
   {{< /callout >}}

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}

   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "$INGRESS_GW_ADDRESS/v1/chat/completions" \
   -H "content-type: application/json" \
   -d '{
     "model": "gpt-3.5-turbo",
     "max_completion_tokens": 5000,
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
   curl "localhost:8080/v1/chat/completions" \
   -H "content-type: application/json" \
   -d '{
     "model": "gpt-3.5-turbo",
     "max_completion_tokens": 5000,
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

   {{< doc-test paths="llm-transformations" >}}
   YAMLTest -f - <<'EOF'
   - name: verify request succeeds with max_completion_tokens transformation applied
     http:
       url: "http://${INGRESS_GW_ADDRESS}/v1/chat/completions"
       method: POST
       headers:
         content-type: application/json
       body: |
         {"model": "gpt-4", "max_completion_tokens": 5000, "messages": [{"role": "user", "content": "Tell me a short story"}]}
     source:
       type: local
     expect:
       statusCode: 200
   EOF
   {{< /doc-test >}}

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

{{< doc-test paths="llm-model-headers" >}}
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: openai
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  rules:
    - backendRefs:
        - name: openai
          namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
          group: {{< reuse "agw-docs/snippets/group.md" >}}
          kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
{{< /doc-test >}}

{{< doc-test paths="llm-model-headers" >}}
YAMLTest -f - <<'EOF'
- name: wait for openai HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: openai
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
EOF
{{< /doc-test >}}

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
   - name: wait for llm-model-headers policy to be accepted
     wait:
       target:
         kind: AgentgatewayPolicy
         metadata:
           namespace: agentgateway-system
           name: llm-model-headers
       jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 120
         intervalSeconds: 2
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

   {{< doc-test paths="llm-model-headers" >}}
   # accept-encoding: identity prevents the upstream from compressing the
   # response body. Without this header, axios (used by YAMLTest) requests
   # gzip/br encoding by default, and the compressed body cannot be parsed
   # by the json(response.body) CEL expression, so x-actual-model is never set.
   YAMLTest -f - <<'EOF'
   - name: verify model headers are injected
     http:
       url: "http://${INGRESS_GW_ADDRESS}/v1/chat/completions"
       method: POST
       headers:
         content-type: application/json
         accept-encoding: identity
       body: |
         {"model": "gpt-4", "messages": [{"role": "user", "content": "Hi"}]}
     source:
       type: local
     expect:
       statusCode: 200
       headers:
         - name: x-requested-model
           comparator: contains
           value: gpt-4
         - name: x-actual-model
           comparator: contains
           value: gpt
   EOF
   {{< /doc-test >}}

   Example output:
   ```console {hl_lines=[5,6,7,8]}
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < content-type: application/json
   content-type: application/json
   < x-requested-model: gpt-4
   x-requested-model: gpt-4
   < x-actual-model: gpt-3.5-turbo-0125
   x-actual-model: gpt-3.5-turbo-0125
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
   
<!-- metadata not working issue: https://github.com/agentgateway/agentgateway/issues/1554 -->
<!--

### Detect fallback with the llm context variables

When the agentgateway proxy routes to an AI backend, the `llm` CEL context provides first-class variables that are parsed directly from the LLM protocol layer rather than from raw body strings:

* `llm.requestModel`: The model name from the original request.
* `llm.responseModel`: The model name the upstream LLM provider reported in the response.

Use [`metadata`]({{< link-hextra path="/traffic-management/transformations/templating-language/#pre-compute-values-with-metadata" >}}) to pre-compute the `llm` context values, and `default()` in the `set` expressions to fall back to parsing the raw body if the variable is unavailable. This approach computes each value once and keeps the `x-model-fallback` comparison readable:

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: llm-context-vars
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
        metadata:
          requestedModel: 'llm.requestModel'
          actualModel: 'llm.responseModel'
        set:
        - name: x-requested-model
          value: 'default(metadata.requestedModel, string(json(request.body).model))'
        - name: x-actual-model
          value: 'default(metadata.actualModel, string(json(response.body).model))'
        - name: x-model-fallback
          value: 'default(metadata.requestedModel, string(json(request.body).model)) != default(metadata.actualModel, string(json(response.body).model)) ? "true" : "false"'
EOF
```


The `metadata` field pre-computes the `llm` context values once. The `default()` fallback in each `set` expression ensures the header is still populated even if the `llm` context variable is unavailable.
-->
## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```shell {paths="llm-transformations,llm-model-headers"}
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} cap-max-tokens -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} llm-model-headers -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
```

{{< doc-test paths="llm-transformations,llm-model-headers" >}}
kubectl delete httproute openai -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
{{< /doc-test >}}
