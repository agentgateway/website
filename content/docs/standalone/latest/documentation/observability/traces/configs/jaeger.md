---
title: Jaeger
weight: 20
description: Export agentgateway traces to Jaeger for local collection and visualization by using its built-in OTLP receiver and web UI.
aliases:
  - ../../../../integrations/observability/jaeger/
---

[Jaeger](https://www.jaegertracing.io/) is an open-source distributed tracing platform that collects, stores, and visualizes traces. It is a quick way to get started with tracing for agentgateway because it ships with a built-in OTLP receiver, so you do not need a separate collector, and a web UI to browse and query spans.

Jaeger works best for local development and testing. For production deployments, consider routing traces through an [OpenTelemetry Collector]({{< link-hextra path="/documentation/observability/traces/configs/otel/" >}}) so that you can fan out to multiple backends or apply processing pipelines to your traces before exporting them.

The way you set up Jaeger depends on how you installed agentgateway.

## Binary and Docker installations {#binary-docker}

Run a Jaeger container on the same host as agentgateway.

1. Start a Jaeger container on the same host that agentgateway runs.
   ```sh
   docker run -d --name jaeger \
     -p 16686:16686 \
     -p 4317:4317 \
     -e COLLECTOR_OTLP_ENABLED=true \
     jaegertracing/all-in-one:latest
   ```

2. Point agentgateway at the Jaeger endpoint. You can make this change in the UI or in your configuration file.

   {{< tabs >}}
   {{% tab name="UI" %}}
   Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).

   1. Open the **Settings** > **Observability** page, such as [http://localhost:15000/ui/settings/observability](http://localhost:15000/ui/settings/observability), and click the **Tracing** card.
   2. Keep `localhost:4317` for the **Host** and **gRPC** for the **Protocol**.
   3. Enter `true` for **Random sampling**.

      {{< reuse-image src="img/ui-tracing-enable.png" srcDark="img/ui-tracing-enable-dark.png" alt="Tracing drawer with the gRPC protocol in the Export section and random sampling set to true in the Sampling section" >}}

   4. Click **Save policy**.
   {{% /tab %}}
   {{% tab name="Config file" %}}
   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   frontendPolicies:
     tracing:
       host: localhost:4317
       randomSampling: true
   ```
   {{% /tab %}}
   {{< /tabs >}}

3. Open the Jaeger UI at [http://localhost:16686](http://localhost:16686) to view traces.

4. When you are done, remove the Jaeger container.
   ```sh
   docker rm -f jaeger
   ```

## Helm installations {#helm}

Install Jaeger into your cluster by using Helm and point agentgateway at the Jaeger collector service.

1. Install the Jaeger Helm chart.
   ```sh
   helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
   helm install jaeger jaegertracing/jaeger -n monitoring --create-namespace
   ```

2. Verify that the pods are up and running.
   ```sh
   kubectl get pods -n monitoring
   ```

3. Update your agentgateway `values.yaml` to point at the Jaeger collector service. The chart takes the agentgateway configuration under the top-level `config` field.
   ```yaml
   config:
     frontendPolicies:
       tracing:
         host: jaeger.monitoring.svc.cluster.local:4317
         randomSampling: true
   ```

4. Apply the change with a Helm upgrade.
   {{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

5. When you are done, remove Jaeger and the monitoring namespace.
   ```sh
   helm uninstall jaeger -n monitoring
   kubectl delete namespace monitoring
   ```

## Other configurations

Review other common configuration examples. 

### Docker Compose

Run agentgateway and Jaeger together as a single Docker Compose stack. Jaeger is available to agentgateway at `jaeger:4317`, the Docker service name.

1. Create a `docker-compose.yaml` file with the following content.
   ```yaml
   services:
     agentgateway:
       image: cr.agentgateway.dev/agentgateway:latest
       ports:
         - "3000:3000"
       volumes:
         - ./config.yaml:/config.yaml:ro
       command: ["-f", "/config.yaml"]
       depends_on:
         - jaeger

     jaeger:
       image: jaegertracing/all-in-one:latest
       ports:
         - "16686:16686"
         - "4317:4317"
       environment:
         - COLLECTOR_OTLP_ENABLED=true
   ```

2. In your agentgateway config file, set the Jaeger service name as the tracing host.
   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   frontendPolicies:
     tracing:
       host: jaeger:4317
       randomSampling: true
   ```

3. Start the stack.
   ```sh
   docker compose up -d
   ```

4. Open the Jaeger UI at [http://localhost:16686](http://localhost:16686) to view traces.

5. When you are done, stop and remove the stack.
   ```sh
   docker compose down
   ```