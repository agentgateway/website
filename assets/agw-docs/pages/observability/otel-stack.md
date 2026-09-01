## Step 1: Install Grafana Loki and Tempo {#grafana}

[Grafana](https://grafana.com/) is a suite of open source tools that help you analyze, visualize, and monitor data in your cluster. For the OTel stack, you install the following Grafana components:

* **[Loki](https://grafana.com/oss/loki/)**: A log aggregation system that indexes metadata about your logs as a set of labels, not the actual log contents. This way, Loki is more cost-efficient and performant than traditional log aggregation systems.
  > [!TIP]
  > Loki works best when you use structured logging in your applications, such as JSON format.
* **[Tempo](https://grafana.com/oss/tempo/)**: A distributed tracing system that stores trace data in object storage (like Amazon S3) and integrates seamlessly with Grafana for visualization. Distributed tracing helps you see how requests move through a microservices environment, which helps you identify performance bottlenecks, debug issues, and otherwise monitor your system's health to ensure SLA compliance.

Steps to install:

1. Deploy Grafana Loki to your cluster.

   ```yaml {paths="otel-stack"}
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
     auth_enabled: false
   singleBinary:
     replicas: 1
   minio:
     enabled: true
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

2. Deploy Grafana Tempo to your cluster.

   ```yaml {paths="otel-stack"}
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

{{< doc-test paths="otel-stack" >}}
YAMLTest -f - <<'EOF'
- name: wait for Loki StatefulSet to be ready
  wait:
    target:
      kind: StatefulSet
      metadata:
        namespace: telemetry
        name: loki
    jsonPath: "$.status.readyReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 400
      intervalSeconds: 5
- name: wait for Tempo StatefulSet to be ready
  wait:
    target:
      kind: StatefulSet
      metadata:
        namespace: telemetry
        name: tempo
    jsonPath: "$.status.readyReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 400
      intervalSeconds: 5
EOF
{{< /doc-test >}}

## Step 2: Install OTel Collectors for logs and traces {#otel-collector}

The [OTel Collectors](https://opentelemetry.io/docs/collector/) act as the routing hub for logs and traces. The gateway proxy pushes logs and traces to the collectors via OTLP, and each collector forwards data to [Loki](https://grafana.com/oss/loki/) for logs and [Tempo](https://grafana.com/oss/tempo/) for traces. Metrics are handled separately. [Prometheus](https://prometheus.io/) scrapes the control plane and agentgateway proxy metrics endpoints directly via PodMonitor and ServiceMonitor resources, which you set up in a later step.

Deploy separate collectors for logs and traces so you can scale and tune each one independently.

> [!WARNING]
> The example pipelines in both OTel collectors set up the `debug` exporter. This exporter is useful for testing and validation purposes. However, for production scenarios, remove this exporter to avoid performance impacts.

> [!TIP]
> The OTel stack sets up Tempo as your tracing backend. If you want to use a different tracing backend, check out the [Alternative backends]({{< link path="/observability/traces/configs/" >}}) section. 

1. Deploy the logs collector to process and forward application and access logs.

   ```yaml {paths="otel-stack"}
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

   ```yaml {paths="otel-stack"}
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

{{< doc-test paths="otel-stack" >}}
YAMLTest -f - <<'EOF'
- name: wait for logs collector deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: telemetry
        name: opentelemetry-collector-logs
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
- name: wait for traces collector deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: telemetry
        name: opentelemetry-collector-traces
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF
{{< /doc-test >}}

## Step 3: Set up Prometheus {#prometheus}

[Prometheus](https://prometheus.io/) is a monitoring system and time-series database that collects metrics from configured targets at given intervals. It's the de facto standard for metrics collection in cloud-native environments. You can use the [PromQL](https://prometheus.io/docs/prometheus/latest/querying/basics/) query language to set up flexible queries and alerts based on the metrics. This guide uses the [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack) Helm chart, which bundles Prometheus, Grafana, and the Prometheus Operator.

1. Deploy Prometheus in your cluster.

   ```yaml {paths="otel-stack"}
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

{{< doc-test paths="otel-stack" >}}
YAMLTest -f - <<'EOF'
- name: wait for Grafana deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: telemetry
        name: kube-prometheus-stack-grafana
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 400
      intervalSeconds: 5
EOF
{{< /doc-test >}}

{{< doc-test paths="otel-stack" >}}
YAMLTest -f - <<'EOF'
- name: wait for Prometheus StatefulSet to be ready
  wait:
    target:
      kind: StatefulSet
      metadata:
        namespace: telemetry
        name: prometheus-kube-prometheus-stack-prometheus
    jsonPath: "$.status.readyReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 400
      intervalSeconds: 5
EOF
{{< /doc-test >}}

## Step 4: Enable metrics scraping {#enable-monitoring}

Prometheus does not automatically scrape metrics from the {{< reuse "/agw-docs/snippets/agentgateway.md" >}} control plane and proxy metrics endpoints after you installed it. To enable scraping, set `monitoring.enabled=true` in the {{< reuse "/agw-docs/snippets/helm-agentgateway.md" >}} Helm chart. This setting creates the following resources: 

- A **ServiceMonitor** that scrapes the control plane deployment in the `{{< reuse "agw-docs/snippets/namespace.md" >}}` namespace on port `9092`.
- A **PodMonitor** that scrapes proxy pods in the `{{< reuse "agw-docs/snippets/namespace.md" >}}` namespace for the `agentgateway` GatewayClass on port `15020`.

> [!NOTE]
> The PodMonitor only selects proxy pods **in the release namespace** and **for the `agentgateway` GatewayClass** by default. If your Gateway resources provision proxy pods in other namespaces, or if you use additional GatewayClasses, you need additional configuration. See [Scrape additional proxy pods]({{< link-hextra path="/observability/metrics/overview/#other-proxies" >}}) for the available options.

1. Upgrade your {{< reuse "/agw-docs/snippets/agentgateway.md" >}} installation to enable the monitoring resources.

   ```sh {paths="otel-stack"}
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

{{< doc-test paths="otel-stack" >}}
YAMLTest -f - <<'EOF'
- name: verify ServiceMonitor for agentgateway control plane is created
  command:
    command: "kubectl get servicemonitor agentgateway -n {{< reuse "agw-docs/snippets/namespace.md" >}}"
  source:
    type: local
  expect:
    exitCode: 0
- name: verify PodMonitor for agentgateway proxy is created
  command:
    command: "kubectl get podmonitor agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}"
  source:
    type: local
  expect:
    exitCode: 0
EOF
{{< /doc-test >}}

{{< doc-test paths="otel-stack" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES, end to end:
#   * Dashboard import: the "Explore Grafana dashboards" step confirms that Grafana loaded the
#     imported Agentgateway dashboard (by uid). The metrics below back the dashboard's panels.
#   * "Requests" panels: agentgateway_requests_total (data plane) is in Prometheus, which proves
#     the data-plane scrape job works via PodMonitor.
#   * Control-plane scrape job: agentgateway_controller_reconciliations_total is in Prometheus,
#     which proves the control-plane scrape job works via ServiceMonitor.
#   * "Overview" Memory and CPU panels: the cAdvisor metrics (container_memory_working_set_bytes,
#     container_cpu_usage_seconds_total) for the agentgateway namespace, plus the
#     agentgateway_build_info series those panels (and "Build Versions") join on.
#   * "Latency by Route" panel: agentgateway_request_duration_seconds_bucket.
#   * "XDS" panels: agentgateway_xds_message_total.
#   * "Runtime" panels: agentgateway_tokio_num_workers (Tokio Runtime),
#     agentgateway_process_rss (Process Memory), agentgateway_cgroup_working_set (Cgroup Memory).
#   * Backend readiness: Loki, Tempo, the two OTel collectors, Prometheus, and Grafana
#     are all confirmed to be running.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * Logs (Loki) and traces (Tempo) storage. This guide installs the Loki/Tempo backends and
#     the logs/traces OTel collectors, but it does NOT wire the agentgateway proxy to export
#     logs or traces to them, so both backends stay empty. Confirmed by querying Loki (no
#     namespace label values) and Tempo (empty search) on a live run. Sending logs and traces
#     requires extra proxy configuration covered on the access logging and tracing pages
#     (an `OtlpAccessLog` access-log policy and a tracing policy). Only backend readiness is
#     checked here.
#   * The dashboard's "LLM" and "MCP" panels (for example `agentgateway_gen_ai_*` and
#     `agentgateway_mcp_requests_total`), which require LLM and MCP traffic that this guide
#     does not generate.
#   * Visual rendering of any panel. The test only confirms that the metrics behind the panels
#     exist in Prometheus and that Grafana loaded the dashboard.
# ============================================================================
export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
# Generate data-plane traffic through the agentgateway proxy, then allow time for Prometheus
# to scrape the proxy pods via PodMonitor (default 15s scrape interval). The loop runs for
# more than ten scrape intervals to ensure at least one full scrape cycle completes.
for i in $(seq 1 30); do
  curl -s --max-time 5 -o /dev/null "http://${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com" || true
  sleep 5
done
{{< /doc-test >}}

{{< doc-test paths="otel-stack" >}}
YAMLTest -f - <<'EOF'
# Confirm that the metrics behind the dashboard reach the Prometheus backend. A non-empty
# query result means the metric was scraped (from the proxy, the control plane, or cAdvisor)
# and stored. The PromQL label matchers in some queries are URL-encoded
# ( %7B = "{", %3D = "=", %22 = '"', %7D = "}" ).
#
# Data plane: the "Requests" dashboard panels use agentgateway_requests_total.
- name: agentgateway data-plane metrics are stored in Prometheus
  retries: 5
  http:
    url: "http://localhost:9090/api/v1/query?query=agentgateway_requests_total"
    method: GET
  source:
    type: pod
    usePortForward: true
    selector:
      kind: StatefulSet
      metadata:
        namespace: telemetry
        name: prometheus-kube-prometheus-stack-prometheus
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.data.result[0].value[1]"
        comparator: exists
# Control plane: emitted by the agentgateway controller and collected by the control-plane
# scrape job. The controller reconciles resources on startup, so this is non-zero without
# any data-plane traffic.
- name: agentgateway control-plane metrics are stored in Prometheus
  retries: 5
  http:
    url: "http://localhost:9090/api/v1/query?query=agentgateway_controller_reconciliations_total"
    method: GET
  source:
    type: pod
    usePortForward: true
    selector:
      kind: StatefulSet
      metadata:
        namespace: telemetry
        name: prometheus-kube-prometheus-stack-prometheus
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.data.result[0].value[1]"
        comparator: exists
# Overview panels: the Memory and CPU panels join cAdvisor metrics on agentgateway_build_info.
- name: Overview panel join series (agentgateway_build_info) is stored in Prometheus
  retries: 5
  http:
    url: "http://localhost:9090/api/v1/query?query=agentgateway_build_info"
    method: GET
  source:
    type: pod
    usePortForward: true
    selector:
      kind: StatefulSet
      metadata:
        namespace: telemetry
        name: prometheus-kube-prometheus-stack-prometheus
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.data.result[0].value[1]"
        comparator: exists
# Overview "Memory" panel input: container_memory_working_set_bytes{namespace="agentgateway-system"}
# ( %7B = "{", %3D = "=", %22 = '"', %7D = "}" )
- name: Memory panel data (container_memory_working_set_bytes) is stored in Prometheus
  retries: 5
  http:
    url: "http://localhost:9090/api/v1/query?query=container_memory_working_set_bytes%7Bnamespace%3D%22agentgateway-system%22%7D"
    method: GET
  source:
    type: pod
    usePortForward: true
    selector:
      kind: StatefulSet
      metadata:
        namespace: telemetry
        name: prometheus-kube-prometheus-stack-prometheus
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.data.result[0].value[1]"
        comparator: exists
# Overview "CPU" panel input: container_cpu_usage_seconds_total{namespace="agentgateway-system"}
- name: CPU panel data (container_cpu_usage_seconds_total) is stored in Prometheus
  retries: 5
  http:
    url: "http://localhost:9090/api/v1/query?query=container_cpu_usage_seconds_total%7Bnamespace%3D%22agentgateway-system%22%7D"
    method: GET
  source:
    type: pod
    usePortForward: true
    selector:
      kind: StatefulSet
      metadata:
        namespace: telemetry
        name: prometheus-kube-prometheus-stack-prometheus
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.data.result[0].value[1]"
        comparator: exists
# "Latency by Route" panel: agentgateway_request_duration_seconds_bucket (emitted per request).
- name: Latency panel data (agentgateway_request_duration_seconds_bucket) is stored in Prometheus
  retries: 5
  http:
    url: "http://localhost:9090/api/v1/query?query=agentgateway_request_duration_seconds_bucket"
    method: GET
  source:
    type: pod
    usePortForward: true
    selector:
      kind: StatefulSet
      metadata:
        namespace: telemetry
        name: prometheus-kube-prometheus-stack-prometheus
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.data.result[0].value[1]"
        comparator: exists
# "XDS" panels: agentgateway_xds_message_total (xDS config messages exchanged with the proxy).
- name: XDS panel data (agentgateway_xds_message_total) is stored in Prometheus
  retries: 5
  http:
    url: "http://localhost:9090/api/v1/query?query=agentgateway_xds_message_total"
    method: GET
  source:
    type: pod
    usePortForward: true
    selector:
      kind: StatefulSet
      metadata:
        namespace: telemetry
        name: prometheus-kube-prometheus-stack-prometheus
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.data.result[0].value[1]"
        comparator: exists
# "Runtime" - Tokio Runtime panel: agentgateway_tokio_num_workers.
- name: Tokio Runtime panel data (agentgateway_tokio_num_workers) is stored in Prometheus
  retries: 5
  http:
    url: "http://localhost:9090/api/v1/query?query=agentgateway_tokio_num_workers"
    method: GET
  source:
    type: pod
    usePortForward: true
    selector:
      kind: StatefulSet
      metadata:
        namespace: telemetry
        name: prometheus-kube-prometheus-stack-prometheus
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.data.result[0].value[1]"
        comparator: exists
# "Runtime" - Process Memory panel: agentgateway_process_rss.
- name: Process Memory panel data (agentgateway_process_rss) is stored in Prometheus
  retries: 5
  http:
    url: "http://localhost:9090/api/v1/query?query=agentgateway_process_rss"
    method: GET
  source:
    type: pod
    usePortForward: true
    selector:
      kind: StatefulSet
      metadata:
        namespace: telemetry
        name: prometheus-kube-prometheus-stack-prometheus
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.data.result[0].value[1]"
        comparator: exists
# "Runtime" - Cgroup Memory panel: agentgateway_cgroup_working_set.
- name: Cgroup Memory panel data (agentgateway_cgroup_working_set) is stored in Prometheus
  retries: 5
  http:
    url: "http://localhost:9090/api/v1/query?query=agentgateway_cgroup_working_set"
    method: GET
  source:
    type: pod
    usePortForward: true
    selector:
      kind: StatefulSet
      metadata:
        namespace: telemetry
        name: prometheus-kube-prometheus-stack-prometheus
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.data.result[0].value[1]"
        comparator: exists
EOF
{{< /doc-test >}}

