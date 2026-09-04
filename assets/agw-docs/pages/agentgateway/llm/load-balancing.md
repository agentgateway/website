Distribute requests across multiple LLM providers automatically (also known as Power of Two Choices, or P2C).

{{< version exclude-if="1.3.x,1.2.x,1.1.x" >}}
> [!NOTE]
> **Model-centric alternative**: To split traffic across models by weight, you can also use the experimental `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` API with `virtualModel.weighted`. For more information, see [Virtual models]({{< link-hextra path="/llm/models/virtual/" >}}).
{{< /version >}}

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


## Load balancing across Pod replicas {#pod-replicas}

When you register an LLM provider backend that points at an in-cluster Kubernetes Service with multiple Pod replicas behind it, the load balancing behavior depends on how the backend is configured.

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,2.2.x" >}}
> [!NOTE]
> This section covers the `host` and `port` fields of an **LLM provider**, not Kubernetes Services in general. When an HTTPRoute routes to a Service directly, the proxy load balances across that Service's endpoints with P2C, for LLM and non-LLM traffic alike. See [Load balancing]({{< link-hextra path="/traffic-management/load-balancing/" >}}).
{{< /version >}}

### Using `host`/`port` with a normal ClusterIP Service

When you use the `host` and `port` fields (available on all provider types) to point at a normal Kubernetes Service with a `ClusterIP`, agentgateway resolves the provider to a single target rather than to the Service's endpoints. Load balancing across Pods is therefore left to kube-proxy and its iptables or IPVS rules, and agentgateway's P2C scoring does not apply.

```yaml
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: my-backend
  namespace: agentgateway-system
spec:
  ai:
    provider:
      openai:
        model: my-model
      host: my-llm-service.my-namespace.svc.cluster.local  # Normal ClusterIP Service
      port: 80
```

### Using `host`/`port` with a headless Service

When you point `host`/`port` at a **headless Service** (`clusterIP: None`) backed by multiple pods, agentgateway re-resolves DNS periodically and can distribute traffic across the resolved Pod IPs. However, this is **not health-aware** — agentgateway does not monitor the health of individual Pod endpoints or evict unhealthy ones in this scenario.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-llm-service
  namespace: my-namespace
spec:
  clusterIP: None  # Headless Service
  selector:
    app: my-llm
  ports:
  - port: 8000
    targetPort: 8000
---
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: my-backend
  namespace: agentgateway-system
spec:
  ai:
    provider:
      openai:
        model: my-model
      host: my-llm-service.my-namespace.svc.cluster.local  # Headless Service
      port: 8000
```

### Using `custom` provider with `backendRef` (Recommended)

For **health-aware P2C load balancing** across individual Pod replicas, use the `custom` provider type with the `backendRef` field. Agentgateway resolves the Service's `EndpointSlices` directly and applies its P2C load balancing and health scoring across individual Pods, bypassing kube-proxy entirely.

> [!NOTE]
> The `backendRef` field is only available for the `custom` provider type. Use this approach when you want agentgateway's health-aware load balancing across replicas of a self-hosted LLM backend. Because `backendRef` is namespace-local, the Service must be in the same namespace as the {{< reuse "agw-docs/snippets/backend.md" >}} resource.

1. Create a Service for your LLM backend.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Service
   metadata:
     name: my-llm-service
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     selector:
       app: my-llm
     ports:
     - port: 8000
       targetPort: 8000
       protocol: TCP
   EOF
   ```

2. Create an {{< reuse "agw-docs/snippets/backend.md" >}} using the `custom` provider type with `backendRef`.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: my-backend
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         custom:
           model: my-model
           backendRef:
             name: my-llm-service
             port: 8000
           formats:
           - type: Completions
   EOF
   ```

Agentgateway will automatically discover all Pod endpoints behind the Service and apply its P2C load balancing algorithm with health-aware scoring across them.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
2. Set up [API access to each LLM provider]({{< link-hextra path="/llm/api-keys/" >}}) that you want to use.

{{< doc-test paths="load-balancing" >}}
export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: openai-secret
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
type: Opaque
stringData:
  Authorization: $OPENAI_API_KEY
---
apiVersion: v1
kind: Secret
metadata:
  name: anthropic-secret
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
type: Opaque
stringData:
  Authorization: ${ANTHROPIC_API_KEY:-$OPENAI_API_KEY}
EOF
{{< /doc-test >}}

## Load balance across multiple providers {#multiple-providers}

Create a backend with multiple providers in the same priority group to enable load balancing.

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} with multiple providers. In this example, requests are load balanced across OpenAI and Anthropic.

   ```yaml,paths="load-balancing"
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

{{< doc-test paths="load-balancing" >}}
# The documented example load balances across OpenAI and Anthropic. The test
# replaces it with two providers that both point at the httpbun mock LLM, so it
# needs no provider API key at all and bills nothing. The shape under test is the
# same as the documented one - two providers in a single priority group - which is
# what the P2C behavior on this page depends on.
{{< reuse "agw-docs/snippets/deploy-mock-llm.md" >}}
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
            host: httpbun.default.svc.cluster.local
            port: 3090
            path: /llm/chat/completions
            policies:
              auth:
                secretRef:
                  name: openai-secret
          - name: openai-gpt35
            openai:
              model: {{< reuse "agw-docs/snippets/openai-model.md" >}}
            host: httpbun.default.svc.cluster.local
            port: 3090
            path: /llm/chat/completions
            policies:
              auth:
                secretRef:
                  name: openai-secret
EOF
{{< /doc-test >}}

2. Create an HTTPRoute to route traffic to the backend.

   ```yaml,paths="load-balancing"
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

{{< doc-test paths="load-balancing" >}}
YAMLTest -f - <<'EOF'
- name: wait for loadbalanced-backend to be accepted
  wait:
    target:
      kind: AgentgatewayBackend
      metadata:
        namespace: agentgateway-system
        name: loadbalanced-backend
    jsonPath: "$.status.conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 2

- name: wait for loadbalanced-route HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: loadbalanced-route
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 2
EOF
{{< /doc-test >}}

3. Send multiple requests to observe load balancing behavior.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```bash
   for i in {1..10}; do
     curl "$INGRESS_GW_ADDRESS/chat" -H content-type:application/json -d '{
       "messages": [{"role": "user", "content": "Say hello"}]
     }' | jq -r '.model'
   done
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
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

{{< doc-test paths="load-balancing" >}}
YAMLTest -f - <<'EOF'
- name: verify load balanced request succeeds
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/chat"
    method: POST
    headers:
      content-type: application/json
    body: |
      {
        "messages": [{"role": "user", "content": "Say hello in one word"}]
      }
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.usage.total_tokens"
        comparator: greaterThan
        value: 0

- name: verify second load balanced request succeeds
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/chat"
    method: POST
    headers:
      content-type: application/json
    body: |
      {
        "messages": [{"role": "user", "content": "Say hello in one word"}]
      }
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.usage.total_tokens"
        comparator: greaterThan
        value: 0
EOF
{{< /doc-test >}}

## Traffic splitting for A/B testing {#traffic-splitting}

You can use weighted `backendRefs` in HTTPRoute to split traffic for A/B testing or canary deployments. This is useful for comparing model performance or gradually rolling out a new model.

For a complete guide on traffic splitting patterns, see [Traffic splitting]({{< link-hextra path="/traffic-management/traffic-split/" >}}).

1. Create separate {{< reuse "agw-docs/snippets/backend.md" >}} resources for the stable and canary models.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: stable-backend
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
   ---
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: canary-backend
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       groups:
         - providers:
             - name: canary-model
               openai:
                 model: gpt-4o-mini
               policies:
                 auth:
                   secretRef:
                     name: openai-secret
   EOF
   ```

2. Create an HTTPRoute with weighted backend references. This example routes 80% of traffic to the stable model and 20% to the canary model.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: test-route
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
       - matches:
           - path:
               type: PathPrefix
               value: /test
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

   Each backend can contain multiple providers that are load balanced using P2C within that backend, while the HTTPRoute distributes traffic between backends based on the configured weights.

## Known limitations

> [!WARNING]
> **Rate-limit-based eviction only**: Provider eviction and failover currently only trigger on 429 (Too Many Requests) responses with proper rate-limit headers (`Retry-After` or `x-ratelimit-reset`). Eviction does NOT trigger on:
> - 503 Service Unavailable responses
> - Connection refused or timeout errors
> - DNS resolution failures
> - Other error codes (404, 500, etc.)
>
> Providers that return non-429 errors receive degraded health scores (EWMA) and lower priority within their group, but are not evicted or failed over. This means traffic may still be routed to consistently failing providers, though at reduced rates.

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
- Set up [cost tracking]({{< link-hextra path="/llm/cost-controls/cost-tracking/" >}}) to monitor spending across providers
- Use [budget limits]({{< link-hextra path="/llm/cost-controls/budget-limits/" >}}) to control costs per provider or user
