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

## Before you begin

1. [Install agentgateway]({{< link-hextra path="/documentation/quickstart/install/" >}}) in your Kubernetes cluster.
2. Set up the [OpenAI LLM provider]({{< link-hextra path="/integrations/llm/providers/openai/" >}}) and its `/openai` route. You can use another provider, but the example request in this guide uses the OpenAI route.
3. Set up the [OpenTelemetry stack]({{< link-hextra path="/documentation/observability/otel-stack/" >}}). This guide updates the `opentelemetry-collector-traces` collector from that guide. The `tracing` {{< reuse "agw-docs/snippets/policy.md" >}} from that guide sends the proxy's traces to this collector.
4. Sign up at [smith.langchain.com](https://smith.langchain.com/), create a project, and create an API key.

## Store your API key

Create a Kubernetes secret with your LangSmith API key in the `telemetry` namespace, where the collector runs.

```sh
kubectl create secret generic langsmith-api-key \
  --from-literal=api-key="<your-langsmith-api-key>" \
  -n telemetry
```

## Configure the collector

Update the traces collector to also export traces to LangSmith. The configuration keeps the Tempo exporter from the OpenTelemetry stack guide, so traces still reach Tempo. The `helm upgrade` command replaces the collector's whole configuration, so keep any other exporters that you added.

```sh
helm upgrade --install opentelemetry-collector-traces opentelemetry-collector \
  --repo https://open-telemetry.github.io/opentelemetry-helm-charts \
  --version {{< reuse "agw-docs/versions/otel-stack-collector.md" >}} \
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
    otlp/tempo:
      endpoint: http://tempo.telemetry.svc.cluster.local:4317
      tls:
        insecure: true
    otlphttp/langsmith:
      endpoint: https://api.smith.langchain.com/otel
      headers:
        x-api-key: "\${env:LANGSMITH_API_KEY}"
    debug:
      verbosity: detailed
  service:
    pipelines:
      traces:
        receivers: [otlp]
        processors: [batch]
        exporters: [debug, otlp/tempo, otlphttp/langsmith]
EOF
```

The collector reads the API key from the `LANGSMITH_API_KEY` environment variable. To send traces to a specific LangSmith project instead of the default project, add a `Langsmith-Project: <project-name>` header to the exporter.

Wait for the collector to restart with the new configuration.

```sh
kubectl rollout status deployment/opentelemetry-collector-traces -n telemetry
```

## Verify the integration

1. Send a request through agentgateway to the OpenAI route.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "$INGRESS_GW_ADDRESS/openai" -H content-type:application/json -d '{
     "model": "gpt-4o-mini",
     "messages": [{"role": "user", "content": "Hello!"}]
   }'
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/openai" -H content-type:application/json -d '{
     "model": "gpt-4o-mini",
     "messages": [{"role": "user", "content": "Hello!"}]
   }'
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Check the collector logs for the agentgateway span. The `debug` exporter prints each span that the collector receives.

   ```sh
   kubectl logs deploy/opentelemetry-collector-traces -n telemetry | grep -i "gen_ai"
   ```

3. In your LangSmith project, verify that the trace appears with the following information.
   - Full prompt and response.
   - Token counts (input and output).
   - Model information.
   - Latency metrics.
   - Nested span structure.

## Learn more

- [LangSmith documentation](https://docs.langchain.com/langsmith/observability)
- [Trace with OpenTelemetry in LangSmith](https://docs.langchain.com/langsmith/trace-with-opentelemetry)
- [OpenTelemetry stack setup]({{< link-hextra path="/documentation/observability/otel-stack/" >}})
- [LLM observability metrics]({{< link-hextra path="/documentation/llm/observability/" >}})
