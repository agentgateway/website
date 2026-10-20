Expose [OpenAI](https://openai.com/) models through {{< reuse "agw-docs/snippets/agentgateway.md" >}} and send a chat completion request.

> [!NOTE]
> To try this without a provider API key, follow the [httpbun guide]({{< link-hextra path="/integrations/llm/providers/httpbun">}}). Httpbun provides a mock API compatible with OpenAI chat completions.

## Before you begin

Complete the [Install agentgateway]({{< link-hextra path="/documentation/quickstart/install/" >}}) quick start to create the `agentgateway-proxy` Gateway.

## Steps

{{% steps %}}

### Step 1: Store your API key

1. [Create an API key to access the OpenAI API](https://platform.openai.com/api-keys), and save it in an environment variable.

   ```sh
   export OPENAI_API_KEY='<your-api-key>'
   ```

   {{< doc-test paths="quickstart-llm" >}}
   # The test routes to the httpbun mock LLM, which ignores credentials.
   export OPENAI_API_KEY="${OPENAI_API_KEY:-sk-placeholder}"
   {{< /doc-test >}}

2. Create a Kubernetes Secret that stores the API key. By default, agentgateway reads the key from the `Authorization` field and sends it to the provider as a bearer token.

   ```yaml {paths="quickstart-llm"}
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: openai-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $OPENAI_API_KEY
   EOF
   ```

### Step 2: Allow models on the Gateway

Allow the `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` route kind on the Gateway's `http` listener. The listener accepts only the kinds you list in `allowedRoutes.kinds`, so keep `HTTPRoute` for the other quick starts.

```yaml {paths="quickstart-llm"}
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: agentgateway-proxy
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  gatewayClassName: {{< reuse "agw-docs/snippets/agw-gatewayclass.md" >}}
  listeners:
  - protocol: HTTP
    port: 80
    name: http
    allowedRoutes:
      namespaces:
        from: All
      kinds:
      - group: gateway.networking.k8s.io
        kind: HTTPRoute
      - group: agentgateway.dev
        kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
EOF
```

### Step 3: Expose the OpenAI models

Create an `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` that matches `openai/*`. Clients request names such as `openai/gpt-5-mini`. Agentgateway strips the prefix so OpenAI receives `gpt-5-mini`.

```yaml {paths="quickstart-llm"}
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
metadata:
  name: openai
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
    sectionName: http
  match:
    model: "openai/*"
  provider: OpenAI
  policies:
    auth:
      secretRef:
        name: openai-secret
    transformations:
    - field: model
      expression: 'llmRequest.model.stripPrefix("openai/")'
EOF
```

{{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API docs]({{< link-hextra path="/reference/api/#agentgatewaymodelspec" >}}).

| Field | Description |
|-------|-------------|
| `spec.parentRefs` | Attaches the model to the `http` listener of the `agentgateway-proxy` Gateway. |
| `spec.match.model` | Matches model names that start with `openai/`. |
| `spec.provider` | The provider that serves the requests. |
| `spec.policies.auth` | References the Secret that stores the provider API key. |
| `spec.policies.transformations` | Removes the `openai/` prefix before forwarding the request. |

{{< reuse "agw-docs/snippets/model-exposure-patterns-tip.md" >}}

{{< doc-test paths="quickstart-llm" >}}
# Route the model to the httpbun mock LLM instead of OpenAI, so the test needs no API
# key and bills nothing. httpbun echoes the model that it receives, which lets the test
# assert that the gateway stripped the `openai/` prefix.
{{< reuse "agw-docs/snippets/deploy-mock-llm.md" >}}
kubectl patch agentgatewaymodel openai -n {{< reuse "agw-docs/snippets/namespace.md" >}} --type=merge \
  -p '{"spec":{"baseURL":"http://httpbun.default.svc.cluster.local:3090/llm"}}'
{{< /doc-test >}}

### Step 4: Send a request

1. Get the address of the agentgateway proxy.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   {{< reuse "agw-docs/snippets/kind-loadbalancer-tip.md" >}}

   ```sh
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy -o jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
   echo $INGRESS_GW_ADDRESS
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   Use port-forwarding if your cluster does not assign an external IP to `LoadBalancer` services, as in a default Kind cluster.

   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80
   ```

   In a separate terminal, point the requests in this guide at the forwarded port.

   ```sh
   export INGRESS_GW_ADDRESS=localhost:8080
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Send a chat completion request for an OpenAI model. Prefix the model name with `openai/`.

   ```sh
   curl -s "http://$INGRESS_GW_ADDRESS/v1/chat/completions" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "openai/gpt-5-mini",
       "messages": [{"role": "user", "content": "Say hello in one sentence."}]
     }' | jq
   ```

   The response uses the provider's model name without the `openai/` prefix.

   Example output (abbreviated):

   ```json
   {
     "model": "gpt-5-mini-2025-08-07",
     "object": "chat.completion",
     "choices": [
       {
         "index": 0,
         "message": {
           "role": "assistant",
           "content": "Hello! How can I help you today?"
         },
         "finish_reason": "stop"
       }
     ],
     "usage": {
       "prompt_tokens": 13,
       "completion_tokens": 18,
       "total_tokens": 31
     }
   }
   ```

   {{< doc-test paths="quickstart-llm" >}}
   # An AgentgatewayModel does not report status, so poll the data plane until the
   # model is served instead of waiting on a resource condition.
   for i in $(seq 1 60); do
     curl -s --max-time 5 -o /dev/null -X POST "http://${INGRESS_GW_ADDRESS}/v1/chat/completions" \
       -H "Content-Type: application/json" \
       -d '{"model":"openai/gpt-5-mini","messages":[],"httpbun":{"content":"warmup"}}' && break
     sleep 2
   done

   YAMLTest -f - <<'EOF'
   - name: openai/* serves the request and strips the prefix before the provider sees it
     http:
       url: "http://${INGRESS_GW_ADDRESS}"
       path: /v1/chat/completions
       method: POST
       headers:
         Content-Type: application/json
       body: |
         {
           "model": "openai/gpt-5-mini",
           "messages": [{"role": "user", "content": "Say hello in one sentence."}],
           "httpbun": {"content": "Hello from the mock LLM"}
         }
     source:
       type: local
     retries: 3
     expect:
       statusCode: 200
       bodyJsonPath:
         - path: "$.model"
           comparator: equals
           value: "gpt-5-mini"
         - path: "$.usage.total_tokens"
           comparator: greaterThan
           value: 0
   - name: a model without the openai/ prefix is not exposed
     http:
       url: "http://${INGRESS_GW_ADDRESS}"
       path: /v1/chat/completions
       method: POST
       headers:
         Content-Type: application/json
       body: |
         {"model": "gpt-5-mini", "messages": []}
     source:
       type: local
     expect:
       statusCode: 404
       bodyJsonPath:
         - path: "$.error.code"
           comparator: equals
           value: "model_not_found"
   EOF
   {{< /doc-test >}}

3. Optional: List the models that clients can request. Agentgateway expands `openai/*` into the OpenAI models from its built-in model catalog.

   ```sh
   curl -s "http://$INGRESS_GW_ADDRESS/v1/models" | jq -r '.data[].id'
   ```

   Example output (abbreviated):

   ```
   openai/gpt-4.1
   openai/gpt-4o
   openai/gpt-5
   openai/gpt-5-mini
   ...
   ```

   {{< doc-test paths="quickstart-llm" >}}
   models=$(curl -s "http://${INGRESS_GW_ADDRESS}/v1/models")
   echo "$models" | jq -r '.data[].id' | grep -qx 'openai/gpt-5-mini' \
     || { echo "openai/* did not expand to openai/gpt-5-mini in /v1/models: $models"; exit 1; }
   {{< /doc-test >}}

{{% /steps %}}

## Next steps

{{< cards >}}
  {{< card path="/documentation/llm/about/#choose-how-to-expose-models" title="Choose how to expose models" subtitle="Compare provider prefixes, exact names, wildcards, and custom model names." >}}
  {{< card path="/documentation/llm/models/virtual/" title="Virtual models" subtitle="Split traffic, fail over, or route by request context behind one model name." >}}
  {{< card path="/integrations/llm/providers/" title="Providers" subtitle="Configure Anthropic, Gemini, Bedrock, and other LLM providers." >}}
{{< /cards >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete agentgatewaymodel openai -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete secret openai-secret -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
