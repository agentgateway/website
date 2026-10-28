## Step 1: Install Grafana Loki and Tempo {#grafana}

[Grafana](https://grafana.com/) is a suite of open source tools that help you analyze, visualize, and monitor data in your cluster. For the OTel stack, you install the following Grafana components:

* **[Loki](https://grafana.com/oss/loki/)**: A log aggregation system that indexes metadata about your logs as a set of labels, not the actual log contents. This way, Loki is more cost-efficient and performant than traditional log aggregation systems.
  > [!TIP]
  > Loki works best when you use structured logging in your applications, such as JSON format.
* **[Tempo](https://grafana.com/oss/tempo/)**: A distributed tracing system that stores trace data in object storage (like Amazon S3) and integrates seamlessly with Grafana for visualization. Distributed tracing helps you see how requests move through a microservices environment, which helps you identify performance bottlenecks, debug issues, and otherwise monitor your system's health to ensure SLA compliance.

Steps to install:

1. Deploy Grafana Loki to your cluster. Choose where Loki stores log data.
   * **Local storage**: Loki stores chunks and indexes on a persistent volume in the cluster. Use this option to try out the OTel stack in a test cluster, such as a kind cluster.
   * **Object storage**: Loki stores chunks and indexes in an Amazon S3 bucket. Use this option to persist log data independently of the cluster. Before you install Loki, create a chunks bucket and a ruler bucket, and an IAM role for service accounts (IRSA) in your Amazon EKS cluster that grants Loki access to the buckets. If you use Grafana Enterprise Logs, also create an admin bucket. The following example runs Loki as a single replica, which is not suitable for production. For highly available options, see the [Loki deployment mode docs](https://grafana.com/docs/loki/latest/get-started/deployment-modes/). For other object storage providers, such as Google Cloud Storage or Azure Blob Storage, see the [Loki storage docs](https://grafana.com/docs/loki/latest/setup/install/helm/configure-storage/).

   {{< tabs >}}
   {{% tab name="Local storage" %}}
   ```yaml
   helm upgrade --install loki loki \
   --repo https://grafana.github.io/helm-charts \
   --version {{< reuse "agw-docs/versions/otel-stack-loki.md" >}} \
   --namespace telemetry \
   --create-namespace \
   --values - <<EOF
   loki:
     commonConfig:
       replication_factor: 1
     schemaConfig:
       configs:
         - from: 2024-04-01
           store: tsdb
           object_store: filesystem
           schema: v13
           index:
             prefix: loki_index_
             period: 24h
     storage:
       type: filesystem
     auth_enabled: false
   singleBinary:
     replicas: 1
   minio:
     enabled: false
   gateway:
     enabled: false
   test:
     enabled: false
   monitoring:
     selfMonitoring:
       enabled: false
       grafanaAgent:
         installOperator: false
   lokiCanary:
     enabled: false
   limits_config:
     allow_structured_metadata: true
   memberlist:
     service:
       publishNotReadyAddresses: true
   deploymentMode: SingleBinary
   backend:
     replicas: 0
   read:
     replicas: 0
   write:
     replicas: 0
   ingester:
     replicas: 0
   querier:
     replicas: 0
   queryFrontend:
     replicas: 0
   queryScheduler:
     replicas: 0
   distributor:
     replicas: 0
   compactor:
     replicas: 0
   indexGateway:
     replicas: 0
   bloomCompactor:
     replicas: 0
   bloomGateway:
     replicas: 0
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Object storage (Amazon S3)" %}}
   ```yaml
   helm upgrade --install loki loki \
   --repo https://grafana.github.io/helm-charts \
   --version {{< reuse "agw-docs/versions/otel-stack-loki.md" >}} \
   --namespace telemetry \
   --create-namespace \
   --values - <<EOF
   loki:
     commonConfig:
       replication_factor: 1
     schemaConfig:
       configs:
         - from: 2024-04-01
           store: tsdb
           object_store: s3
           schema: v13
           index:
             prefix: loki_index_
             period: 24h
     storage:
       type: s3
       bucketNames:
         chunks: <chunks-bucket>
         ruler: <ruler-bucket>
         # For Grafana Enterprise Logs
         # admin: <admin-bucket>
       s3:
         region: <region>
     auth_enabled: false
   serviceAccount:
     annotations:
       eks.amazonaws.com/role-arn: <loki-iam-role-arn>
   singleBinary:
     replicas: 1
   minio:
     enabled: false
   gateway:
     enabled: false
   test:
     enabled: false
   monitoring:
     selfMonitoring:
       enabled: false
       grafanaAgent:
         installOperator: false
   lokiCanary:
     enabled: false
   limits_config:
     allow_structured_metadata: true
   memberlist:
     service:
       publishNotReadyAddresses: true
   deploymentMode: SingleBinary
   backend:
     replicas: 0
   read:
     replicas: 0
   write:
     replicas: 0
   ingester:
     replicas: 0
   querier:
     replicas: 0
   queryFrontend:
     replicas: 0
   queryScheduler:
     replicas: 0
   distributor:
     replicas: 0
   compactor:
     replicas: 0
   indexGateway:
     replicas: 0
   bloomCompactor:
     replicas: 0
   bloomGateway:
     replicas: 0
   EOF
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Deploy Grafana Tempo to your cluster.

   ```yaml
   helm upgrade --install tempo tempo \
   --repo https://grafana.github.io/helm-charts \
   --version {{< reuse "agw-docs/versions/otel-stack-tempo.md" >}} \
   --namespace telemetry \
   --create-namespace \
   --values - <<EOF
   persistence:
     enabled: false
   tempo:
     receivers:
       otlp:
         protocols:
           grpc:
             endpoint: 0.0.0.0:4317
   EOF
   ```

3. Verify that the Grafana pods are running. 
   
   ```sh
   kubectl get pods -n telemetry -l 'app.kubernetes.io/name in (loki,tempo)'
   ```
   
   Example output: 
   ```console
   NAME                   READY   STATUS    RESTARTS   AGE
   loki-0                 2/2     Running   0          3m45s
   loki-chunks-cache-0    2/2     Running   0          3m45s
   loki-results-cache-0   2/2     Running   0          3m45s
   tempo-0                1/1     Running   0          2m10s
   ```

## Step 2: Install OTel Collectors for logs and traces {#otel-collector}

The [OTel Collectors](https://opentelemetry.io/docs/collector/) act as the routing hub for logs and traces. The gateway proxy pushes logs and traces to the collectors via OTLP, and each collector forwards data to [Loki](https://grafana.com/oss/loki/) for logs and [Tempo](https://grafana.com/oss/tempo/) for traces. Metrics are handled separately. [Prometheus](https://prometheus.io/) scrapes the control plane and agentgateway proxy metrics endpoints directly via PodMonitor and ServiceMonitor resources, which you set up in a later step.

Deploy separate collectors for logs and traces so you can scale and tune each one independently.

> [!WARNING]
> The example pipelines in both OTel collectors set up the `debug` exporter. This exporter is useful for testing and validation purposes. However, for production scenarios, remove this exporter to avoid performance impacts.

> [!TIP]
> The OTel stack sets up Tempo as your tracing backend. If you want to use a different tracing backend, check out the [Alternative backends]({{< link path="/documentation/observability/traces/configs/" >}}) section. 

1. Deploy the logs collector to process and forward application and access logs.

   ```yaml
   helm upgrade --install opentelemetry-collector-logs opentelemetry-collector \
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
       otlphttp/loki:
         endpoint: http://loki.telemetry.svc.cluster.local:3100/otlp
         tls:
           insecure: true
       debug:
         verbosity: detailed
     service:
       pipelines:
         logs:
           receivers: [otlp]
           processors: [batch]
           exporters: [debug, otlphttp/loki]
   EOF
   ```

2. Deploy the traces collector to handle distributed tracing data.

   ```yaml
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
       debug:
         verbosity: detailed
     service:
       pipelines:
         traces:
           receivers: [otlp]
           processors: [batch]
           exporters: [debug, otlp/tempo]
   EOF
   ```

3. Verify that the OpenTelemetry collector pods are running. 
   
   ```sh
   kubectl get pods -n telemetry -l app.kubernetes.io/name=opentelemetry-collector
   ```
   
   Example output: 
   ```console
   NAME                                               READY   STATUS    RESTARTS   AGE
   opentelemetry-collector-logs-676777487b-wbtkj      1/1     Running   0          56s
   opentelemetry-collector-traces-7696858cf9-tjllx    1/1     Running   0          51s
   ```

4. Create an {{< reuse "agw-docs/snippets/policy.md" >}} resource that points the agentgateway proxy at the OTel logs collector that you created.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: access-logs
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
     frontend:
       accessLog:
         otlp:
           backendRef:
             name: opentelemetry-collector-logs
             namespace: telemetry
             port: 4317
           protocol: GRPC
   EOF
   ```

5. Create an {{< reuse "agw-docs/snippets/policy.md" >}} resource that points the agentgateway proxy at the OTel tracing collector that you created.
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
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
           name: opentelemetry-collector-traces
           namespace: telemetry
           port: 4317
         protocol: GRPC
         randomSampling: "true"
   EOF
   ```

## Step 3: Set up Prometheus {#prometheus}

[Prometheus](https://prometheus.io/) is a monitoring system and time-series database that collects metrics from configured targets at given intervals. It's the de facto standard for metrics collection in cloud-native environments. You can use the [PromQL](https://prometheus.io/docs/prometheus/latest/querying/basics/) query language to set up flexible queries and alerts based on the metrics. This guide uses the [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack) Helm chart, which bundles Prometheus, Grafana, and the Prometheus Operator.

1. Deploy Prometheus in your cluster.

   ```yaml
   helm upgrade --install kube-prometheus-stack kube-prometheus-stack \
   --repo https://prometheus-community.github.io/helm-charts \
   --version {{< reuse "agw-docs/versions/otel-stack-prometheus.md" >}} \
   --namespace telemetry \
   --create-namespace \
   --values - <<EOF
   alertmanager:
     enabled: false
   prometheus:
     prometheusSpec:
       ruleSelectorNilUsesHelmValues: false
       serviceMonitorSelectorNilUsesHelmValues: false
       podMonitorSelectorNilUsesHelmValues: false
       enableFeatures:
         - native-histograms
   grafana:
     enabled: true
     defaultDashboardsEnabled: true
     sidecar:
       dashboards:
         searchNamespace: ALL
     datasources:
      datasources.yaml:
        apiVersion: 1
        datasources:
         - name: Prometheus
           type: prometheus
           uid: prometheus
           access: proxy
           orgId: 1
           url: http://kube-prometheus-stack-prometheus.telemetry:9090
           basicAuth: false
           editable: true
           jsonData:
             httpMethod: GET
             exemplarTraceIdDestinations:
             - name: trace_id
               datasourceUid: tempo
         - name: Tempo
           type: tempo
           access: browser
           basicAuth: false
           orgId: 1
           uid: tempo
           url: http://tempo.telemetry.svc.cluster.local:3100
           isDefault: false
           editable: true
         - orgId: 1
           name: Loki
           type: loki
           typeName: Loki
           access: browser
           url: http://loki.telemetry.svc.cluster.local:3100
           basicAuth: false
           isDefault: false
           editable: true
   EOF
   ```

2. Verify that the Prometheus stack's components are up and running. 

   ```sh
   kubectl get pods -n telemetry -l app.kubernetes.io/instance=kube-prometheus-stack
   ```

   Example output: 
   ```console
   NAME                                                        READY   STATUS    RESTARTS   AGE
   kube-prometheus-stack-grafana-b546d7755-ks7sn               3/3     Running   0          72s
   kube-prometheus-stack-kube-state-metrics-684f8c7558-xhn2p   1/1     Running   0          72s
   kube-prometheus-stack-operator-6dc9c666c5-pwzkb             1/1     Running   0          72s
   kube-prometheus-stack-prometheus-node-exporter-z7csm        1/1     Running   0          72s
   ```

## Step 4: Enable metrics scraping {#enable-monitoring}

Prometheus does not automatically scrape metrics from the {{< reuse "/agw-docs/snippets/agentgateway.md" >}} control plane and proxy metrics endpoints after you installed it. To enable scraping, set `monitoring.enabled=true` in the {{< reuse "/agw-docs/snippets/helm-agentgateway.md" >}} Helm chart. This setting creates the following resources: 

- A **ServiceMonitor** that scrapes the control plane deployment in the `{{< reuse "agw-docs/snippets/namespace.md" >}}` namespace on port `9092`.
- A **PodMonitor** that scrapes proxy pods in the `{{< reuse "agw-docs/snippets/namespace.md" >}}` namespace for the `agentgateway` GatewayClass on port `15020`.

> [!NOTE]
> The PodMonitor only selects proxy pods **in the release namespace** and **for the `agentgateway` GatewayClass** by default. If your Gateway resources provision proxy pods in other namespaces, or if you use additional GatewayClasses, you need additional configuration. See [Scrape additional proxy pods]({{< link-hextra path="/documentation/observability/metrics/overview/#other-proxies" >}}) for the available options.

1. Upgrade your {{< reuse "/agw-docs/snippets/agentgateway.md" >}} installation to enable the monitoring resources.

   ```sh
   helm upgrade -i {{< reuse "agw-docs/snippets/helm-agentgateway.md" >}} \
     {{< reuse "agw-docs/snippets/helm-path.md" >}} \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
     --reuse-values \
     --set monitoring.enabled=true
   ```

   > [!TIP]
   > The `monitoring.serviceMonitor.interval` field controls the scrape interval for both the ServiceMonitor and PodMonitor. If not set, both scrape every 15 seconds. To use a different interval, add `--set monitoring.serviceMonitor.interval=30s` to the command above.

2. Verify that the ServiceMonitor and PodMonitor resources were created.

   ```sh
   kubectl get servicemonitor,podmonitor -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Example output:
   ```console
   NAME                                                     AGE
   servicemonitor.monitoring.coreos.com/agentgateway        5s

   NAME                                                     AGE
   podmonitor.monitoring.coreos.com/agentgateway-proxy      5s
   ```

   Both resources are created. Prometheus begins scraping on the next collection cycle (15 seconds by default).

