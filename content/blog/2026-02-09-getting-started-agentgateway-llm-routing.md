---
title: Getting started with Multi-LLM provider routing
toc: false
publishDate: 2025-07-15T00:00:00-00:00
author: Sebastian
---

# Getting started with Multi-LLM provider routing

> Agentgateway makes it simple to route traffic to multiple LLM providers through a single gateway using the Kubernetes Gateway API. This guide walks through setting up agentgateway OSS on a local Kind cluster with xAI, Anthropic, and OpenAI backends, all routed through a listener named `llm-providers`.

One of the most common patterns in AI-native infrastructure is routing traffic to multiple LLM providers behind a single entry point. Whether you're comparing models, building failover strategies, or just want a unified API across providers, agentgateway gives you a clean Kubernetes-native way to do it using the [Gateway API](https://gateway-api.sigs.k8s.io/) and `AgentgatewayBackend` custom resources.

In this guide, we'll set up a complete working example on a local [Kind](https://kind.sigs.k8s.io/) cluster with three LLM providers routed via path-based `HTTPRoute` resources.

## What you'll build

By the end of this guide you'll have:

* A Kind cluster running the agentgateway control plane
* A `Gateway` with a listener named `llm-providers` on port 8080
* Three `AgentgatewayBackend` resources for xAI, Anthropic, and OpenAI
* Three `HTTPRoute` resources that route `/xai`, `/anthropic`, and `/openai` to their respective backends

{{< reuse-image src="img/blog/llm-provider-routing/architecture-diagram.png" >}}

## Prerequisites

Before getting started, make sure you have the following installed:

* [Docker](https://www.docker.com/) — container runtime for Kind
* [Kind](https://kind.sigs.k8s.io/) — local Kubernetes clusters
* [kubectl](https://kubernetes.io/docs/tasks/tools/) — Kubernetes CLI (within 1 minor version of your cluster)
* [Helm](https://helm.sh/) — Kubernetes package manager

You also need API keys for the LLM providers you want to use. Export them as environment variables:

```shell
export XAI_API_KEY="your-xai-api-key"
export ANTHROPIC_API_KEY="your-anthropic-api-key"
export OPENAI_API_KEY="your-openai-api-key"
```

## Step 1: Create a Kind cluster

Create a local Kubernetes cluster using Kind. This gives you a lightweight, disposable cluster perfect for testing.

```shell
kind create cluster --name agentgateway-demo
```

Verify it's running:

```shell
kubectl cluster-info --context kind-agentgateway-demo
kubectl get nodes
```

## Step 2: Install agentgateway OSS via Helm

### Install the Gateway API CRDs

Agentgateway relies on the Kubernetes Gateway API. Install the standard CRDs:

```shell
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.4.0/standard-install.yaml
```

### Install the agentgateway CRDs

Install the custom resource definitions that agentgateway needs (`AgentgatewayBackend`, `AgentgatewayPolicy`, etc.):

```shell
helm upgrade -i agentgateway-crds \
  oci://ghcr.io/kgateway-dev/charts/agentgateway-crds \
  --create-namespace \
  --namespace agentgateway-system \
  --version v2.2.0-main
```

### Install the agentgateway control plane

```shell
helm upgrade -i agentgateway \
  oci://ghcr.io/kgateway-dev/charts/agentgateway \
  --namespace agentgateway-system \
  --version v2.2.0-main \
  --set controller.image.pullPolicy=Always
```

> The `--set controller.image.pullPolicy=Always` flag is recommended for development builds to ensure you always get the latest image.

Verify the pods are running:

```shell
kubectl get pods -n agentgateway-system
```

You should see the controller pod in a `Running` state.

## Step 3: Create the Gateway

The `Gateway` resource is the entry point for all traffic. It defines a listener named `llm-providers` on port 8080 that accepts `HTTPRoute` resources from any namespace.

```yaml
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: agentgateway-proxy
  namespace: agentgateway-system
spec:
  gatewayClassName: enterprise-agentgateway
  infrastructure:
    parametersRef:
      name: tracing
      group: enterpriseagentgateway.solo.io
      kind: EnterpriseAgentgatewayParameters
  listeners:
  - protocol: HTTP
    port: 8080
    name: llm-providers
    allowedRoutes:
      namespaces:
        from: All
EOF
```

The listener name `llm-providers` is the key here. All `HTTPRoute` resources in the following steps reference this listener via `sectionName`, so the gateway knows which listener should handle each route.

## Step 4: Configure API key secrets

Each LLM provider needs an API key stored as a Kubernetes `Secret`. The `AgentgatewayBackend` resources reference these secrets for authentication.

```yaml
kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: xai-secret
  namespace: agentgateway-system
type: Opaque
stringData:
  Authorization: $XAI_API_KEY
EOF
```

```yaml
kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: anthropic-secret
  namespace: agentgateway-system
type: Opaque
stringData:
  Authorization: $ANTHROPIC_API_KEY
EOF
```

```yaml
kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: openai-secret
  namespace: agentgateway-system
type: Opaque
stringData:
  Authorization: $OPENAI_API_KEY
EOF
```

> Never commit API keys to source control. Use environment variable substitution or a secrets manager in production.

## Step 5: Create agentgateway backends

`AgentgatewayBackend` resources define the LLM provider endpoints. Each backend specifies the provider type, model, and authentication. Agentgateway automatically rewrites requests to the correct chat completion endpoint for each provider.

### xAI backend

xAI uses an OpenAI-compatible API. Because we're specifying a custom host (`api.x.ai`) rather than the default OpenAI host, we need to explicitly set the host, port, path, and TLS SNI.

```yaml
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: xai
  namespace: agentgateway-system
spec:
  ai:
    provider:
      openai:
        model: grok-4-1-fast-reasoning
      host: api.x.ai
      port: 443
      path: "/v1/chat/completions"
  policies:
    auth:
      secretRef:
        name: xai-secret
    tls:
      sni: api.x.ai
EOF
```

### Anthropic backend

Anthropic uses its native provider type. Agentgateway handles the endpoint rewriting automatically — no custom host or TLS configuration needed.

```yaml
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: anthropic
  namespace: agentgateway-system
spec:
  ai:
    provider:
      anthropic:
        model: "claude-sonnet-4-5-20250929"
  policies:
    auth:
      secretRef:
        name: anthropic-secret
EOF
```

### OpenAI backend

OpenAI also uses its native provider type with the default endpoint.

```yaml
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: openai
  namespace: agentgateway-system
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

## Step 6: Create HTTPRoutes

`HTTPRoute` resources connect incoming request paths to the `AgentgatewayBackend` resources. Each route references the `llm-providers` listener on the Gateway via `sectionName`, and matches a path prefix to direct traffic to the correct backend.

| Route | Path | Backend | Provider |
|-------|------|---------|----------|
| xai | `/xai` | xai | xAI (Grok) |
| anthropic | `/anthropic` | anthropic | Anthropic (Claude) |
| openai | `/openai` | openai | OpenAI (GPT) |

### xAI route

```yaml
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: xai
  namespace: agentgateway-system
  labels:
    route-type: llm-provider
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: agentgateway-system
      sectionName: llm-providers
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /xai
    backendRefs:
    - name: xai
      namespace: agentgateway-system
      group: agentgateway.dev
      kind: AgentgatewayBackend
EOF
```

### Anthropic route

```yaml
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: anthropic
  namespace: agentgateway-system
  labels:
    route-type: llm-provider
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: agentgateway-system
      sectionName: llm-providers
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /anthropic
    backendRefs:
    - name: anthropic
      namespace: agentgateway-system
      group: agentgateway.dev
      kind: AgentgatewayBackend
EOF
```

### OpenAI route

```yaml
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: openai
  namespace: agentgateway-system
  labels:
    route-type: llm-provider
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: agentgateway-system
      sectionName: llm-providers
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /openai
    backendRefs:
    - name: openai
      namespace: agentgateway-system
      group: agentgateway.dev
      kind: AgentgatewayBackend
EOF
```

The key fields that tie everything together:

* `parentRefs.sectionName: llm-providers` — binds the route to the specific Gateway listener
* `backendRefs.group: agentgateway.dev` — tells the Gateway API to look for `AgentgatewayBackend` resources (not standard Kubernetes `Service` objects)
* `backendRefs.kind: AgentgatewayBackend` — references the custom backend type
* `labels.route-type: llm-provider` — optional label useful for filtering and grouping

## Step 7: Verify and test

Once all resources are applied, verify everything is connected and working.

### Check resource status

```shell
# Verify the Gateway is accepted
kubectl get gateway -n agentgateway-system

# Verify backends exist
kubectl get agentgatewaybackend -n agentgateway-system

# Verify routes are attached
kubectl get httproute -n agentgateway-system
```

### Port-forward and test

Forward the gateway port to your local machine and send a test request:

```shell
kubectl port-forward -n agentgateway-system \
  svc/agentgateway-proxy 8080:8080 &
```

Test the OpenAI route:

```shell
curl -s http://localhost:8080/openai \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Test the Anthropic route:

```shell
curl -s http://localhost:8080/anthropic \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Test the xAI route:

```shell
curl -s http://localhost:8080/xai \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-4-1-fast-reasoning",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Agentgateway automatically rewrites requests to each provider's chat completion endpoint, so you use a unified request format regardless of the backend provider.

## Cleanup

When you're done, remove everything:

```shell
# Remove routes and backends
kubectl delete httproute xai anthropic openai -n agentgateway-system
kubectl delete agentgatewaybackend xai anthropic openai -n agentgateway-system
kubectl delete secret xai-secret anthropic-secret openai-secret -n agentgateway-system
kubectl delete gateway agentgateway-proxy -n agentgateway-system

# Uninstall Helm charts
helm uninstall agentgateway agentgateway-crds -n agentgateway-system

# Delete the Kind cluster
kind delete cluster --name agentgateway-demo
```

## What's next

Now that you have path-based LLM routing working, there's a lot more you can do with agentgateway:

* **Multiple providers on one route** — group backends for automatic load balancing and failover. Agentgateway picks two random providers and selects the healthiest one.
* **Prompt guarding** — add `AgentgatewayPolicy` resources for regex-based prompt filtering or webhook-based validation before requests hit your LLM.
* **Rate limiting** — protect your API keys and budgets with local or remote rate limiting policies.
* **Observability** — enable full [OpenTelemetry](https://opentelemetry.io/) support for metrics, logs, and distributed tracing across all your LLM traffic.

Check out the [agentgateway docs](https://agentgateway.dev/docs/kubernetes/latest/quickstart/) for more, or come chat with us on [Discord](https://discord.com/invite/y9efgEmppm).

> With a single Gateway listener and a few YAML resources, you get a unified, Kubernetes-native control point for all your LLM traffic. That's the power of agentgateway.
