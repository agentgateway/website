---
title: Export logs over OTLP
weight: 20
description: Export agentgateway access logs as OTLP LogRecord objects to an OpenTelemetry Collector or any compatible backend.
---

Log export happens in addition to stdout output, so you can send logs to a collector without losing local visibility.

This guide walks through setting up an OpenTelemetry Collector to receive access logs from agentgateway.

You can configure the export in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).

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
   1. Open the **Settings** > **Observability** page, such as [http://localhost:15000/ui/settings/observability](http://localhost:15000/ui/settings/observability), and click the **Access logs** card.
   2. In the **OTLP export** section, select **Export logs over OTLP**.
   3. Keep `localhost:4317` for the **Collector host** and **gRPC** for the **Protocol**.
   4. Click **Save policy**. The UI saves the `frontendPolicies.accessLog.otlp` section in your configuration.

4. Send a request through agentgateway, then check the collector output to verify that log records are arriving.
   ```sh
   docker logs otel-collector
   ```
   Each proxied request appears as a `LogRecord` entry in the collector output. Look for a block that starts with `LogRecord #` and includes attributes such as `gateway`, `http.request.method`, `url.path`, and `http.response.status_code`.

5. When you are done, remove the OTel Collector container.
   ```sh
   docker rm -f otel-collector
   ```

For a Helm installation, use the **Kubernetes (Helm)** tab in the **Config file** tab.
{{% /tab %}}
{{% tab name="Config file" %}}
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
   Each proxied request appears as a `LogRecord` entry in the collector output. Look for a block that starts with `LogRecord #` and includes attributes such as `gateway`, `http.request.method`, `url.path`, and `http.response.status_code`. The HTTP attributes use the OpenTelemetry semantic convention names. The records belong to the `agentgateway.access` instrumentation scope, which the collector prints in the `InstrumentationScope` line of the `ScopeLogs` block that contains the record.

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
   Each proxied request appears as a `LogRecord` entry. Look for a block that starts with `LogRecord #` and includes attributes such as `gateway`, `http.request.method`, `url.path`, and `http.response.status_code`. The HTTP attributes use the OpenTelemetry semantic convention names. The records belong to the `agentgateway.access` instrumentation scope, which the collector prints in the `InstrumentationScope` line of the `ScopeLogs` block that contains the record.

8. When you are done, remove the OTel Collector and the monitoring namespace.
   ```sh
   helm uninstall otel-collector -n monitoring
   kubectl delete namespace monitoring
   ```

{{% /tab %}}
{{< /tabs >}}
{{% /tab %}}
{{< /tabs >}}

## Other configurations

Review other common configurations when exporting access logs to an OTLP-compatible backend. 

### Filter logs before export

You can filter which access logs are exported to your OTLP backend by setting the `accessLog.otlp.filter` field. When `otlp.filter` is not set, the top-level `filter` (`frontendPolicies.accessLog.filter`) is used as a fallback for OTLP export as well. When `otlp.filter` is set, it takes precedence over the top-level filter for OTLP export only, so you can send a different subset of logs to your OTLP backend than to stdout and the database.

The following example sends only error responses to the OTLP collector while logging all requests to stdout.

{{< tabs >}}
{{% tab name="UI" %}}
1. Open the **Settings** > **Observability** page, and click the **Access logs** card.
2. In the **OTLP export** section, select **Export logs over OTLP**, and keep `localhost:4317` for the **Collector host**.
3. Enter `response.code >= 400` in the **OTLP filter** field. To set the top-level filter instead, use the **Filter** field in the **Log fields** section.
4. Click **Save policy**.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    otlp:
      host: localhost:4317
      filter: 'response.code >= 400'
```
{{% /tab %}}
{{< /tabs >}}

The following example logs only error responses to stdout, the database, and the OTLP collector. Because no `otlp.filter` is set, the top-level filter applies to all three backends.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    filter: 'response.code >= 400'
    otlp:
      host: localhost:4317
```

The following example logs only error responses to stdout and the database, but sends all requests to the OTLP collector. To override the top-level filter for OTLP, set `otlp.filter` explicitly.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    filter: 'response.code >= 400'
    otlp:
      host: localhost:4317
      filter: 'true'
```

### Customize exported fields

You can add or remove fields to the log entry that you export to the OTLP endpoint. The following example adds a `trace_id` field from the `x-trace-id` request header and removes the `server.address` field.

The `remove` list matches the attribute names in the OTLP record, which are the OpenTelemetry semantic convention names, such as `server.address`, `url.path`, and `http.response.status_code`. The stdout log keeps the `http.host`, `http.path`, and `http.status` names, and the OTLP `fields` setting does not change it. A name that does not appear in the OTLP record, such as `http.host`, removes nothing.

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
          - server.address
```

