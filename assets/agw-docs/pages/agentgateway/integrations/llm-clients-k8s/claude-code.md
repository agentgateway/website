Configure [Claude Code](https://docs.anthropic.com/en/docs/claude-code), the AI coding CLI by Anthropic, to route LLM requests through your agentgateway proxy running in Kubernetes.

## About

Claude Code uses Anthropic's native `/v1/messages` endpoint instead of the OpenAI-compatible `/v1/chat/completions` endpoint that other LLM clients use. The agentgateway backend must include an explicit `/v1/messages` route mapping so that LLM policies such as prompt guards and rate limiting apply to Claude Code traffic.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
2. [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed (`npm install -g @anthropic-ai/claude-code`).
3. An Anthropic API key from the [Anthropic Console](https://console.anthropic.com).

## Get the gateway URL

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

## Set up the Anthropic backend

Create a secret, backend, and route to proxy Claude Code traffic through agentgateway.

1. Export your Anthropic API key.

   ```bash
   export ANTHROPIC_API_KEY="sk-ant-your-key-here"
   ```

2. Create a Kubernetes secret for your API key. For other authentication methods, see [API keys]({{< link-hextra path="/llm/api-keys/" >}}).

   ```bash {paths="claude-code-k8s"}
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: anthropic-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $ANTHROPIC_API_KEY
   EOF
   ```

3. Create an AgentgatewayBackend with the `/v1/messages` route and any other details such as models that you want to configure.

   {{< tabs items="Flexible model (recommended),Fixed model" >}}

   {{% tab tabName="Flexible model (recommended)" %}}
   Allow Claude Code to use any model. The `anthropic: {}` syntax means no model is pinned.

   ```bash {paths="claude-code-k8s"}
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: anthropic
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         anthropic: {}
     policies:
       ai:
         routes:
           '/v1/messages': Messages
           '*': Passthrough
       auth:
         secretRef:
           name: anthropic-secret
   EOF
   ```
   {{% /tab %}}

   {{% tab tabName="Fixed model" %}}
   Pin the backend to a specific model. Make sure the model matches what Claude Code is configured to use.

   ```bash
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: anthropic
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         anthropic:
           model: claude-sonnet-4-5-20250929
     policies:
       ai:
         routes:
           '/v1/messages': Messages
           '*': Passthrough
       auth:
         secretRef:
           name: anthropic-secret
   EOF
   ```
   {{% /tab %}}

   {{< /tabs >}}

   {{< callout type="warning" >}}
   **Route mapping is required.** Without `'/v1/messages': Messages`, Claude Code traffic is treated as passthrough and LLM policies do not apply.
   {{< /callout >}}

   {{< callout type="warning" >}}
   **Model selection matters.** If you specify a model in the backend but Claude Code uses a different model, you may get a `400` error. Use `anthropic: {}` to allow any model, or match the model exactly.
   {{< /callout >}}

{{< doc-test paths="claude-code-k8s" >}}
YAMLTest -f - <<'EOF'
- name: wait for anthropic backend to be accepted
  wait:
    target:
      kind: AgentgatewayBackend
      apiVersion: agentgateway.dev/v1alpha1
      metadata:
        namespace: agentgateway-system
        name: anthropic
    jsonPath: "$.status.conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 5
EOF
{{< /doc-test >}}

3. Create an HTTPRoute to forward all traffic to the Anthropic backend.

   ```bash {paths="claude-code-k8s"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: claude
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
       - matches:
         - path:
             type: PathPrefix
             value: /
         backendRefs:
         - name: anthropic
           namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
           group: agentgateway.dev
           kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

   This route uses a `/` path prefix so that all requests, including `/v1/messages` and `/v1/models`, are forwarded to the backend.

{{< doc-test paths="claude-code-k8s" >}}
YAMLTest -f - <<'EOF'
- name: wait for claude HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: claude
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 5
EOF
{{< /doc-test >}}

{{< doc-test paths="claude-code-k8s" >}}
for i in $(seq 1 60); do
  curl -s --max-time 5 -o /dev/null -w "%{http_code}" -X POST "http://${INGRESS_GW_ADDRESS}:80/v1/messages" -H "Content-Type: application/json" -d '{"model":"claude-haiku-4-5-20251001","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}' && break
  sleep 2
done
{{< /doc-test >}}

{{< doc-test paths="claude-code-k8s" >}}
YAMLTest -f - <<'EOF'
- name: verify Anthropic messages endpoint is routed through gateway
  retries: 1
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80"
    path: /v1/messages
    method: POST
    headers:
      Content-Type: application/json
    body: '{"model":"claude-haiku-4-5-20251001","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
  source:
    type: local
  expect:
    statusCode: 401
EOF
{{< /doc-test >}}

## Configure Claude Code

Set the `ANTHROPIC_BASE_URL` environment variable to point Claude Code at your gateway address.

{{< tabs items="LoadBalancer,Port-forward" >}}

{{% tab tabName="LoadBalancer" %}}
```bash
export ANTHROPIC_BASE_URL="http://$INGRESS_GW_ADDRESS"
```
{{% /tab %}}

{{% tab tabName="Port-forward" %}}
```bash
kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/agentgateway-proxy 8080:80 &
export ANTHROPIC_BASE_URL="http://localhost:8080"
```
{{% /tab %}}

{{< /tabs >}}

{{< callout type="info" >}}
You do not need to provide the Anthropic API key to Claude Code. The credentials are configured in agentgateway. Claude Code only needs `ANTHROPIC_BASE_URL` to redirect its traffic.
{{< /callout >}}

## Verify the connection

1. Send a single test prompt through agentgateway.

   ```bash
   claude -p "Hello"
   ```

2. Verify the request appears in the agentgateway proxy logs.

   ```bash
   kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --tail=5
   ```

   Example output:

   ```
   info  request gateway=agentgateway-system/agentgateway-proxy listener=http route=agentgateway-system/claude endpoint=api.anthropic.com:443 http.method=POST http.path=/v1/messages http.status=200 protocol=llm gen_ai.provider.name=anthropic gen_ai.request.model=claude-haiku-4-5-20251001 gen_ai.usage.input_tokens=14 gen_ai.usage.output_tokens=9 duration=706ms
   ```

3. Optionally, start Claude Code in interactive mode.

   ```bash
   claude
   ```

   Every request, including prompts, tool calls, and file reads, flows through agentgateway.

{{< doc-test paths="claude-code-k8s" >}}
kubectl delete agentgatewaybackend anthropic -n agentgateway-system --ignore-not-found
kubectl delete httproute claude -n agentgateway-system --ignore-not-found
kubectl delete secret anthropic-secret -n agentgateway-system --ignore-not-found
{{< /doc-test >}}

## Next steps

{{< cards >}}
  {{< card path="/tutorials/claude-code-proxy" title="Claude Code Proxy Tutorial" subtitle="Full walkthrough with prompt guards and observability" >}}
  {{< card path="/llm/providers/anthropic" title="Anthropic Provider" subtitle="Complete Anthropic provider configuration" >}}
  {{< card path="/tutorials/ai-prompt-guard" title="AI Prompt Guard" subtitle="Block sensitive content in prompts" >}}
{{< /cards >}}
