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

## Before you begin

1. [Install agentgateway]({{< link-hextra path="/documentation/quickstart/install/" >}}) in your Kubernetes cluster.
2. Set up the [OpenAI LLM provider]({{< link-hextra path="/integrations/llm/providers/openai/" >}}) and its `/openai` route. You can use another provider, but the example request in this guide uses the OpenAI route.
3. Set up the [OpenTelemetry stack]({{< link-hextra path="/documentation/observability/otel-stack/" >}}). This guide updates the `opentelemetry-collector-traces` collector from that guide. The `tracing` {{< reuse "agw-docs/snippets/policy.md" >}} from that guide sends the proxy's traces to this collector.
4. Set up a Langfuse project.
   * **Langfuse Cloud**: Sign up at [langfuse.com](https://langfuse.com/) and create a project.
   * **Self-hosted Langfuse**: Langfuse needs PostgreSQL, ClickHouse, Redis, and S3-compatible storage. To deploy it in your cluster, follow the [Langfuse Kubernetes (Helm) guide](https://langfuse.com/self-hosting/deployment/kubernetes-helm). Then, create a project in the Langfuse UI.

## Get your Langfuse credentials

1. In your Langfuse project settings, create an API key pair. Copy the public key and the secret key.

2. Encode the key pair for HTTP Basic authentication.

   ```sh
   export LANGFUSE_AUTH=$(echo -n "<public-key>:<secret-key>" | base64)
   ```

3. Set the Langfuse OTLP endpoint.
   * **Langfuse Cloud (EU)**: `https://cloud.langfuse.com/api/public/otel`
   * **Langfuse Cloud (US)**: `https://us.cloud.langfuse.com/api/public/otel`
   * **Self-hosted Langfuse**: `http://<langfuse-web-service>.<namespace>.svc.cluster.local:3000/api/public/otel`

   ```sh
   export LANGFUSE_OTEL_ENDPOINT=https://cloud.langfuse.com/api/public/otel
   ```

## Configure the collector

Update the traces collector to also export traces to Langfuse. The configuration keeps the Tempo exporter from the OpenTelemetry stack guide, so traces still reach Tempo. The `helm upgrade` command replaces the collector's whole configuration, so keep any other exporters that you added.

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
    otlphttp/langfuse:
      endpoint: ${LANGFUSE_OTEL_ENDPOINT}
      headers:
        Authorization: "Basic ${LANGFUSE_AUTH}"
    debug:
      verbosity: detailed
  service:
    pipelines:
      traces:
        receivers: [otlp]
        processors: [batch]
        exporters: [debug, otlp/tempo, otlphttp/langfuse]
EOF
```

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

3. In your Langfuse project, open **Tracing** and verify that the trace appears with the following information.
   - Full prompt and response.
   - Token counts (input and output).
   - Model information.
   - Latency metrics.

## Learn more

- [Langfuse documentation](https://langfuse.com/docs)
- [Langfuse OpenTelemetry integration](https://langfuse.com/integrations/native/opentelemetry)
- [OpenTelemetry stack setup]({{< link-hextra path="/documentation/observability/otel-stack/" >}})
- [LLM observability metrics]({{< link-hextra path="/documentation/llm/observability/" >}})
