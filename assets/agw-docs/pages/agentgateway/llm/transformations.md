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
   }' | jq '.usage.completion_tokens'
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
   }' | jq '.usage.completion_tokens'
   ```
   {{% /tab %}}

   {{< /tabs >}}

   Example output: 
   ```console {hl_lines=[4,20,28]}
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

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```shell
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} -n {{< reuse "agw-docs/snippets/namespace.md" >}} -l app=agentgateway
```
