---
title: LangSmith
weight: 20
description: Integrate agentgateway with LangSmith for LLM debugging and monitoring
---

[LangSmith](https://smith.langchain.com/) is LangChain's platform for debugging, testing, evaluating, and monitoring LLM applications.

## Features

- **Trace logging** - Detailed request/response logging.
- **Debugging** - Step-through debugging of LLM calls.
- **Evaluation** - Automated testing and evaluation.
- **Monitoring** - Production monitoring and alerting.
- **Datasets** - Build and manage evaluation datasets.

## Setup

1. Sign up at [smith.langchain.com](https://smith.langchain.com/).
2. Create a project and get your API key.
3. Create a Kubernetes secret with your API key.

```bash
kubectl create secret generic langsmith-api-key \
  --from-literal=api-key=YOUR_LANGSMITH_API_KEY \
  -n telemetry
```

## Configuration

Configure the OpenTelemetry Collector to forward traces to LangSmith.

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
extraEnvs:
  - name: LANGSMITH_API_KEY
    valueFrom:
      secretKeyRef:
        name: langsmith-api-key
        key: api-key
config:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317
        http:
          endpoint: 0.0.0.0:4318
  exporters:
    otlphttp/langsmith:
      endpoint: https://api.smith.langchain.com/otel
      headers:
        x-api-key: "\${LANGSMITH_API_KEY}"
    debug:
      verbosity: detailed
  service:
    pipelines:
      traces:
        receivers: [otlp]
        exporters: [debug, otlphttp/langsmith]
EOF
```

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

2. Navigate to your LangSmith project and verify that the trace appears with the following information.
   - Full prompt and response.
   - Token counts (input and output).
   - Model information.
   - Latency metrics.
   - Nested span structure.

## Learn more

- [LangSmith Documentation](https://docs.smith.langchain.com/)
- [OpenTelemetry stack setup]({{< link-hextra path="/observability/otel-stack/" >}})
- [LLM observability metrics]({{< link-hextra path="/llm/observability/" >}})
