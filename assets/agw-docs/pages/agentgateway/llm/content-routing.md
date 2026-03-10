Route requests to different LLM backends based on request body content, such as the requested model name.

## About content-based routing {#about}

Content-based routing (also known as body-based routing or intelligent routing) allows you to route requests to different backends based on the content of the request body, not just headers or path. This is particularly useful for LLM applications where you want to route to different providers based on the `model` field in the request JSON.

For example, you might want to:
- Route `gpt-4` requests to OpenAI and `claude-3` requests to Anthropic
- Direct certain models to specific backend endpoints based on cost or performance
- Route different model families to dedicated infrastructure

{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} implements content-based routing by using route-level transformations to extract values from the request body into headers, then using header-based routing rules to select the appropriate backend.

### How it works

Content-based routing works in two steps:

1. **Extract body field to header**: Use a transformation policy on each route to extract a field from the JSON request body (like `model`) into a custom header
2. **Match on header**: Use standard header matching in the HTTPRoute to route based on that header value

This pattern lets you route based on any field in the request body while using the standard Gateway API routing capabilities.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
2. Set up [API access to each LLM provider]({{< link-hextra path="/llm/api-keys/" >}}) that you want to route to.

## Route by model name {#model-routing}

This example shows how to route requests to different backends based on the `model` field in the request body.

1. Create multiple {{< reuse "agw-docs/snippets/backend.md" >}} resources for different models. This example creates backends for OpenAI and Anthropic models.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: openai-backend
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: gpt-4o
       policies:
         auth:
           secretRef:
             name: openai-secret
   ---
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: anthropic-backend
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         anthropic:
           model: claude-3-5-sonnet-latest
       policies:
         auth:
           secretRef:
             name: anthropic-secret
   EOF
   ```

2. Create an HTTPRoute with multiple rules that match on the `x-model` header. The transformation policy (created in step 3) will extract the model name from the request body into this header.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: content-routing
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     # Route GPT models to OpenAI
     - matches:
       - path:
           type: PathPrefix
           value: /v1/chat/completions
         headers:
         - type: RegularExpression
           name: x-model
           value: "^gpt-.*"
       backendRefs:
       - name: openai-backend
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
     # Route Claude models to Anthropic
     - matches:
       - path:
           type: PathPrefix
           value: /v1/chat/completions
         headers:
         - type: RegularExpression
           name: x-model
           value: "^claude-.*"
       backendRefs:
       - name: anthropic-backend
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

3. Create a {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource to extract the `model` field from the request body into the `x-model` header. The transformation uses a CEL expression to parse the JSON body and extract the model field. This policy targets the HTTPRoute and applies to all rules.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: extract-model
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: content-routing
     traffic:
       transformation:
         request:
           set:
           - name: "x-model"
             value: 'json(request.body).model'
   EOF
   ```

4. Send a request with `gpt-4o` in the model field. Verify that the request routes to the OpenAI backend.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```bash
   curl "$INGRESS_GW_ADDRESS/v1/chat/completions" -H content-type:application/json -d '{
     "model": "gpt-4o",
     "messages": [{"role": "user", "content": "Say hello"}]
   }' | jq -r '.model'
   ```

   Example output:
   ```
   gpt-4o-2024-08-06
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```bash
   curl "localhost:8080/v1/chat/completions" -H content-type:application/json -d '{
     "model": "gpt-4o",
     "messages": [{"role": "user", "content": "Say hello"}]
   }' | jq -r '.model'
   ```

   Example output:
   ```
   gpt-4o-2024-08-06
   ```
   {{% /tab %}}
   {{< /tabs >}}

5. Send a request with `claude-3-5-sonnet-latest` in the model field. Verify that the request routes to the Anthropic backend.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```bash
   curl "$INGRESS_GW_ADDRESS/v1/chat/completions" -H content-type:application/json -d '{
     "model": "claude-3-5-sonnet-latest",
     "messages": [{"role": "user", "content": "Say hello"}]
   }' | jq -r '.model'
   ```

   Example output:
   ```
   claude-3-5-sonnet-20241022
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```bash
   curl "localhost:8080/v1/chat/completions" -H content-type:application/json -d '{
     "model": "claude-3-5-sonnet-latest",
     "messages": [{"role": "user", "content": "Say hello"}]
   }' | jq -r '.model'
   ```

   Example output:
   ```
   claude-3-5-sonnet-20241022
   ```
   {{% /tab %}}
   {{< /tabs >}}

## Route by custom field {#custom-field}

You can extract any field from the request body for routing decisions, not just the `model` field.

This example shows routing based on a custom `priority` field in the request body to route high-priority requests to dedicated infrastructure.

1. Create backends for different priority levels.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: high-priority-backend
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: gpt-4o
       policies:
         auth:
           secretRef:
             name: openai-secret
   ---
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: standard-priority-backend
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: gpt-4o-mini
       policies:
         auth:
           secretRef:
             name: openai-secret
   EOF
   ```

2. Create an HTTPRoute with rules that extract a custom field (like `priority` or `user_tier`) from the request body.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: priority-routing
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /v1/chat/completions
         headers:
         - type: Exact
           name: x-priority
           value: "high"
       filters:
       - type: ExtensionRef
         extensionRef:
           group: {{< reuse "agw-docs/snippets/trafficpolicy-group.md" >}}
           kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
           name: extract-priority
       backendRefs:
       - name: high-priority-backend
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
     - matches:
       - path:
           type: PathPrefix
           value: /v1/chat/completions
       filters:
       - type: ExtensionRef
         extensionRef:
           group: {{< reuse "agw-docs/snippets/trafficpolicy-group.md" >}}
           kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
           name: extract-priority
       backendRefs:
       - name: standard-priority-backend
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

3. Create a {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} to extract the custom field. Use the `has()` macro to provide a default value if the field is not present.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: extract-priority
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: priority-routing
     traffic:
       transformation:
         request:
           set:
           - name: "x-priority"
             value: 'has(json(request.body).priority) ? json(request.body).priority : "standard"'
   EOF
   ```

4. Test the routing by sending requests with different priority values.

   {{< tabs tabTotal="2" items="High priority,Standard priority" >}}
   {{% tab tabName="High priority" %}}
   ```bash
   curl "localhost:8080/v1/chat/completions" -H content-type:application/json -d '{
     "model": "gpt-4o",
     "priority": "high",
     "messages": [{"role": "user", "content": "Urgent request"}]
   }' | jq -r '.model'
   ```

   Routes to the high-priority backend using `gpt-4o`.
   {{% /tab %}}
   {{% tab tabName="Standard priority" %}}
   ```bash
   curl "localhost:8080/v1/chat/completions" -H content-type:application/json -d '{
     "model": "gpt-4o",
     "messages": [{"role": "user", "content": "Normal request"}]
   }' | jq -r '.model'
   ```

   Routes to the standard-priority backend using `gpt-4o-mini`.
   {{% /tab %}}
   {{< /tabs >}}

## Known limitations {#limitations}

When implementing content-based routing, be aware of these limitations:

{{< callout type="warning" >}}
**Route-level transformations only**: Use transformations at the route level (via `filters`), not at the Gateway level. Gateway-scoped PreRouting transformations can break header-based routing.
{{< /callout >}}

- **Performance impact**: Extracting fields from the request body adds processing overhead. For high-throughput scenarios, consider using header-based routing when possible.
- **JSON parsing**: The `json()` CEL function requires valid JSON. Malformed JSON in the request body will cause routing failures.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```shell
kubectl delete httproute content-routing priority-routing -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} extract-model extract-priority -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} openai-backend anthropic-backend high-priority-backend standard-priority-backend -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

## Next steps

- Learn about [transformations]({{< link-hextra path="/traffic-management/transformations/" >}}) for more advanced request manipulation
- Set up [load balancing]({{< link-hextra path="/llm/load-balancing/" >}}) across multiple providers
- Configure [failover]({{< link-hextra path="/llm/failover/" >}}) for high availability
- Use [cost tracking]({{< link-hextra path="/llm/cost-tracking/" >}}) to monitor spending per route
