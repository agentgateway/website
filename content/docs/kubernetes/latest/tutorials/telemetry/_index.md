---
title: Telemetry & Observability
weight: 6
description: Enable OpenTelemetry tracing and metrics for agentgateway on Kubernetes
---

Enable distributed tracing and metrics collection for agentgateway on Kubernetes using OpenTelemetry and Jaeger.

## What you'll build

In this tutorial, you will:

1. Set up a local Kubernetes cluster with agentgateway and an LLM backend
2. Deploy Jaeger for trace collection and visualization
3. Configure a TrafficPolicy to enable distributed tracing
4. Send requests and view traces in the Jaeger UI

## Before you begin

Make sure you have the following tools installed:
- [Docker](https://www.docker.com/products/docker-desktop/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [kind](https://kind.sigs.k8s.io/)
- [Helm](https://helm.sh/docs/intro/install/)
- An OpenAI API key (get one at [platform.openai.com](https://platform.openai.com/api-keys))

For detailed installation instructions, see the [LLM Gateway tutorial](../llm-gateway/).

---

## Step 1: Create a kind cluster

```bash
kind create cluster --name agentgateway
```

---

## Step 2: Install agentgateway

```bash
# Gateway API CRDs
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version.md" >}}/standard-install.yaml

# agentgateway CRDs
helm upgrade -i --create-namespace \
  --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} {{< reuse "agw-docs/snippets/helm-kgateway-crds.md" >}} oci://{{< reuse "agw-docs/snippets/helm-path.md" >}}/charts/{{< reuse "agw-docs/snippets/helm-kgateway-crds.md" >}}

# Control plane
helm upgrade -i -n {{< reuse "agw-docs/snippets/namespace.md" >}} {{< reuse "agw-docs/snippets/helm-kgateway.md" >}} oci://{{< reuse "agw-docs/snippets/helm-path.md" >}}/charts/{{< reuse "agw-docs/snippets/helm-kgateway.md" >}} \
  --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}}
```

---

## Step 3: Create a Gateway

```bash
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
EOF
```

Wait for the proxy:

```bash
kubectl get deployment agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

---

## Step 4: Deploy Jaeger

Deploy Jaeger as a trace collector and visualization tool in its own namespace.

```bash
kubectl create namespace telemetry

kubectl apply -n telemetry -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jaeger
spec:
  replicas: 1
  selector:
    matchLabels:
      app: jaeger
  template:
    metadata:
      labels:
        app: jaeger
    spec:
      containers:
      - name: jaeger
        image: jaegertracing/all-in-one:latest
        ports:
        - containerPort: 16686
          name: ui
        - containerPort: 4317
          name: otlp-grpc
---
apiVersion: v1
kind: Service
metadata:
  name: jaeger
spec:
  selector:
    app: jaeger
  ports:
  - port: 16686
    targetPort: 16686
    name: ui
  - port: 4317
    targetPort: 4317
    name: otlp-grpc
EOF
```

Wait for Jaeger to be ready:

```bash
kubectl get pods -n telemetry -w
```

---

## Step 5: Configure tracing with a TrafficPolicy

Create a TrafficPolicy that sends traces to the Jaeger collector.

```bash
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1alpha2
kind: TrafficPolicy
metadata:
  name: tracing
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
    - kind: Gateway
      name: agentgateway-proxy
      group: gateway.networking.k8s.io
  frontend:
    tracing:
      backendRef:
        name: jaeger
        namespace: telemetry
        port: 4317
      protocol: GRPC
      randomSampling: "true"
EOF
```

This policy:
- **Targets** the Gateway to apply tracing to all routes
- **Sends traces** to Jaeger via OTLP gRPC on port 4317
- **Samples all requests** (`randomSampling: "true"`) for development

---

## Step 6: Set up an LLM backend

```bash
export OPENAI_API_KEY=<insert your API key>

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
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: openai
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      openai:
        model: gpt-4.1-nano
  policies:
    auth:
      secretRef:
        name: openai-secret
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: openai
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  rules:
    - backendRefs:
      - name: openai
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        group: agentgateway.dev
        kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
```

---

## Step 7: Generate traces

Set up port-forwarding for the agentgateway proxy:

```bash
kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80 &
```

Send a few requests to generate traces:

```bash
curl -s http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4.1-nano",
    "messages": [{"role": "user", "content": "What is OpenTelemetry?"}]
  }' | jq

curl -s http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4.1-nano",
    "messages": [{"role": "user", "content": "What is distributed tracing?"}]
  }' | jq
```

---

## Step 8: View traces in Jaeger

Set up port-forwarding for the Jaeger UI:

```bash
kubectl port-forward -n telemetry svc/jaeger 16686:16686 &
```

Open the Jaeger UI at [http://localhost:16686](http://localhost:16686).

1. Select **agentgateway** from the **Service** dropdown
2. Click **Find Traces**
3. Click on a trace to see the full request flow

You'll see spans for:
- The incoming HTTP request
- LLM provider routing
- Backend request to OpenAI
- Response processing

Each span includes details like:
- Request and response token counts
- Model information
- Latency breakdown

---

## Production sampling

For production, use ratio-based sampling to reduce overhead:

```yaml
frontend:
  tracing:
    backendRef:
      name: otel-collector
      namespace: telemetry
      port: 4317
    protocol: GRPC
    randomSampling: "0.1"  # Sample 10% of traces
```

---

## Cleanup

```bash
kill %1 %2 2>/dev/null
kind delete cluster --name agentgateway
```

---

## Next steps

{{< cards >}}
  {{< card link="/docs/kubernetes/latest/observability/" title="Observability Reference" subtitle="Complete observability configuration" >}}
  {{< card link="/docs/kubernetes/latest/observability/otel-stack" title="OTel Stack" subtitle="Full OpenTelemetry stack setup" >}}
  {{< card link="/docs/kubernetes/latest/tutorials/jwt-authorization" title="JWT Authorization" subtitle="Add security to your deployment" >}}
{{< /cards >}}
