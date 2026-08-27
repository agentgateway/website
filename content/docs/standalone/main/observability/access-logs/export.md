---
title: Export logs over OTLP
weight: 20
description: Export agentgateway access logs as OTLP LogRecord objects to an OpenTelemetry Collector or any compatible backend.
---

Log export happens in addition to stdout output, so you can send logs to a collector without losing local visibility.

This guide walks through setting up an OpenTelemetry Collector to receive access logs from agentgateway.

{{< tabs >}}
{{% tab name="Binary and Docker" %}}

Run the OTel Collector as a Docker container on the same host as agentgateway.

1. Create an `otel-collector-config.yaml` file that defines an OTLP receiver and a logs pipeline.
   ```sh
   cat > otel-collector-config.yaml << 'EOF'
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
       logs:
         receivers: [otlp]
         processors: [batch]
         exporters: [debug]
   EOF
   ```
   Replace the `debug` exporter with the exporter for your logging backend (for example, Loki, Elasticsearch, or an OTLP-compatible storage system).

2. Start the OTel Collector container and mount your config file.
   ```sh
   docker run -d --name otel-collector \
     -p 4317:4317 \
     -v $(pwd)/otel-collector-config.yaml:/etc/otelcol/config.yaml \
     otel/opentelemetry-collector:latest
   ```

3. Configure agentgateway to send access logs to the collector.
   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   frontendPolicies:
     accessLog:
       otlp:
         host: localhost:4317
   ```

4. Send a request through agentgateway, then check the collector output to verify that log records are arriving.
   ```sh
   docker logs otel-collector
   ```
   Each proxied request appears as a `LogRecord` entry in the collector output. Look for a block that starts with `LogRecord #` and includes attributes such as `gateway`, `http.method`, `http.path`, and `http.status`.

5. When you are done, remove the OTel Collector container.
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
         logs:
           receivers: [otlp]
           processors: [batch]
           exporters: [debug]
   ```
   Replace the `debug` exporter with the exporter for your logging backend.

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

5. Update your agentgateway `values.yaml` to send access logs to the collector service. The chart takes the agentgateway configuration under the top-level `config` field.
   ```yaml
   config:
     frontendPolicies:
       accessLog:
         otlp:
           host: otel-collector.monitoring.svc.cluster.local:4317
   ```

6. Apply the change with a Helm upgrade.
   {{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

7. Send a request through agentgateway, then check the collector logs to verify that log records are arriving.
   ```sh
   kubectl logs -n monitoring deployment/otel-collector
   ```
   Each proxied request appears as a `LogRecord` entry. Look for a block that starts with `LogRecord #` and includes attributes such as `gateway`, `http.method`, `http.path`, and `http.status`.

8. When you are done, remove the OTel Collector and the monitoring namespace.
   ```sh
   helm uninstall otel-collector -n monitoring
   kubectl delete namespace monitoring
   ```

{{% /tab %}}
{{< /tabs >}}

## Other configurations

Review other common configurations when exporting access logs to an OTLP-compatible backend. 

### Filter logs before export

You can filter which access logs are exported to your OTLP backend by setting the `accessLog.otlp.filter` field. This filter is independent of the top-level `filter` (`frontendPolicies.accessLog.filter`), which controls what access logs are written to stdout and stored in the database. Because the two filters are evaluated separately, you can send a different subset of logs to stdout or your database, and to your OTLP backend. 

The following example sends only error responses to the OTLP collector while logging all requests to stdout.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    otlp:
      host: localhost:4317
      filter: 'response.code >= 400'
```

The following example logs only error responses to stdout and the database, but sends all requests to the OTLP collector.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    filter: 'response.code >= 400'
    otlp:
      host: localhost:4317
```

### Customize exported fields

You can add or remove fields to the log entry that you export to the OTLP endpoint. 

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    otlp:
      host: localhost:4317
      fields:
        add:
          trace_id: 'request.headers["x-trace-id"]'
        remove:
          - http.host
```

