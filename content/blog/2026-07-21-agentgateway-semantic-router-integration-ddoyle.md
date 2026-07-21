---
title: "Semantic Routing, Assembled: agentgateway and vLLM Semantic Router in Practice"
category: "Deep Dive"
toc: false
publishDate: 2026-07-21
author: "Duncan Doyle"
description: "The previous post showed the cost savings semantic routing can deliver. This one shows how the pieces actually connect: what vLLM Semantic Router is, how agentgateway calls it as an ExtProc, and how to stand up a single-provider routing setup yourself."
---

In our previous post on semantic routing with Agentgateway and vLLM Semantic Router we focussed on the benefits model selection can bring to agentic systems in terms of costs. We demonstrated that by analysing and classifying each prompt, we can send routine work to cheap models, while keeping the frontier models doing the hard stuff. As a result, workloads can be processed ~40% cheaper, without the model consumer ever having to explicitly pick a model. In that post, we treated the router as a black box: agentgateway sends the received prompt to the router, the router picks a model, agentgateway routes the request to the selected model, processes the response and records the conversation's metrics.

This post opens the box. Before we extend the idea of semantic routing to concepts like cross-provider model selection and routing, we need to have a better understanding of the underlying machinery: how agentgateway integrates with vLLM Semantic Router (vSR), how vSR selects the model to route, how that information is communicated back to agentgateway and finally how agentgateway uses this information to route the request to the correct LLM provider (e.g. OpenAI, Anthropic, Gemini) and model.

This blog uses agentgateway and the [`llm-semantic-routing` example](https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing), the same configuration the cost demo layers its measurement harness on top of, a solid starting point for building your own solution. The agentgateway docs give a concise [vLLM Semantic Router integration overview](https://agentgateway.dev/docs/kubernetes/latest/integrations/vllm-semantic-router/). This post is the hands-on companion to it.

## vSR classifies, it does not proxy

The first thing to understand is what vLLM Semantic Router is *not*. It is not a model. It is not a proxy that sits in your data path forwarding tokens. vSR is a **classifier that emits a routing decision**. When agentgateway (or any other system for that matter) hands it a prompt, it extracts various signals from that prompt, e.g. keywords, complexity score, context length. It combines these signals into a score using a concept called _projection_, which maps the score onto a band (a named range of that score such as "low-cost" or "expensive"). Finally, the decision layer applies boolean rules over signals and bands, resolving to a model via the configured selection strategy (priority, confidence, or tier).

agentgateway owns and controls the data path. It receives the client request, applies routing logic and policies (e.g. authentication, authorization, rate limiting) if configured and applicable, calls the model provider, streams the reponse, and, optionally, prices the request against its model-cost catalog and emits telemetry. The router decides, while the gateway enforces and observes.


## ExtProc: the gateway-to-router handshake

So how does a request on the gateway get a decision from the router mid-flight? Through [**external processing (ExtProc)**](https://agentgateway.dev/docs/kubernetes/latest/traffic-management/extproc/#about-external-processing): agentgateway streams a request's headers and body, as well as its response headers and body if enabled, to an external gRPC service mid-flight. It holds the request until that service answers. The service isn't just *consulted*. It receives the real headers and body and can **mutate** them, rewrite headers, replace the request body, or short-circuit the call entirely. agentgateway applies those changes before further processing the request or response.

vSR's *routing decision* happens on the request side of that hook. It receives the prompt in the request body, classifies it, and enriches the request with its decision. It rewrites the `model` field in the body to the model it chose and adds an `x-vsr-selected-model` header (plus diagnostic `x-vsr-*` headers) to the request. agentgateway then forwards the request to the provider with that selected model. Note that vSR is also wired into the response path (note `responseBodyMode: Buffered` in the policy below), which it uses for semantic caching, output safety checks, and token accounting. However, none of that changes the routing decision, which is made based on the prompt alone. vSR speaks this ExtProc protocol on port `50051`, wired up with a single [`AgentgatewayPolicy`](https://agentgateway.dev/docs/kubernetes/latest/reference/api-kubespec/policies/).

Here is the actual request lifecycle for the single-provider setup:

```text
client                    agentgateway                     vSR (ExtProc)          OpenAI
  │  POST /v1/chat/completions   │                              │                    │
  │  { "model": "auto", ... }    │                              │                    │
  ├─────────────────────────────▶│                              │                    │
  │                              │  request headers + body      │                    │
  │                              ├─────────────────────────────▶│                    │
  │                              │                              │ vSR:
  │                              │                              │   1. classify prompt
  │                              │                              │   2. rewrite body.model → gpt-5.5
  │                              │                              │   3. add x-vsr-selected-model header
  │                              │  rewritten request           │                    │
  │                              │◀─────────────────────────────┤                    │
  │                              │  forward with chosen model   │                    │
  │                              ├──────────────────────────────┼───────────────────▶│
  │                              │◀─────────────────────────────┼────────────────────┤
  │◀─────────────────────────────┤  price + trace the response  │                    │
```

*(The response also passes back through vSR — for caching, safety, and usage accounting. It is omitted here to keep the routing path clear.)*

The client sends `model: "auto"`. vSR classifies, rewrites `model` in the request body to the model it chose, and adds an `x-vsr-selected-model` header to the request. agentgateway then forwards the request to OpenAI with the chosen model. The client never picked a model, and the gateway never had to understand the prompt.

## A 101 deployment

The example consists of three agentgateway objects plus a [vSR Helm release](https://vllm-sr.ai/docs/installation/k8s/agentgateway/), which deploys the vSR ExtProc server. It assumes you already have a working agentgateway LLM path, a proxy, an `openai-secret`, and optionally, a [model-cost catalog](https://agentgateway.dev/docs/kubernetes/main/llm/cost-controls/costs/), and an [OpenTelemetry stack](https://agentgateway.dev/docs/kubernetes/main/observability/otel-stack/) (all covered in the [agentgateway docs](https://agentgateway.dev/docs/kubernetes/main/llm/providers/openai/)). With that in place, the routing is small. For a complete, runnable end-to-end setup, see the upstream [`llm-semantic-routing` example](https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing).

### The backend: an OpenAI provider with no model

```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: openai-router-selected
  namespace: agentgateway-system
spec:
  ai:
    provider:
      # No model is pinned here on purpose. vSR selects it per request;
      # agentgateway forwards whatever model ended up in the request body.
      openai: {}
  policies:
    auth:
      secretRef:
        name: openai-secret
```

The important detail is the empty `openai: {}`, i.e. no model. In a normal LLM backend you'd name the model. Here the model is a *runtime decision*, so the backend deliberately leaves it open.

### The route: match the LLM paths

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: openai-semantic-routing
  namespace: agentgateway-system
spec:
  parentRefs:
  - { group: gateway.networking.k8s.io, kind: Gateway, name: agentgateway-proxy, namespace: agentgateway-system }
  rules:
  - matches:
    - path: { type: PathPrefix, value: /v1/chat/completions }
    - path: { type: PathPrefix, value: /v1/responses }
    backendRefs:
    - { group: agentgateway.dev, kind: AgentgatewayBackend, name: openai-router-selected, namespace: agentgateway-system }
```

A plain `HTTPRoute`: OpenAI-compatible chat and responses paths, one backend. Nothing about it knows a router exists. 


{{< callout type="info" >}}
If you want to route to different `AgentgatewayBackends`, e.g. because you want to route requests across LLM providers, this `HTTPRoute` would contain multiple rules, at least one per LLM provider. We'll cover dynamic cross-provider LLM routing in a follow-up blog post.
{{< /callout >}}

### The policy: attach vSR as an ExtProc

```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: semantic-router-extproc
  namespace: agentgateway-system
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute            # attached to the route above
    name: openai-semantic-routing
  traffic:
    extProc:
      backendRef:
        name: semantic-router  # vSR's gRPC service
        namespace: agentgateway-system
        port: 50051
      processingOptions:
        requestHeaderMode: Send
        requestBodyMode: FullDuplexStreamed   # vSR needs the prompt body to classify
        responseHeaderMode: Send
        responseBodyMode: Buffered
        allowModeOverride: true
```

This is the whole integration. The policy targets the `HTTPRoute` and points at vSR's ExtProc server. Note what is *absent*: there is no `traffic.phase` configuration defined in the `AgentgatewayPolicy`, so the policy is applied in the default **PostRouting** phase. This means that vSR runs *after* agentgateway has already selected the backend. For a single provider that is completely fine, there is only one backend, so the LLM provider routing decision is never in question. The only thing vSR changes is the `model` field inside the request body. Hold that thought, as it is the exact hinge the next blog post, which discusses cross LLM provider model routing, turns on.

### Configuring vSR: signals → score → decision

vSR's behaviour lives in its Helm values (`semantic-router-values.yaml`). It reads like a small rules engine, and it's worth understanding as a pipeline, because vSR traces its own work with a span per stage (`semantic_router.signal.*` for signal evaluation, `semantic_router.decision.evaluation` for the decision, and `semantic_router.plugin.execution` for the plugin chain). A trace reads back as that same pipeline.

**1. The models it may choose.** vSR keeps its own view of the candidate models, their IDs, pricing, and the backend to reach them:

```yaml
providers:
  models:
  - name: gpt-5.4-nano
    provider_model_id: gpt-5.4-nano
    pricing: { prompt_per_1m: 0.20, completion_per_1m: 1.25 }
  - name: gpt-5.5
    provider_model_id: gpt-5.5
    pricing: { prompt_per_1m: 5.00, completion_per_1m: 30.00 }
```

**2. Signals: the classification inputs.** The example is tuned for coding prompts and combines several signal types: a high-specificity **keyword** list (`distributed rate limiter`, `linearizability`, `TLA+`, `race condition`, …), **embedding** similarity to example intents (routine vs. advanced), a **complexity** score with hard/easy prototype phrases, a **context**-length signal, and **structure** signals (many questions, dense constraints):

```yaml
routing:
  signals:
    keywords:
    - { name: advanced_markers, operator: OR, keywords: [distributed systems, consensus, linearizability, "TLA+", race condition, network partition, ...] }
    embeddings:
    - name: advanced_reasoning_intent
      threshold: 0.68
      candidates:
      - Design a fault-tolerant distributed system and analyze tradeoffs.
      - Find the root cause of a subtle concurrency bug from incomplete logs.
    complexity:
    - { name: needs_advanced_reasoning, threshold: 0.70, hard: {...}, easy: {...} }
```

**3. Projection: collapse signals to a lane.** A weighted sum turns all those signals into one `advanced_need_score`, then a threshold splits it into two lanes:

```yaml
routing:
  projections:
    scores:
    - name: advanced_need_score
      method: weighted_sum
      inputs:
      - { type: keyword,    name: advanced_markers,          weight: 0.45 }
      - { type: embedding,  name: advanced_reasoning_intent, weight: 0.35 }
      - { type: complexity, name: needs_advanced_reasoning:hard, weight: 0.35 }
      - { type: keyword,    name: routine_coding_markers,    weight: -0.10 }  # pushes back toward cheap
    mappings:
    - name: advanced_need_band
      source: advanced_need_score
      outputs:
      - { name: low_cost_lane,  lt:  0.35 }
      - { name: expensive_lane, gte: 0.35 }
```

**4. Decisions: a lane becomes a model.** Finally, each lane maps to a concrete model, by priority:

```yaml
routing:
  decisions:
  - name: route_to_expensive   # priority 200
    rules: { conditions: [{ type: projection, name: expensive_lane }] }
    modelRefs: [{ model: gpt-5.5 }]
  - name: route_to_low_cost    # priority 100 (default)
    rules: { conditions: [{ type: projection, name: low_cost_lane }] }
    modelRefs: [{ model: gpt-5.4-nano }]
```

That is the reasoning the router does on every request: extract signals, score, band, decide. Here each lane maps to a single fixed model. Remember that too! In our cross-provider follow-up blog post we will replace the "one model per lane" concept with "a set of candidate models per lane, cheapest capable one wins."

## Watch it work

With `model: "auto"` and the debug header, the selected model shows up in the response headers:

```bash
curl -sS -i "$GW/v1/chat/completions" -H 'Content-Type: application/json' -H 'X-VSR-Debug: true' \
  -d '{"model":"auto","messages":[{"role":"user","content":"Implement a small Go helper and one table-driven test."}],"max_tokens":64}'
# ...
# x-vsr-selected-model: gpt-5.4-nano
```

Swap the prompt for a distributed-systems design question and the same request comes back `x-vsr-selected-model: gpt-5.5`. Two prompts, one endpoint. There was no model named by the client, and the decision was made entirely from the prompt's content.

Because agentgateway owns the data path, an OpenTelemetry stack shows the concept end to end. agentgateway traces the request and the LLM call, priced against its model-cost catalog, and vSR emits its own spans for signal evaluation, the decision, and the plugin chain. When trace context is propagated across the ExtProc hop, those vSR spans join agentgateway's trace, so a single trace reads as the request walking through the whole pipeline described above.

## Cross-Provider Routing

Look again at what made the single-provider case simple: **there is only one backend, so vSR never has to influence routing and only rewrites `model`.** The ExtProc policy runs PostRouting, *after* the gateway already chose the (only) backend, and that's fine because the choice was never in doubt.

Add a second provider and that stops working. If the router decides a prompt should go to Anthropic, rewriting `model` isn't enough. The request has to be *routed to the Anthropic backend*, and agentgateway makes its routing decision before ExtProc runs. The decision now has to be available *before* the route is selected, and the route has to be able to match on it.

That is exactly what we will cover in our next post, the ability to make routing decisions and route requests across LLM providers, effectively opening the door to the whole model market.

## What you have now

A working semantic-routing setup: a classifier that reads prompts and emits decisions, attached to agentgateway as an ExtProc, steering one provider's model tiers with nothing in application code. That's the foundation. For the reference version of this integration, see the [vLLM Semantic Router integration page](https://agentgateway.dev/docs/kubernetes/latest/integrations/vllm-semantic-router/) in the agentgateway docs. In our next post, we make the same decision choose a *provider*, not just a tier.