
Metrics are numerical measurements collected at regular intervals that describe the state and behavior of a system. In a gateway environment, metrics tell you how many requests are being processed, how long they take, how many fail, how much memory the process uses, and whether the control plane is keeping up with configuration changes. Without metrics, you rely on guesswork to detect problems, diagnose slowdowns, or prove that an issue is resolved.

Agentgateway emits metrics automatically on two separate ports, one for the control plane and one for the data plane. No additional configuration is required to enable them. You can access either endpoint immediately after installation by port-forwarding to the respective pod and sending a request to the `/metrics` path.

| Plane | Component | Default port | Path |
| --- | --- | --- | --- |
| Control plane | `deployment/agentgateway` | `9092` | `/metrics` |
| Data plane | Per Gateway, such as the example `deploy/agentgateway-proxy` | `15020` | `/metrics` |

## Access metrics

You can inspect raw metrics directly from either endpoint without installing any monitoring tools.

1. View control plane metrics. 
   1. Port-forward the control plane deployment.
      ```sh
      kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} deployment/agentgateway 9092:9092
      ```

   2. Query the metrics endpoint.
      ```sh
      curl http://localhost:9092/metrics
      ```

2. View data plane metrics. 
   1. Port-forward the proxy deployment.
      ```sh
      kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} deploy/agentgateway-proxy 15020:15020
      ```
   2. Query the metrics endpoint.
      ```sh
      curl http://localhost:15020/metrics
      ```

Both endpoints return metrics in the [OpenMetrics](https://openmetrics.io/) format. All agentgateway metrics use the `agentgateway_` prefix. For the full list of available metrics, see [Control plane metrics]({{< link path="/documentation/observability/metrics/control-plane/" >}}) and [Data plane metrics]({{< link path="/documentation/observability/metrics/dataplane/" >}}).

## Scrape metrics for querying and visualization

Curling the metrics endpoint gives you a point-in-time snapshot, but it does not let you query metrics across time, set alerts, or see trends. To enable monitoring and alerting on metrics, you typically have an observability tool that scrapes the metrics endpoint on a regular interval and stores the data in a time series database that you can query and graph.

{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} integrates well with the following tools: 

- **[Prometheus](https://prometheus.io/)**: An open-source monitoring system that can scrape the `/metrics` endpoints on a regular interval. Metrics are stored as a time series, and you can use PromQL to query them. To scrape metrics from pods with Prometheus, you either add Prometheus-specific scraping annotations to the pod, or use the built-in PodMonitor and ServiceMonitor resources that the {{< reuse "agw-docs/snippets/agentgateway.md" >}} Helm chart creates for you when you set `monitoring.enabled` to `true`.
- **[Grafana](https://grafana.com/)**: An open-source visualization platform that connects to Prometheus as a data source and renders dashboards, graphs, and alerts from PromQL queries. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} ships a pre-built dashboard that covers requests, LLM traffic, MCP traffic, and connections.

The {{< reuse "agw-docs/snippets/agentgateway.md" >}} Helm chart includes a `monitoring` section that creates the ServiceMonitor, PodMonitor, and Grafana dashboard ConfigMap for you so that you can use Prometheus and Grafana without any additional configuration to monitor the {{< reuse "agw-docs/snippets/agentgateway.md" >}} control and data plane. These resources are discovered automatically when you use the [OTel stack]({{< link path="/documentation/observability/otel-stack/" >}}), which configures Prometheus and Grafana to pick them up with no extra setup.

| Resource | Scrape source | Helm section to tune |
| --- | --- | --- |
| `ServiceMonitor` | Control plane on port `9092` | `monitoring.serviceMonitor` |
| `PodMonitor` | Proxy pods on port `15020`, selected by GatewayClass name | `monitoring.proxy` |
| `ConfigMap` (Grafana dashboard) | Nothing. Grafana discovers it through the `grafana_dashboard: "1"` label. | `monitoring.grafanaDashboard` |

### Enable control and data plane scraping

Follow the [OTel stack guide]({{< link path="/documentation/observability/otel-stack/" >}}) to install the observability tools, including Prometheus and Grafana, and set `monitoring.enabled=true` to create the ServiceMonitor, PodMonitor, and Grafana dashboard ConfigMap. 

> [!NOTE]
> By default, the PodMonitor that the Helm chart creates only scrapes proxy pods in the release namespace and for the `agentgateway` GatewayClass. If you need to scrape proxies in other namespaces or for additional GatewayClasses, see [Scrape additional proxy pods](#other-proxies).

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x" >}}
The PodMonitor also copies the `gateway.networking.k8s.io/gateway-name` pod label onto the metrics that it scrapes, which is how the built-in Grafana dashboard discovers gateways and filters panels by gateway. If you set your own `monitoring.proxy.podMonitor.podTargetLabels` list, include that label, or the dashboard's gateway selector stays empty.
{{< /version >}}

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}
### Relabel scraped metrics {#relabel-metrics}

Add Prometheus Operator relabeling rules to the ServiceMonitor and PodMonitor that the Helm chart creates. The chart supports two kinds of rules:
* `relabelings` apply to the scrape target before Prometheus scrapes it, such as to change the labels that come from the pod or service.
* `metricRelabelings` apply to each scraped metric before Prometheus stores it, such as to drop a metric or a label.

1. Save the relabeling rules in a Helm values file. The following example drops the `agentgateway_upstream_call_duration_seconds` histogram from the proxy metrics before Prometheus stores it.

   ```yaml
   cat <<'EOF' > relabel-values.yaml
   monitoring:
     enabled: true
     proxy:
       podMonitor:
         metricRelabelings:
         - sourceLabels: [__name__]
           regex: agentgateway_upstream_call_duration_seconds.*
           action: drop
   EOF
   ```

   | Value | Description |
   | --- | --- |
   | `monitoring.serviceMonitor.relabelings` | A list of Prometheus Operator relabeling rules that apply to the control plane target before it is scraped. |
   | `monitoring.serviceMonitor.metricRelabelings` | A list of Prometheus Operator relabeling rules that apply to the scraped control plane metrics before they are stored. |
   | `monitoring.proxy.podMonitor.relabelings` | A list of Prometheus Operator relabeling rules that apply to the proxy targets before they are scraped. |
   | `monitoring.proxy.podMonitor.metricRelabelings` | A list of Prometheus Operator relabeling rules that apply to the scraped proxy metrics before they are stored. |

2. Upgrade the Helm release with the relabeling values.

   ```sh
   helm upgrade -i {{< reuse "agw-docs/snippets/helm-agentgateway.md" >}} \
     {{< reuse "agw-docs/snippets/helm-path.md" >}} \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
     --reuse-values \
     -f relabel-values.yaml
   ```

3. After the next scrape, verify in the Prometheus UI that the following query returns no new data.

   ```promql
   agentgateway_upstream_call_duration_seconds_count
   ```

### Native and classic histograms {#histogram-types}

Duration and size metrics, such as `agentgateway_request_duration_seconds` and `agentgateway_gen_ai_client_token_usage`, are Prometheus histograms, which count observations in buckets. Prometheus supports two kinds of histograms:
* **Classic histograms** use a fixed set of bucket boundaries. Each bucket is its own time series with a `_bucket` suffix and an `le` label, next to `_sum` and `_count` series.
* **[Native histograms](https://prometheus.io/docs/specs/native_histograms/)** choose exponential bucket boundaries automatically and store all buckets in one time series. They give higher-resolution percentiles, usually at a lower storage cost. They are exposed only through the Prometheus protobuf format.

The control plane does not emit histograms. Proxies emit classic histograms by default and can emit native histograms or both.

Emit both to migrate dashboards and alerts to native histograms gradually. Keep classic histograms for the built-in Grafana dashboard, which calculates percentiles from `_bucket` series.

#### Scrape native histograms {#native-histograms}

To get higher-resolution percentiles in Prometheus, make the proxies emit native histograms, and make the ServiceMonitor and PodMonitor that the Helm chart creates scrape them. Both settings are off by default.

Before you begin, make sure that you have the following:
* Scraping enabled as described in [Enable control and data plane scraping](#enable-control-and-data-plane-scraping).
* Prometheus v3.8.0 or later.
* Prometheus Operator v0.88.0 or later, which adds the `scrapeNativeHistograms` field to the ServiceMonitor and PodMonitor CRDs.

> [!NOTE]
> The [OTel stack guide]({{< link path="/documentation/observability/otel-stack/" >}}) installs `kube-prometheus-stack` version {{< reuse "agw-docs/versions/otel-stack-prometheus.md" >}}, which might include an older Prometheus Operator. Check the version of your Prometheus Operator before you continue. `kube-prometheus-stack` version 81.0.0 and later include Prometheus Operator v0.88.0 or later. With an older Prometheus Operator, the Kubernetes API server drops the `scrapeNativeHistograms` field from the ServiceMonitor and PodMonitor and Prometheus does not scrape native histograms.

1. Make the proxies emit native and classic histograms. Add the following setting to the `rawConfig` of the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource that your Gateway uses. For how to create and attach the resource, see [`rawConfig`]({{< link path="/documentation/setup/customize/customize/#rawconfig" >}}). The proxy reads this setting only at startup, so the proxy pods restart.

   ```yaml
   spec:
     rawConfig:
       config:
         histograms: both
   ```

   | Setting | Description |
   | --- | --- |
   | `config.histograms` | The histograms that the proxy emits: `classic`, `native`, or `both`. The default value is `classic`. The example uses `both` so that the built-in Grafana dashboard keeps working. |

2. Save the scrape settings in a values file.

   ```yaml
   cat <<'EOF' > histogram-values.yaml
   monitoring:
     enabled: true
     serviceMonitor:
       scrapeNativeHistograms: true
       scrapeClassicHistograms: true
     proxy:
       podMonitor:
         scrapeNativeHistograms: true
         scrapeClassicHistograms: true
   EOF
   ```

   | Value | Description |
   | --- | --- |
   | `monitoring.serviceMonitor.scrapeNativeHistograms` | Scrapes native histograms from the control plane. When set to `true`, the chart adds `PrometheusProto` to the ServiceMonitor scrape protocols. The default value is `false`. |
   | `monitoring.serviceMonitor.scrapeClassicHistograms` | Scrapes classic histograms from the control plane. The default value is `true`. |
   | `monitoring.proxy.podMonitor.scrapeNativeHistograms` | Scrapes native histograms from the proxies. When set to `true`, the chart adds `PrometheusProto` to the PodMonitor scrape protocols. The default value is `false`. |
   | `monitoring.proxy.podMonitor.scrapeClassicHistograms` | Scrapes classic histograms from the proxies. The default value is `true`. |

3. Upgrade the Helm release with the scrape values.

   ```sh
   helm upgrade -i {{< reuse "agw-docs/snippets/helm-agentgateway.md" >}} \
     {{< reuse "agw-docs/snippets/helm-path.md" >}} \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
     --reuse-values \
     -f histogram-values.yaml
   ```

4. Verify that the ServiceMonitor and PodMonitor scrape native histograms. In the output, each resource sets `scrapeNativeHistograms` to `true`, and its `scrapeProtocols` list starts with `PrometheusProto`.

   ```sh
   kubectl get servicemonitor,podmonitor -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o yaml
   ```

5. Send a few requests through your gateway. Then, in the Prometheus UI, run the following query. The query uses the metric name without the `_bucket` suffix, so it returns a result only when Prometheus stores a native histogram.

   ```promql
   histogram_quantile(0.95, sum(rate(agentgateway_request_duration_seconds[5m])))
   ```

{{< /version >}}

### Scrape additional proxy pods {#other-proxies}

The {{< reuse "agw-docs/snippets/agentgateway.md" >}} Helm chart creates a single PodMonitor resource in the release namespace when `monitoring.enabled` is set to `true`. By default, the PodMonitor resource only finds proxy pods that are deployed to the same release namespace. Because gateway proxies run in the namespace of the Gateway resource that provisions them, proxies in other namespaces are not scraped automatically. To scape proxy pods in other namespaces, you must use the `namespaceSelector` field. 

**Scrape proxies in all namespaces**: 

To scrape proxy pods in every namespace, set `monitoring.proxy.namespaceSelector` to `any: true` as shown in the following example. 

```yaml
cat <<EOF > monitoring-values.yaml
monitoring:
  enabled: true
  serviceMonitor:
    extraLabels:
      release: kube-prometheus-stack
  proxy:
    namespaceSelector:
      any: true
EOF
```

**Limit the number of proxy namespaces**: 

To scrape proxy pods in specific namespaces only, use a `matchNames` list instead as shown in the following example. 

```yaml
cat <<EOF > monitoring-values.yaml
monitoring:
  enabled: true
  serviceMonitor:
    extraLabels:
      release: kube-prometheus-stack
  proxy:
    namespaceSelector:
      matchNames:
      - agentgateway-system
      - my-other-namespace
EOF
```

**Scrape proxies for specific GatewayClasses**:

By default, the PodMonitor selects proxy pods that belong to the `agentgateway` GatewayClass. If you use multiple GatewayClasses and want to scrape proxy pods for all of them, add each class name to `monitoring.proxy.gatewayClassNames`.

```yaml
cat <<EOF > monitoring-values.yaml
monitoring:
  enabled: true
  serviceMonitor:
    extraLabels:
      release: kube-prometheus-stack
  proxy:
    gatewayClassNames:
    - agentgateway
    - my-other-gatewayclass
EOF
```

### Grafana dashboard discovery across namespaces

When you install the `kube-prometheus-stack` Helm chart, Grafana is deployed as a pod with three containers: `grafana`, `grafana-sc-datasources`, and `grafana-sc-dashboard`. The `grafana-sc-dashboard` container is a sidecar from the [`kiwigrid/k8s-sidecar`](https://github.com/kiwigrid/k8s-sidecar) image that is bundled with the Grafana Helm chart. It watches the Kubernetes API for ConfigMaps that carry the `grafana_dashboard: "1"` label and automatically copies their JSON content into the Grafana pod's dashboard directory, where Grafana's file-based provisioner picks it up. No separate installation or Grafana restart is needed to see these dashboards.

By default, the sidecar only watches the namespace where Grafana is installed. If the ConfigMap for the {{< reuse "agw-docs/snippets/agentgateway.md" >}} dashboard is in a different namespace, the sidecar does not discover it and the dashboard does not appear in Grafana.

To allow the sidecar to find ConfigMaps in all namespaces, set `sidecar.dashboards.searchNamespace` to `ALL` when installing or upgrading the `kube-prometheus-stack` chart. 

```sh
helm upgrade kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n monitoring \
  --reuse-values \
  --set grafana.sidecar.dashboards.searchNamespace=ALL
```

To restrict discovery to specific namespaces, pass a comma-separated list of namespace names instead of `ALL`:

```sh
helm upgrade kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n monitoring \
  --reuse-values \
  --set grafana.sidecar.dashboards.searchNamespace="monitoring,agentgateway-system"
```

## Learn more

{{< cards >}}
  {{< card path="/documentation/observability/metrics/control-plane/" title="Control plane metrics" subtitle="View and reference control plane metrics" >}}
  {{< card path="/documentation/observability/metrics/dataplane/" title="Data plane metrics" subtitle="View and customize data plane metrics" >}}
  {{< card path="/documentation/observability/otel-stack/" title="OTel stack" subtitle="Set up Prometheus and Grafana with the recommended observability stack" >}}
{{< /cards >}}
