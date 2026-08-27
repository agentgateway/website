---
title: OpenTelemetry Collector (OTel)
weight: 10
description: Route agentgateway traces through an OpenTelemetry Collector to fan out to multiple backends or apply processing pipelines.
---

The [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/) is a vendor-agnostic proxy that receives, processes, and exports telemetry data. For production deployments, routing agentgateway traces through a collector lets you fan out to multiple backends, apply processing pipelines such as batching or filtering, and swap backends without changing your agentgateway configuration.

The way you set up the OTel Collector depends on how you installed agentgateway.

{{< tabs >}}
{{% tab name="Binary and Docker" %}}

Run the OTel Collector as a Docker container on the same host as agentgateway and point agentgateway at `localhost:4317`.

1. Create an `otel-collector-config.yaml` file that defines the OTLP receiver, a batch processor, and your chosen exporter.
   ```yaml
   receivers:
     otlp:
       protocols:
         grpc:
           endpoint: 0.0.0.0:4317

   processors:
     batch:

   exporters:
     debug:
       verbosity: detailed

   service:
     pipelines:
       traces:
         receivers: [otlp]
         processors: [batch]
         exporters: [debug]
   ```
   Replace the `debug` exporter with the exporter for your tracing backend. For a full example that exports to Jaeger, see the [otel-collector-config.yaml](https://agentgateway.dev/examples/mcp-telemetry/otel-collector-config.yaml) file.

2. Start the OTel Collector container and mount your config file.
   ```sh
   docker run -d --name otel-collector \
     -p 4317:4317 \
     -v $(pwd)/otel-collector-config.yaml:/etc/otelcol/config.yaml \
     otel/opentelemetry-collector:latest
   ```

3. Configure agentgateway to send traces to the collector.
   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   frontendPolicies:
     tracing:
       host: localhost:4317
       randomSampling: true
   ```

4. When you are done, remove the OTel Collector container.
   ```sh
   docker rm -f otel-collector
   ```

{{% /tab %}}
{{% tab name="Kubernetes (Helm)" %}}

Deploy the OTel Collector into your cluster by using the OpenTelemetry Helm chart and point agentgateway at its service.

1. Add the OpenTelemetry Helm repository.
   ```sh
   helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
   helm repo update
   ```

2. Create a `values.yaml` file that defines the collector pipeline.
   ```yaml
   mode: deployment
   config:
     receivers:
       otlp:
         protocols:
           grpc:
             endpoint: 0.0.0.0:4317
     processors:
       batch:
     exporters:
       debug:
         verbosity: detailed
     service:
       pipelines:
         traces:
           receivers: [otlp]
           processors: [batch]
           exporters: [debug]
   ```
   Replace the `debug` exporter with the exporter for your tracing backend. For a full example that exports to Jaeger, see the [otel-collector-config.yaml](https://agentgateway.dev/examples/mcp-telemetry/otel-collector-config.yaml) file.

3. Install the OTel Collector chart.
   ```sh
   helm install otel-collector open-telemetry/opentelemetry-collector \
     -n monitoring --create-namespace \
     -f values.yaml
   ```

4. Verify that the collector pod is running.
   ```sh
   kubectl get pods -n monitoring
   ```

5. Update your agentgateway `values.yaml` to send traces to the collector service. The chart takes the agentgateway configuration under the top-level `config` field.
   ```yaml
   config:
     frontendPolicies:
       tracing:
         host: otel-collector.monitoring.svc.cluster.local:4317
         randomSampling: true
   ```

6. Apply the change with a Helm upgrade.
   {{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

7. When you are done, remove the OTel Collector and the monitoring namespace.
   ```sh
   helm uninstall otel-collector -n monitoring
   kubectl delete namespace monitoring
   ```

{{% /tab %}}
{{< /tabs >}}
