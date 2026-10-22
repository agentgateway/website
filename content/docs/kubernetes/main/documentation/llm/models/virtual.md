---
title: Virtual models
weight: 30
description: Publish one client-facing model name and route requests across several models with weighted, failover, conditional, or callout routing.
test:
  virtual-models:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/integrations/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: ${versionRoot}/documentation/llm/models/serve.md
    path: serve-model
  - path: virtual-models
---

Publish one client-facing model name and route requests across several models.

## About

A virtual model is an `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` that sets `spec.virtualModel` instead of `spec.provider`. A virtual model has no provider of its own. Instead, it selects a concrete `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` at request time.

Virtual models let you change which model serves a request without asking clients to change the model name they send. Use them to split traffic during a migration, fail over when a provider degrades, or pick a model based on request context. You can also delegate model selection to an HTTP service.

Four routing strategies are available, and each virtual model uses exactly one of them.

| Strategy | Selects a target by | Use it for |
|----------|---------------------|------------|
| `weighted` | Relative weight. | Traffic splitting, canary rollouts, and A/B tests. |
| `failover` | Priority group, then health and latency. | Resiliency when a provider degrades. |
| `conditional` | The first CEL expression that evaluates to `true`. | Tiering by header, body, or other request context. |
| `callout` | The model name returned by an HTTP service. | Centralized routing logic, tenant-aware model selection, and sticky routing decisions. |

After a virtual model selects a target, the gateway rewrites the request so that the provider receives the selected model. This rewrite applies to JSON request bodies and multipart form data, such as `/v1/audio/transcriptions`. For multipart requests, file fields and non-model fields are preserved while each `model` form field is rewritten.

To see which target served a request, check the access log or the trace span. The `agw.ai.original_model` attribute records the virtual model name that the client sent, and `gen_ai.request.model` records the model that the selected target sends to the provider. For more information, see [Generative AI attributes]({{< link-hextra path="/documentation/observability/traces/attribute-reference/#generative-ai-attributes-llm" >}}).

Targets are usually `Internal` models, so clients cannot request them directly and they stay out of `/v1/models`. For more on visibility, see [About models]({{< link-hextra path="/documentation/llm/models/about/" >}}).

{{< reuse "agw-docs/snippets/model-exposure-patterns-tip.md" >}}

If a target does not resolve, the control plane still generates the virtual model with the targets that do. The virtual model's status reports the `ResolvedRefs` condition as `False` with the `Invalid` reason, and valid targets keep serving requests. If weighted routing selects an invalid target, the request fails with a `404` and the `virtual_model_target_not_found` error code. If conditional routing matches an invalid target, the request fails the same way instead of falling through to the next target. Failover leaves invalid targets out of its priority groups. If every failover target is invalid, the control plane does not generate the virtual model, and requests for it return `404` with the `model_not_found` error code.

> [!NOTE]
> Virtual models must be `Public`, and they cannot set `spec.policies`. Configure policies on the concrete target models instead.

## Before you begin

1. Complete [Serve a model]({{< link-hextra path="/documentation/llm/models/serve/" >}}). This guide reuses the `agentgateway-proxy` Gateway and the httpbun mock LLM from that guide, and assumes that the `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` API is enabled.
2. Save the gateway address in an environment variable.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
   echo $INGRESS_GW_ADDRESS
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   Use this option if your cluster does not assign an external IP to `LoadBalancer` services, such as a default Kind cluster.

   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80
   ```

   In a separate terminal, point the requests in this guide at the forwarded port.

   ```sh
   export INGRESS_GW_ADDRESS=localhost:8080
   ```
   {{% /tab %}}
   {{< /tabs >}}

## Create the target models

1. Create two internal models to route between. Each rewrites the `model` field to a distinct value so that you can tell from the response which target served the request.

   ```yaml {paths="virtual-models"}
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
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
   apiVersion: agentgateway.dev/v1alpha1
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

2. Verify that neither model can be requested directly. Because both models set `visibility: Internal`, a direct request returns an error.

   ```sh
   curl -s -X POST http://$INGRESS_GW_ADDRESS/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{"model": "internal-fast", "messages": []}'
   ```

   Example output:

   ```json
   {"error":{"message":"Model not found","type":"invalid_request_error","code":"model_not_found"}}
   ```

   {{< doc-test paths="virtual-models" >}}
   YAMLTest -f - <<'EOF'
   - name: internal models cannot be requested directly
     http:
       url: "http://${INGRESS_GW_ADDRESS}/v1/chat/completions"
       method: POST
       headers:
         Content-Type: application/json
       body: |
         {"model": "internal-fast", "messages": []}
     source:
       type: local
     retries: 3
     expect:
       statusCode: 404
       bodyJsonPath:
         - path: "$.error.code"
           comparator: equals
           value: "model_not_found"
   EOF
   {{< /doc-test >}}

## Split traffic with weighted routing

Use `virtualModel.weighted` to distribute requests across targets by relative weight.

1. Create a virtual model that sends 80% of requests to `internal-fast` and 20% to `internal-premium`.

   ```yaml {paths="virtual-models"}
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
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

   {{< doc-test paths="virtual-models" >}}
   for i in $(seq 1 60); do
     curl -s --max-time 5 -o /dev/null -X POST "http://${INGRESS_GW_ADDRESS}/v1/chat/completions" \
       -H "Content-Type: application/json" \
       -d '{"model":"balanced","messages":[],"httpbun":{"content":"warmup"}}' && break
     sleep 2
   done

   YAMLTest -f - <<'EOF'
   - name: weighted virtual model resolves to one of its targets
     http:
       url: "http://${INGRESS_GW_ADDRESS}/v1/chat/completions"
       method: POST
       headers:
         Content-Type: application/json
       body: |
         {"model": "balanced", "messages": [], "httpbun": {"content": "hi"}}
     source:
       type: local
     retries: 3
     expect:
       statusCode: 200
       bodyJsonPath:
         - path: "$.model"
           comparator: contains
           value: "resolved-internal-"
   EOF
   {{< /doc-test >}}

## Choose a model by request context

Use `virtualModel.conditional` to select a target with a CEL expression. Targets are evaluated in order, and the first match wins.

1. Create a virtual model that routes premium clients to `internal-premium` and everyone else to `internal-fast`.

   ```yaml {paths="virtual-models"}
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
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

   {{< doc-test paths="virtual-models" >}}
   for i in $(seq 1 60); do
     curl -s --max-time 5 -o /dev/null -X POST "http://${INGRESS_GW_ADDRESS}/v1/chat/completions" \
       -H "Content-Type: application/json" -H "x-model-tier: premium" \
       -d '{"model":"smart","messages":[],"httpbun":{"content":"warmup"}}' && break
     sleep 2
   done

   YAMLTest -f - <<'EOF'
   - name: conditional routing selects the premium target on a matching header
     http:
       url: "http://${INGRESS_GW_ADDRESS}/v1/chat/completions"
       method: POST
       headers:
         Content-Type: application/json
         x-model-tier: premium
       body: |
         {"model": "smart", "messages": [], "httpbun": {"content": "hi"}}
     source:
       type: local
     retries: 3
     expect:
       statusCode: 200
       bodyJsonPath:
         - path: "$.model"
           comparator: equals
           value: "resolved-internal-premium"
   EOF
   {{< /doc-test >}}

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

   {{< doc-test paths="virtual-models" >}}
   YAMLTest -f - <<'EOF'
   - name: conditional routing falls back when no condition matches
     http:
       url: "http://${INGRESS_GW_ADDRESS}/v1/chat/completions"
       method: POST
       headers:
         Content-Type: application/json
       body: |
         {"model": "smart", "messages": [], "httpbun": {"content": "hi"}}
     source:
       type: local
     retries: 3
     expect:
       statusCode: 200
       bodyJsonPath:
         - path: "$.model"
           comparator: equals
           value: "resolved-internal-fast"
   EOF
   {{< /doc-test >}}

## Fail over when a model degrades

Use `virtualModel.failover` to group targets by priority. Lower values are preferred. Targets in the same priority group are selected by a score that considers health and latency. The next group is used only when every target in the current group is degraded.

Failover depends on eviction. A virtual model with more than one priority group uses default eviction: a single 5xx response or connection failure evicts a target for 3 seconds, and each repeated eviction lasts longer. To change when a target is evicted, configure `policies.health` on the concrete target models. A health policy replaces the default eviction instead of adding to it, so include an `eviction` block, as in the following example.

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
   apiVersion: agentgateway.dev/v1alpha1
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
   apiVersion: agentgateway.dev/v1alpha1
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
   | `targets[].modelRef.name` | `primary-down` | A concrete model in the same namespace. Failover targets cannot point to another virtual model. |
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

   {{< doc-test paths="virtual-models" >}}
   # Wait until the virtual model is served at all. The priority 0 target is
   # unreachable, so this request is expected to fail; only the fact that the
   # gateway answers matters here.
   for i in $(seq 1 60); do
     curl -s --max-time 5 -o /dev/null -X POST "http://${INGRESS_GW_ADDRESS}/v1/chat/completions" \
       -H "Content-Type: application/json" \
       -d '{"model":"resilient","messages":[],"httpbun":{"content":"warmup"}}' && break
     sleep 2
   done

   # This request evicts the unreachable priority 0 target. It fails by design,
   # so it is not asserted.
   curl -s -o /dev/null -X POST "http://${INGRESS_GW_ADDRESS}/v1/chat/completions" \
     -H "Content-Type: application/json" \
     -d '{"model":"resilient","messages":[],"httpbun":{"content":"trigger"}}'

   sleep 2

   YAMLTest -f - <<'EOF'
   - name: failover routes to the next priority group after eviction
     http:
       url: "http://${INGRESS_GW_ADDRESS}/v1/chat/completions"
       method: POST
       headers:
         Content-Type: application/json
       body: |
         {"model": "resilient", "messages": [], "httpbun": {"content": "hi"}}
     source:
       type: local
     retries: 3
     expect:
       statusCode: 200
       bodyJsonPath:
         - path: "$.model"
           comparator: equals
           value: "resolved-internal-fast"
   EOF
   {{< /doc-test >}}

   > [!WARNING]
   > Failover is not a per-request retry. The request that triggers eviction still fails and returns an error to the client, and only later requests route to the next priority group. Evicted targets are restored after the eviction duration expires. To retry a failed request, configure a retry policy on the Gateway with an {{< reuse "agw-docs/snippets/policy.md" >}}.

> [!NOTE]
> A failover target can be a concrete model that points to an InferencePool, by setting `spec.provider: Custom` and `spec.custom.backendRef`. In that case, the controller records the virtual model's Gateway as a parent of the InferencePool, in addition to the concrete model's Gateway. The InferencePool status lists both Gateways as parents, and the inference-routing and Endpoint Picker Extension (EPP) policies are generated for both Gateways.

## Choose a model with an HTTP callout {#callout-routing}

Use `virtualModel.callout` to let a routing service select the target model for each request. Use callout routing when the decision depends on logic outside the configuration. For example, a service can score the complexity of the prompt or track the state of an agent session.

For each request to the virtual model, the gateway sends a `POST` request to the routing service. The service must return a `2xx` response with a JSON body. The `transformation` expressions read that response from the `callout` CEL variable, and the `model` expression selects the target. If the callout fails, the fallback model serves the request.

The callout request carries a `content-type` header and only the headers that you set in `headers`. Client request headers, such as `Authorization` or `x-session-id`, are not forwarded. To pass a client header to the routing service, read it in a `headers` expression, such as `x-session-id: request.headers["x-session-id"]`.

In this guide, the httpbun mock LLM stands in for the routing service. Its `/mix` endpoint returns the response that you encode in the URL, so the service always selects `internal-premium` with a `medium` reasoning effort. For routing services that make real decisions, see the [`llm-callout-jev`](https://github.com/agentgateway/agentgateway/tree/main/examples/llm-callout-jev) and [`llm-callout-switchyard`](https://github.com/agentgateway/agentgateway/tree/main/examples/llm-callout-switchyard) examples.

For your own in-cluster routing service, set `backendRef` instead of `url`. A `url` that names a cluster hostname does not get the `Service` policies or load balancing. Keep the following in mind for a `backendRef`:

- A `backendRef` has no path, so the callout goes to `/`. To call another path, set the `:path` pseudo-header in `headers`, such as `":path": '"/v1/route"'`. Each `headers` value is a CEL expression, so quote a literal string twice.
- A `backendRef` in another namespace needs a ReferenceGrant. Without one, the model status reports the error, and every callout fails.

1. Create a virtual model that asks the routing service which model to use and falls back to `internal-fast`.

   ```yaml {paths="virtual-models"}
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: routed
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     virtualModel:
       callout:
         url: http://httpbun.default.svc.cluster.local:3090/mix/s=200/h=content-type:application%2Fjson/b64=eyJtb2RlbCI6ImludGVybmFsLXByZW1pdW0iLCJyZWFzb25pbmdfZWZmb3J0IjoibWVkaXVtIn0=
         body: '{"messages": llmRequest.messages}'
         transformation:
           model: callout.body.model
           reasoning_effort: callout.body.reasoning_effort
         fallback:
           modelRef:
             name: internal-fast
         cache:
           key:
           - request.headers["x-session-id"]
           ttl: 10m
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API docs]({{< link-hextra path="/reference/api/#agentgatewaymodelspec" >}}).

   | Field | Value | Description |
   |-------|-------|-------------|
   | `url` | The httpbun `/mix` endpoint | The URL of the routing service, including the path. An `https` URL turns on TLS. In this guide, the URL encodes the response that httpbun returns: status `200`, an `application/json` `content-type` header, and the base64-encoded body `{"model":"internal-premium","reasoning_effort":"medium"}`. Set exactly one of `url` or `backendRef`. |
   | `body` | `{"messages": llmRequest.messages}` | A CEL expression that builds the callout request body. `llmRequest` is the client's JSON request body. A string or bytes value is sent as is, and any other value is sent as JSON. If you omit `body`, the routing service receives the original request body. |
   | `transformation.model` | `callout.body.model` | Required. A CEL expression that returns the target model name as a string. `callout.body` is the decoded JSON response body and `callout.headers` holds the response headers. The routing service must return the model name that the target matches. That name is the target's `match.model` value or the target's resource name when `match.model` is not set. In this guide, the names are `internal-fast` and `internal-premium`. The target must be attached to the same parent as the virtual model. |
   | `transformation.reasoning_effort` | `callout.body.reasoning_effort` | Optional. Each key other than `model` sets that field in the request body and overrides the client's value. If the expression fails, such as when the response does not contain the field, the field is removed from the request. These keys apply only to requests that carry the model in a JSON body. |
   | `fallback.modelRef.name` | `internal-fast` | Optional. A model in the same namespace that serves the request when the callout fails. A callout fails when the service cannot be reached or does not respond within 10 seconds, when the response is not `2xx` or not JSON, when the `model` expression fails, or when the selected model does not exist. The fallback model gets the request without the `transformation` changes. If you omit `fallback`, a failed callout returns a `503` response with the `virtual_model_callout_failed` error code. |
   | `fallback.model` | Not set | Optional. The concrete model name to use from the referenced model. Set `model` when `modelRef` points to a model with a wildcard `match.model`, such as `internal-*`. Without it, the virtual model reports `ResolvedRefs: False`, and a failed callout returns `503`. The name must match the referenced model's `match.model`. Otherwise, a failed callout returns `404` with the `virtual_model_target_not_found` error code instead of using the fallback. |
   | `cache.key` | `request.headers["x-session-id"]` | One or more CEL expressions that make up the cache key. Requests with the same key reuse the first response, so a session identifier keeps a session on one model. If a key expression fails, such as when the header is missing, the response is not cached. On a cache hit, `transformation` runs against the cached response. To limit the cache size, set `cache.maxEntries`, which defaults to `10000`. |
   | `cache.ttl` | `10m` | How long a cached response is reused. Set a duration string, or a CEL expression that can read `callout` and returns a duration or the time at which the response expires. |

2. Send a request with a session header. The routing service selects `internal-premium` and sets `reasoning_effort` to `medium`, so the response shows `resolved-internal-premium`. Later requests with the same `x-session-id` header reuse this routing response for 10 minutes without another callout.

   ```sh
   curl -s -X POST http://$INGRESS_GW_ADDRESS/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "x-session-id: session-1" \
     -d '{"model": "routed", "messages": [], "httpbun": {"content": "hi"}}'
   ```

   Example output:

   ```json
   {"model":"resolved-internal-premium","usage":{"prompt_tokens":0,"completion_tokens":1,"total_tokens":1},"choices":[{"message":{"content":"hi","role":"assistant"},"finish_reason":"stop","index":0}],"object":"chat.completion"}
   ```

   {{< doc-test paths="virtual-models" >}}
   for i in $(seq 1 60); do
     curl -s --max-time 15 -o /dev/null -X POST "http://${INGRESS_GW_ADDRESS}/v1/chat/completions" \
       -H "Content-Type: application/json" \
       -d '{"model":"routed","messages":[],"httpbun":{"content":"warmup"}}' && break
     sleep 2
   done

   YAMLTest -f - <<'EOF'
   - name: callout routing selects the model that the routing service returns
     http:
       url: "http://${INGRESS_GW_ADDRESS}/v1/chat/completions"
       method: POST
       headers:
         Content-Type: application/json
         x-session-id: session-1
       body: |
         {"model": "routed", "messages": [], "httpbun": {"content": "hi"}}
     source:
       type: local
     retries: 3
     expect:
       statusCode: 200
       bodyJsonPath:
         - path: "$.model"
           comparator: equals
           value: "resolved-internal-premium"
   EOF
   {{< /doc-test >}}

3. To make the callout fail, point the callout URL at the httpbun `/status/503` endpoint, which returns a `503` response.

   ```sh {paths="virtual-models"}
   kubectl patch {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} routed -n {{< reuse "agw-docs/snippets/namespace.md" >}} --type=json \
     -p='[{"op": "replace", "path": "/spec/virtualModel/callout/url", "value": "http://httpbun.default.svc.cluster.local:3090/status/503"}]'
   ```

4. Send the request again. Changing the virtual model's spec clears its cached routing responses, so the same session sends a new callout. Changes to other models and metadata-only changes, such as labels, keep the cache. The callout fails, and the fallback model serves the request.

   ```sh
   curl -s -X POST http://$INGRESS_GW_ADDRESS/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "x-session-id: session-1" \
     -d '{"model": "routed", "messages": [], "httpbun": {"content": "hi"}}'
   ```

   Example output:

   ```json
   {"model":"resolved-internal-fast","usage":{"prompt_tokens":0,"completion_tokens":1,"total_tokens":1},"choices":[{"message":{"content":"hi","role":"assistant"},"finish_reason":"stop","index":0}],"object":"chat.completion"}
   ```

   {{< doc-test paths="virtual-models" >}}
   for i in $(seq 1 60); do
     curl -s --max-time 15 -o /dev/null -X POST "http://${INGRESS_GW_ADDRESS}/v1/chat/completions" \
       -H "Content-Type: application/json" \
       -d '{"model":"routed","messages":[],"httpbun":{"content":"warmup"}}' && break
     sleep 2
   done

   YAMLTest -f - <<'EOF'
   - name: callout routing falls back when the routing service fails
     http:
       url: "http://${INGRESS_GW_ADDRESS}/v1/chat/completions"
       method: POST
       headers:
         Content-Type: application/json
         x-session-id: session-1
       body: |
         {"model": "routed", "messages": [], "httpbun": {"content": "hi"}}
     source:
       type: local
     retries: 3
     expect:
       statusCode: 200
       bodyJsonPath:
         - path: "$.model"
           comparator: equals
           value: "resolved-internal-fast"
   EOF
   {{< /doc-test >}}

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
    {"id": "routed", "object": "model", "created": 1785166485, "owned_by": "openai"},
    {"id": "smart", "object": "model", "created": 1785166485, "owned_by": "openai"}
  ],
  "object": "list"
}
```

{{< doc-test paths="virtual-models" >}}
# Assert on the raw /v1/models body instead of YAMLTest bodyJsonPath: YAMLTest's
# "$.data[*].id" only evaluates the first array element, and the serve-model
# prerequisite also registers gpt-4/gpt-5-mini, so a JSONPath `contains` cannot
# reach the virtual model IDs. Grep the response so we can verify every virtual
# model is listed and that the Internal targets stay hidden.
for i in $(seq 1 30); do
  models=$(curl -s "http://${INGRESS_GW_ADDRESS}/v1/models")
  if echo "$models" | grep -q '"balanced"' && echo "$models" | grep -q '"resilient"' && echo "$models" | grep -q '"routed"' && echo "$models" | grep -q '"smart"'; then break; fi
  sleep 2
done
echo "$models"
echo "$models" | grep -q '"balanced"'
echo "$models" | grep -q '"resilient"'
echo "$models" | grep -q '"routed"'
echo "$models" | grep -q '"smart"'
if echo "$models" | grep -qE '"(internal-fast|internal-premium|primary-down|unreachable-llm)"'; then
  echo "ERROR: an Internal model target appeared in /v1/models"; exit 1
fi
{{< /doc-test >}}

## Cleanup

```sh
kubectl delete agentgatewaymodel balanced smart resilient routed internal-fast internal-premium primary-down -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete service unreachable-llm -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
