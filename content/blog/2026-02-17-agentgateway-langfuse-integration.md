---
title: "Open Source LLM Observability: Tracing AI Calls with AgentGateway and Langfuse"
publishDate: 2026-02-18
author: "Sebastian Maniak"
description: "How to automatically capture, monitor, and debug every LLM API call flowing through Solo AgentGateway using Langfuse — with zero application code changes."
---

## Introduction

You've got your AI gateway routing LLM traffic. But can you actually *see* what's happening? Which models are being called, how many tokens are being consumed, what prompts are going in and what completions are coming back?

This guide shows you how to integrate [Langfuse](https://langfuse.com) with [Solo AgentGateway](https://agentgateway.dev) to get full observability over every LLM request — without touching your application code. We'll go from zero to traced requests on a local kind cluster in under 10 minutes.

## Why This Matters

AgentGateway already captures rich telemetry about every LLM request: model, tokens, latency, route, and security policy actions. By forwarding those traces to Langfuse, you get:

- **Full prompt and completion visibility** across all LLM providers (OpenAI, Anthropic, xAI, etc.)
- **Token usage and cost tracking** per model, route, and user
- **Latency analysis** with gateway-level metadata — which route, which backend, which policy fired
- **Zero application changes** — tracing happens at the gateway layer, not in your app

This is the power of observability at the infrastructure layer. Your developers don't need to instrument anything. Every LLM call that flows through the gateway is automatically captured.

## Architecture

Here's what we're building:

```
┌──────────────┐     ┌────────────────────────┐     ┌─────────────────┐
│ Your App /   │     │   Solo AgentGateway     │     │   LLM Provider  │
│ AI Agent     │────▶│   (Gateway API)         │────▶│   (OpenAI, etc) │
└──────────────┘     └───────────┬────────────┘     └─────────────────┘
                                 │
                          OTLP Traces (gRPC)
                                 │
                     ┌───────────▼────────────┐
                     │  OpenTelemetry          │
                     │  Collector              │
                     └─────┬───────────┬──────┘
                           │           │
                    OTLP HTTP      OTLP gRPC
                           │           │
                     ┌─────▼──┐  ┌─────▼──────────┐
                     │Langfuse│  │Other backends   │
                     │  UI    │  │(Jaeger, etc.)   │
                     └────────┘  └─────────────────┘
```

AgentGateway natively emits OpenTelemetry traces for every LLM request. A lightweight OTel Collector receives those traces and forwards them to Langfuse via OTLP HTTP. The collector can also fan-out to additional backends like Jaeger, Datadog, or ClickHouse if you need traces in multiple places.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed and running
- [kind](https://kind.sigs.k8s.io/docs/user/quick-start/#installation) installed
- [kubectl](https://kubernetes.io/docs/tasks/tools/) installed
- [helm](https://helm.sh/docs/intro/install/) installed
- A [Langfuse](https://cloud.langfuse.com) account (free tier works) or self-hosted instance
- An OpenAI API key (or any supported LLM provider)

## Step 1: Create a Kind Cluster

```bash
kind create cluster --name agentgateway
kubectl cluster-info --context kind-agentgateway
```

## Step 2: Install the Gateway API CRDs

AgentGateway uses the standard Kubernetes Gateway API for configuration:

```bash
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.4.0/standard-install.yaml
```

## Step 3: Install AgentGateway

Install the CRDs and control plane:

```bash
helm upgrade -i agentgateway-crds oci://cr.agentgateway.dev/helm/agentgateway-crds \
  --version 2.1.0 \
  --namespace agentgateway-system \
  --create-namespace

helm upgrade -i agentgateway oci://cr.agentgateway.dev/helm/agentgateway \
  --version 2.1.0 \
  --namespace agentgateway-system
```

Verify everything is running:

```bash
kubectl get pods -n agentgateway-system
kubectl get gatewayclass agentgateway
```

## Step 4: Get Your Langfuse Credentials

Log in to Langfuse and go to **Settings → API Keys**. Create a new key pair (or use an existing one). Base64 encode them for the collector config:

```bash
echo -n "pk-lf-YOUR_PUBLIC_KEY:sk-lf-YOUR_SECRET_KEY" | base64
```

## Step 5: Deploy the OTel Collector

The collector bridges AgentGateway (OTLP gRPC) and Langfuse (OTLP HTTP). Create `langfuse-collector.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: langfuse-otel-collector-config
  namespace: agentgateway-system
data:
  config.yaml: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318
    exporters:
      otlphttp/langfuse:
        endpoint: https://cloud.langfuse.com/api/public/otel
        headers:
          Authorization: "Basic <YOUR_BASE64_CREDENTIALS>"
        retry_on_failure:
          enabled: true
          initial_interval: 5s
          max_interval: 30s
          max_elapsed_time: 300s
    processors:
      batch:
        send_batch_size: 1000
        timeout: 5s
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [batch]
          exporters: [otlphttp/langfuse]
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: langfuse-otel-collector
  namespace: agentgateway-system
  labels:
    app: langfuse-otel-collector
spec:
  replicas: 1
  selector:
    matchLabels:
      app: langfuse-otel-collector
  template:
    metadata:
      labels:
        app: langfuse-otel-collector
    spec:
      containers:
        - name: otel-collector
          image: otel/opentelemetry-collector-contrib:0.132.1
          args: ["--config=/conf/config.yaml"]
          ports:
            - containerPort: 4317
              name: otlp-grpc
            - containerPort: 4318
              name: otlp-http
          volumeMounts:
            - name: config
              mountPath: /conf
          resources:
            requests:
              cpu: 50m
              memory: 128Mi
            limits:
              cpu: 200m
              memory: 256Mi
      volumes:
        - name: config
          configMap:
            name: langfuse-otel-collector-config
---
apiVersion: v1
kind: Service
metadata:
  name: langfuse-otel-collector
  namespace: agentgateway-system
spec:
  selector:
    app: langfuse-otel-collector
  ports:
    - name: otlp-grpc
      port: 4317
      targetPort: 4317
    - name: otlp-http
      port: 4318
      targetPort: 4318
```

Deploy it:

```bash
kubectl apply -f langfuse-collector.yaml
```

## Step 6: Enable Tracing on AgentGateway

For AgentGateway OSS, configure tracing via Helm values. Create `values-tracing.yaml`:

```yaml
gateway:
  envs:
    OTEL_EXPORTER_OTLP_ENDPOINT: "http://langfuse-otel-collector.agentgateway-system.svc.cluster.local:4317"
    OTEL_EXPORTER_OTLP_PROTOCOL: "grpc"
```

Upgrade the installation:

```bash
helm upgrade agentgateway oci://cr.agentgateway.dev/helm/agentgateway \
  --version 2.1.0 \
  --namespace agentgateway-system \
  -f values-tracing.yaml
```

**Using AgentGateway Enterprise?** Instead of environment variables, create an `EnterpriseAgentgatewayParameters` resource with full control over field mappings:

```yaml
apiVersion: enterpriseagentgateway.solo.io/v1alpha1
kind: EnterpriseAgentgatewayParameters
metadata:
  name: tracing
  namespace: agentgateway-system
spec:
  rawConfig:
    config:
      tracing:
        otlpEndpoint: grpc://langfuse-otel-collector.agentgateway-system.svc.cluster.local:4317
        otlpProtocol: grpc
        randomSampling: true
        fields:
          add:
            gen_ai.operation.name: '"chat"'
            gen_ai.system: "llm.provider"
            gen_ai.request.model: "llm.requestModel"
            gen_ai.response.model: "llm.responseModel"
            gen_ai.usage.prompt_tokens: "llm.inputTokens"
            gen_ai.usage.completion_tokens: "llm.outputTokens"
            gen_ai.usage.total_tokens: "llm.totalTokens"
            gen_ai.request.temperature: "llm.params.temperature"
            gen_ai.prompt: "llm.prompt"
            gen_ai.completion: "llm.completion"
```

## Step 7: Create a Gateway and LLM Route

Create the Gateway resource and an OpenAI route:

```yaml
# gateway.yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: ai-gateway
  namespace: agentgateway-system
spec:
  gatewayClassName: agentgateway
  listeners:
    - name: llm
      port: 8080
      protocol: HTTPS
      allowedRoutes:
        namespaces:
          from: Same
```

```yaml
# openai-route.yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: openai
  namespace: agentgateway-system
spec:
  parentRefs:
    - name: ai-gateway
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /openai
      backendRefs:
        - group: agentgateway.dev
          kind: AgentgatewayBackend
          name: openai
---
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: openai
  namespace: agentgateway-system
spec:
  type: llm
  llm:
    provider:
      openai:
        authToken:
          secretRef:
            name: openai-api-key
            namespace: agentgateway-system
```

Create the secret and apply everything:

```bash
kubectl create secret generic openai-api-key \
  -n agentgateway-system \
  --from-literal=Authorization="Bearer $OPENAI_API_KEY"

kubectl apply -f gateway.yaml
kubectl apply -f openai-route.yaml
```

## Step 8: Test It

Port-forward the gateway and send a request:

```bash
kubectl port-forward -n agentgateway-system svc/ai-gateway 8080:8080 &

curl -X POST http://localhost:8080/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4.1-mini",
    "messages": [{"role": "user", "content": "Hello from AgentGateway!"}]
  }'
```

## Step 9: View Traces in Langfuse

Open your Langfuse UI and navigate to **Traces**. You should see a new trace with the full picture:

- **Model and provider** — which model actually served the request
- **Token counts** — input, output, and total tokens consumed
- **Full prompt and completion** — the exact content sent and received
- **Gateway metadata** — route name, backend endpoint, listener

## What Gets Captured

AgentGateway follows the [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/), so every trace includes structured attributes:

| Attribute | What It Tells You |
|-----------|-------------------|
| `gen_ai.system` | LLM provider (openai, anthropic, etc.) |
| `gen_ai.request.model` | The model you asked for |
| `gen_ai.response.model` | The model that actually responded |
| `gen_ai.usage.prompt_tokens` | Input tokens consumed |
| `gen_ai.usage.completion_tokens` | Output tokens generated |
| `gen_ai.prompt` | Full prompt content |
| `gen_ai.completion` | Full completion content |
| `gateway` | AgentGateway resource name |
| `route` | HTTPRoute that matched |
| `endpoint` | Backend LLM endpoint |

## Going Further

### Fan-Out to Multiple Backends

The OTel Collector makes it easy to send traces to Langfuse *and* another backend simultaneously:

```yaml
exporters:
  otlphttp/langfuse:
    endpoint: https://cloud.langfuse.com/api/public/otel
    headers:
      Authorization: "Basic <CREDENTIALS>"
  otlp/jaeger:
    endpoint: jaeger-collector:4317
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/langfuse, otlp/jaeger]
```

### MCP Tool Tracing

AgentGateway also traces MCP (Model Context Protocol) traffic. When an agent discovers or invokes tools through an MCP server proxied by AgentGateway, you'll see tool discovery requests, execution calls with parameters and results, and backend server latency — all as spans within the same trace.

### Security Policy Visibility

When AgentGateway's security policies fire — PII protection, prompt injection detection, credential leak prevention — the trace metadata shows which policy triggered, what action was taken (block, mask, allow), and what pattern matched. You get observability into both your LLM interactions and your security guardrails in one place.

## Troubleshooting

**No traces appearing?**
1. Check the collector is running: `kubectl get pods -n agentgateway-system -l app=langfuse-otel-collector`
2. Check collector logs for errors: `kubectl logs -n agentgateway-system -l app=langfuse-otel-collector`
3. Wrong API keys show up as 401 errors in collector logs
4. Make sure proxies were restarted after configuring tracing

**Traces visible in gateway logs but not Langfuse?**
- Langfuse only supports OTLP HTTP, not gRPC — that's why the collector is needed for protocol conversion
- Verify the exporter endpoint URL includes `/api/public/otel`
- Double-check the Base64 credentials format: `base64(public_key:secret_key)`

**Incomplete trace data?**
- For Enterprise, ensure `fields.add` includes the GenAI attribute mappings
- Set `randomSampling: true` to capture all requests during testing

## Cleanup

```bash
kind delete cluster --name agentgateway
```

## Resources

- [Solo AgentGateway Docs](https://docs.solo.io/agentgateway/)
- [AgentGateway OSS](https://agentgateway.dev)
- [Langfuse Docs](https://langfuse.com/docs)
- [Langfuse OpenTelemetry Integration](https://langfuse.com/docs/integrations/opentelemetry)
- [OpenTelemetry GenAI Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [Source Code for This Guide](https://github.com/ProfessorSeb/agentgateway-langfuse)
