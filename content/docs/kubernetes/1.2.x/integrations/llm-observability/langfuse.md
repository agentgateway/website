---
title: Langfuse
weight: 10
description: Integrate agentgateway with Langfuse for LLM analytics and prompt management
---

[Langfuse](https://langfuse.com/) is an open-source LLM observability platform that provides prompt management, analytics, and evaluation.

## Features

- **Prompt tracing** - Log all prompts and responses.
- **Cost tracking** - Monitor token usage and costs.
- **Latency analytics** - Track response times.
- **Prompt management** - Version and deploy prompts.
- **Evaluation** - Score and evaluate outputs.
- **User tracking** - Attribute usage to users.

## Setup

### Self-hosted Langfuse

Deploy Langfuse to your Kubernetes cluster.

```bash
# Create namespace
kubectl create namespace langfuse

# Deploy PostgreSQL
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: langfuse-db
  namespace: langfuse
spec:
  ports:
  - port: 5432
  selector:
    app: langfuse-db
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: langfuse-db
  namespace: langfuse
spec:
  selector:
    matchLabels:
      app: langfuse-db
  template:
    metadata:
      labels:
        app: langfuse-db
    spec:
      containers:
      - name: postgres
        image: postgres:15
        env:
        - name: POSTGRES_USER
          value: langfuse
        - name: POSTGRES_PASSWORD
          value: langfuse
        - name: POSTGRES_DB
          value: langfuse
        ports:
        - containerPort: 5432
EOF

# Deploy Langfuse
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: langfuse
  namespace: langfuse
spec:
  ports:
  - port: 3000
    targetPort: 3000
  selector:
    app: langfuse
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: langfuse
  namespace: langfuse
spec:
  selector:
    matchLabels:
      app: langfuse
  template:
    metadata:
      labels:
        app: langfuse
    spec:
      containers:
      - name: langfuse
        image: langfuse/langfuse:latest
        env:
        - name: DATABASE_URL
          value: postgresql://langfuse:langfuse@langfuse-db:5432/langfuse
        - name: NEXTAUTH_SECRET
          value: your-secret-change-me
        - name: NEXTAUTH_URL
          value: http://langfuse.langfuse.svc.cluster.local:3000
        ports:
        - containerPort: 3000
EOF
```

Access Langfuse by port-forwarding.

```bash
kubectl port-forward -n langfuse svc/langfuse 3000:3000
```

Then navigate to [http://localhost:3000](http://localhost:3000).

### Cloud Langfuse

Sign up at [langfuse.com](https://langfuse.com/) and get your API keys.

## Configuration

Configure the OpenTelemetry Collector to forward traces to Langfuse.

```yaml
# Update the traces collector
helm upgrade --install opentelemetry-collector-traces opentelemetry-collector \
  --repo https://open-telemetry.github.io/opentelemetry-helm-charts \
  --version 0.127.2 \
  --set mode=deployment \
  --set image.repository="otel/opentelemetry-collector-contrib" \
  --set command.name="otelcol-contrib" \
  --namespace=telemetry \
  --create-namespace \
  -f -<<EOF
config:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317
        http:
          endpoint: 0.0.0.0:4318
  exporters:
    # Export to Langfuse Cloud
    otlphttp/langfuse:
      endpoint: https://cloud.langfuse.com/api/public/otel
      headers:
        Authorization: "Basic <base64-encoded-public-key:secret-key>"
    # Or export to self-hosted Langfuse
    otlphttp/langfuse-local:
      endpoint: http://langfuse.langfuse.svc.cluster.local:3000/api/public/otel
    debug:
      verbosity: detailed
  service:
    pipelines:
      traces:
        receivers: [otlp]
        exporters: [debug, otlphttp/langfuse]  # Use otlphttp/langfuse-local for self-hosted
EOF
```

{{< callout type="info" >}}
To create the base64-encoded credentials for Langfuse Cloud, run the following command.
```bash
echo -n "public-key:secret-key" | base64
```
{{< /callout >}}

## Verify integration

1. Send a request through agentgateway to an LLM backend.
   ```bash
   curl -X POST http://localhost:8080/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-4o-mini",
       "messages": [{"role": "user", "content": "Hello!"}]
     }'
   ```

2. Navigate to your Langfuse dashboard and verify that the trace appears with the following information.
   - Full prompt and response.
   - Token counts (input and output).
   - Model information.
   - Latency metrics.

## Learn more

- [Langfuse Documentation](https://langfuse.com/docs)
- [OpenTelemetry stack setup]({{< link-hextra path="/observability/otel-stack/" >}})
- [LLM observability metrics]({{< link-hextra path="/llm/observability/" >}})
