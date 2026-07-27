---
title: Virtual models
weight: 30
description: Publish one client-facing model name and route requests across several models with weighted, failover, or conditional routing.
---

Publish one client-facing model name and route requests across several models.

## About

A virtual model is an `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` that sets `spec.virtualModel` instead of `spec.provider`. A virtual model has no provider of its own. Instead, it selects a concrete `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` at request time.

Virtual models let you change which model serves a request without asking clients to change the model name they send. Use them to split traffic during a migration, fail over when a provider degrades, or pick a model based on request context.

Three routing strategies are available, and each virtual model uses exactly one of them.

| Strategy | Selects a target by | Use it for |
|----------|---------------------|------------|
| `weighted` | Relative weight. | Traffic splitting, canary rollouts, and A/B tests. |
| `failover` | Priority group, then health and latency. | Resiliency when a provider degrades. |
| `conditional` | The first CEL expression that evaluates to `true`. | Tiering by header, body, or other request context. |

Targets are usually `Internal` models, so clients cannot request them directly and they stay out of `/v1/models`. For more on visibility, see [About models]({{< link-hextra path="/llm/models/about/" >}}).

> [!NOTE]
> Virtual models must be `Public`, and they cannot set `spec.policies`. Configure policies on the concrete target models instead.

## Before you begin

1. Complete [Serve a model]({{< link-hextra path="/llm/models/serve/" >}}). This guide reuses the `agentgateway-proxy` Gateway and the httpbun mock LLM from that guide, and assumes that the `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` API is enabled.
2. Save the gateway address in an environment variable.

   ```sh
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
   ```

## Create the target models

Create two internal models to route between. Each rewrites the `model` field to a distinct value so that you can tell from the response which target served the request.

```yaml {paths="virtual-models"}
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
metadata:
  name: internal-fast
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
    sectionName: http
  visibility: Internal
  provider: OpenAI
  baseURL: http://httpbun.default.svc.cluster.local:3090/llm
  policies:
    transformations:
    - field: model
      expression: '"resolved-internal-fast"'
---
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
metadata:
  name: internal-premium
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
    sectionName: http
  visibility: Internal
  provider: OpenAI
  baseURL: http://httpbun.default.svc.cluster.local:3090/llm
  policies:
    transformations:
    - field: model
      expression: '"resolved-internal-premium"'
EOF
```

Verify that neither model can be requested directly.

```sh
curl -s -X POST http://$INGRESS_GW_ADDRESS/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "internal-fast", "messages": []}'
```

Example output:

```json
{"error":{"message":"Model not found","type":"invalid_request_error","code":"model_not_found"}}
```

## Split traffic with weighted routing

Use `virtualModel.weighted` to distribute requests across targets by relative weight.

1. Create a virtual model that sends 80% of requests to `internal-fast` and 20% to `internal-premium`.

   ```yaml {paths="virtual-models"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: balanced
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     virtualModel:
       weighted:
         targets:
         - modelRef:
             name: internal-fast
           weight: 80
         - modelRef:
             name: internal-premium
           weight: 20
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API docs]({{< link-hextra path="/reference/api/#agentgatewaymodelspec" >}}).

   | Field | Value | Description |
   |-------|-------|-------------|
   | `targets[].modelRef.name` | `internal-fast` | An `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` in the same namespace. Cross-namespace references are not supported. |
   | `targets[].weight` | `80` | Relative weight, not a percentage. Weights are normalized across targets. Defaults to `1`. |

   > [!NOTE]
   > When `modelRef` points to a model with a wildcard `match.model`, also set `targets[].model` to the concrete name to request through it, such as `openai/gpt-5-mini`. Otherwise, the target's exact `match.model` value is used.

2. Send several requests and count which target served each one.

   ```sh
   for i in $(seq 60); do
     curl -s -X POST http://$INGRESS_GW_ADDRESS/v1/chat/completions \
       -H "Content-Type: application/json" \
       -d '{"model": "balanced", "messages": [], "httpbun": {"content": "hi"}}' \
       | grep -o '"model":"[^"]*"'
   done | sort | uniq -c
   ```

   Example output. The exact split varies between runs, and it converges on 80/20 as the number of requests grows.

   ```
     46 "model":"resolved-internal-fast"
     14 "model":"resolved-internal-premium"
   ```

## Choose a model by request context

Use `virtualModel.conditional` to select a target with a CEL expression. Targets are evaluated in order, and the first match wins.

1. Create a virtual model that routes premium clients to `internal-premium` and everyone else to `internal-fast`.

   ```yaml {paths="virtual-models"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: smart
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     virtualModel:
       conditional:
         targets:
         - when: 'request.headers["x-model-tier"] == "premium"'
           modelRef:
             name: internal-premium
         - modelRef:
             name: internal-fast
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API docs]({{< link-hextra path="/reference/api/#agentgatewaymodelspec" >}}).

   | Field | Value | Description |
   |-------|-------|-------------|
   | `targets[].when` | `request.headers["x-model-tier"] == "premium"` | A CEL expression that must evaluate to `true` for the target to be selected. For the fields you can use, see the [CEL reference]({{< link-hextra path="/reference/cel/" >}}). |
   | `targets[1]` | No `when` field | The fallback. Only one target can omit `when`, and it must be last. Without a fallback, a request that matches no condition fails. |

2. Send a request with the premium header.

   ```sh
   curl -s -X POST http://$INGRESS_GW_ADDRESS/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "x-model-tier: premium" \
     -d '{"model": "smart", "messages": [], "httpbun": {"content": "hi"}}'
   ```

   Example output:

   ```json
   {"model":"resolved-internal-premium","usage":{"prompt_tokens":0,"completion_tokens":1,"total_tokens":1},"choices":[{"message":{"content":"hi","role":"assistant"},"finish_reason":"stop","index":0}],"object":"chat.completion"}
   ```

3. Send a request without the header. The fallback target serves it.

   ```sh
   curl -s -X POST http://$INGRESS_GW_ADDRESS/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{"model": "smart", "messages": [], "httpbun": {"content": "hi"}}'
   ```

   Example output:

   ```json
   {"model":"resolved-internal-fast","usage":{"prompt_tokens":0,"completion_tokens":1,"total_tokens":1},"choices":[{"message":{"content":"hi","role":"assistant"},"finish_reason":"stop","index":0}],"object":"chat.completion"}
   ```

## Fail over when a model degrades

Use `virtualModel.failover` to group targets by priority. Lower values are preferred. Targets in the same priority group are selected by a score that considers health and latency. The next group is used only when every target in the current group is degraded.

Failover depends on eviction. Configure `policies.health` on the concrete target models to define when a target is evicted. Without a health policy, targets are never evicted and failover does not occur.

1. Create a model that points at an address with no backing workload, so that requests to it always fail. In a real deployment, the target would be a healthy primary provider.

   ```yaml {paths="virtual-models"}
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Service
   metadata:
     name: unreachable-llm
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     selector:
       app: does-not-exist
     ports:
     - port: 9235
       targetPort: 9235
   ---
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: primary-down
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     visibility: Internal
     provider: OpenAI
     baseURL: http://unreachable-llm.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local:9235
     policies:
       health:
         eviction:
           consecutiveFailures: 1
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Field | Value | Description |
   |-------|-------|-------------|
   | `policies.health.eviction.consecutiveFailures` | `1` | Evicts the target after a single failure. Production values are typically higher. Use `policies.health.unhealthyCondition` to also treat specific responses, such as `response.code >= 500`, as failures. |

2. Create a virtual model that prefers `primary-down` and falls back to `internal-fast`.

   ```yaml {paths="virtual-models"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: resilient
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     virtualModel:
       failover:
         targets:
         - modelRef:
             name: primary-down
           priority: 0
         - modelRef:
             name: internal-fast
           priority: 1
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Field | Value | Description |
   |-------|-------|-------------|
   | `targets[].priority` | `0` | Lower values are preferred. Give several targets the same priority to load balance across them within a group. |

3. Send three requests in a row.

   ```sh
   for i in 1 2 3; do
     curl -s -X POST http://$INGRESS_GW_ADDRESS/v1/chat/completions \
       -H "Content-Type: application/json" \
       -d '{"model": "resilient", "messages": [], "httpbun": {"content": "hi"}}'
     echo
   done
   ```

   Example output. The first request fails and evicts `primary-down`. Later requests are served by the priority 1 target.

   ```
   upstream call failed: Connect: Connection refused (os error 111)
   {"model":"resolved-internal-fast","usage":{"prompt_tokens":0,"completion_tokens":1,"total_tokens":1},"choices":[{"message":{"content":"hi","role":"assistant"},"finish_reason":"stop","index":0}],"object":"chat.completion"}
   {"model":"resolved-internal-fast","usage":{"prompt_tokens":0,"completion_tokens":1,"total_tokens":1},"choices":[{"message":{"content":"hi","role":"assistant"},"finish_reason":"stop","index":0}],"object":"chat.completion"}
   ```

   > [!WARNING]
   > Failover is not a per-request retry. The request that triggers eviction still fails and returns an error to the client, and only later requests route to the next priority group. Evicted targets are restored after the eviction duration expires. To retry a failed request, configure a retry policy on the Gateway with an {{< reuse "agw-docs/snippets/policy.md" >}}.

## Verify model discovery

Only the virtual models appear in discovery. The internal targets are hidden.

```sh
curl -s http://$INGRESS_GW_ADDRESS/v1/models
```

Example output:

```json
{
  "data": [
    {"id": "balanced", "object": "model", "created": 1785166485, "owned_by": "openai"},
    {"id": "resilient", "object": "model", "created": 1785166485, "owned_by": "openai"},
    {"id": "smart", "object": "model", "created": 1785166485, "owned_by": "openai"}
  ],
  "object": "list"
}
```

## Cleanup

```sh
kubectl delete agentgatewaymodel balanced smart resilient internal-fast internal-premium primary-down -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete service unreachable-llm -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
