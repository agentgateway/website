Distribute requests across multiple LLM providers automatically (also known as Power of Two Choices, or P2C).

## About load balancing {#about}

Load balancing distributes incoming requests across multiple backend LLM providers to optimize performance, cost, and availability. {{< reuse "agw-docs/snippets/agentgateway.md" >}} uses an intelligent **Power of Two Choices (P2C)** algorithm with health-aware scoring to automatically select the best available provider for each request.

Unlike simple strategies like round-robin or random selection, the P2C algorithm makes smarter routing decisions by:

1. **Selecting two random providers** from the available pool (the same provider can be selected twice, preventing starvation of the lowest-scored endpoint)
2. **Scoring each provider** based on health, latency, and pending requests
3. **Routing to the provider with the better score**

This approach provides superior performance compared to named strategies found in other AI gateways (such as "least-busy," "least-latency," or "cost-based" routing) without requiring you to manually select a strategy.

### How P2C load balancing works

The load balancing algorithm uses several factors to score each provider:

- **Health score (EWMA)**: An exponentially-weighted moving average that tracks success rate. Each successful request records 1.0, each failure records 0.0. Recent results weigh more heavily (α = 0.3). Providers with recent failures receive lower scores.
- **Request latency (EWMA)**: Tracks average response time in seconds using the same EWMA calculation. Only successful requests contribute to latency tracking—failures are not measured to avoid skewing results with fast error responses.
- **Pending requests**: Accounts for the number of active in-flight requests to avoid overloading busy providers. Each pending request adds a 10% penalty to the latency component.
- **Eviction**: Temporarily removes providers that consistently fail or return rate limit errors, moving them to a rejected state until they can be retried.

The final score for each provider is calculated as:

```
score = health / (1 + latency_penalty)
where latency_penalty = request_latency * (1 + pending_requests * 0.1)
```

This scoring mechanism automatically adapts to changing conditions, routing traffic away from slow or failing providers without manual intervention.

### Load balancing within priority groups

When you configure multiple [priority groups]({{< link-hextra path="/llm/failover/" >}}) (for failover or traffic splitting), load balancing applies **within each priority group**. The gateway:

1. Selects the highest-priority group with available providers
2. Uses P2C algorithm to choose the best provider within that group
3. Falls back to the next priority group if all providers in the current group are unavailable

This combines the benefits of automatic intelligent load balancing with explicit priority-based failover control.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
2. Set up [API access to each LLM provider]({{< link-hextra path="/llm/api-keys/" >}}) that you want to use.

## Load balance across multiple providers {#multiple-providers}

Create a backend with multiple providers in the same priority group to enable load balancing.

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} with multiple providers. In this example, requests are load balanced across OpenAI and Anthropic.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: loadbalanced-backend
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       groups:
         - providers:
             - name: openai-gpt4
               openai:
                 model: gpt-4o
               policies:
                 auth:
                   secretRef:
                     name: openai-secret
             - name: anthropic-claude
               anthropic:
                 model: claude-3-5-sonnet-latest
               policies:
                 auth:
                   secretRef:
                     name: anthropic-secret
   EOF
   ```

2. Create an HTTPRoute to route traffic to the backend.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: loadbalanced-route
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /chat
       backendRefs:
       - name: loadbalanced-backend
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

3. Send multiple requests to observe load balancing behavior.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```bash
   for i in {1..10}; do
     curl "$INGRESS_GW_ADDRESS/chat" -H content-type:application/json -d '{
       "messages": [{"role": "user", "content": "Say hello"}]
     }' | jq -r '.model'
   done
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```bash
   for i in {1..10}; do
     curl "localhost:8080/chat" -H content-type:application/json -d '{
       "messages": [{"role": "user", "content": "Say hello"}]
     }' | jq -r '.model'
   done
   ```
   {{% /tab %}}
   {{< /tabs >}}

   You'll see responses from both providers, with the P2C algorithm automatically selecting the best provider for each request based on current health and performance metrics.

## Traffic splitting for A/B testing {#traffic-splitting}

You can use weighted priority groups to split traffic for A/B testing or canary deployments. This is useful for comparing model performance or gradually rolling out a new model.

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} with weighted providers. This example routes 80% of traffic to a stable model and 20% to a new model.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: ab-test-backend
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       groups:
         - providers:
             - name: stable-model
               openai:
                 model: gpt-4o
               policies:
                 auth:
                   secretRef:
                     name: openai-secret
   EOF
   ```

2. Create an HTTPRoute with weighted backend references.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: ab-test-route
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /ab-test
       backendRefs:
       - name: stable-backend
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
         weight: 80
       - name: canary-backend
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
         weight: 20
   EOF
   ```

   Where `stable-backend` and `canary-backend` are separate {{< reuse "agw-docs/snippets/backend.md" >}} resources, each potentially with multiple providers load balanced using P2C.

## Monitoring load balancing

Use [observability features]({{< link-hextra path="/llm/observability/" >}}) to monitor load balancing behavior:

- **Metrics**: Track request counts and latencies per provider
- **Traces**: View which provider handled each request
- **Health scores**: Monitor provider health and eviction events

The gateway automatically exports OpenTelemetry metrics that include provider selection information, allowing you to verify that load balancing is working as expected.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```shell
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} loadbalanced-backend -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete httproute loadbalanced-route -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

## Next steps

- Configure [failover]({{< link-hextra path="/llm/failover/" >}}) with priority groups for high availability
- Set up [cost tracking]({{< link-hextra path="/llm/cost-tracking/" >}}) to monitor spending across providers
- Use [budget limits]({{< link-hextra path="/llm/budget-limits/" >}}) to control costs per provider or user
