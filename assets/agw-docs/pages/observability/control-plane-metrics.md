By default, the {{< reuse "/agw-docs/snippets/kgateway.md" >}} control plane exposes metrics in Prometheus format. You can use these metrics to monitor the health and performance of your gateway environment, or to verify that the control plane is emitting expected metrics when debugging your [observability stack]({{< link-hextra path="/observability/otel-stack/">}}). For more information about how metrics are implemented, refer to the [kgateway project developer docs](https://github.com/kgateway-dev/kgateway/blob/main/devel/architecture/metrics.md).

## Before you begin

{{< reuse "agw-docs/snippets/agentgateway-prereq.md" >}}

## Enable monitoring with Helm {#enable-monitoring}

To enable Prometheus ServiceMonitors and Grafana dashboard ConfigMaps via the {{< reuse "/agw-docs/snippets/helm-kgateway.md" >}} Helm chart, add the `monitoring` section to your Helm values file or pass them via `--set` flags:

```yaml
monitoring:
  enabled: true
  serviceMonitor:
    enabled: true
```YAML
This creates:

* A **ServiceMonitor** for the agentgateway controller (scrapes metrics on port 9092)
* A **PodMonitor** for each proxy pod (scrapes metrics on port 15020)
* A **Grafana dashboard ConfigMap** (discoverable by Grafana sidecar using label `grafana_dashboard: "1"`)

{{< callout type="info" >}}
You need the Prometheus Operator CRDs installed in your cluster for the ServiceMonitor resources to be recognized by Prometheus.
{{< /callout >}}

Alternatively, you can pass these values directly via `helm upgrade`:

```sh
helm upgrade --install agentgateway agentgateway/agentgateway \
  --namespace agentgateway-system --create-namespace \
  --set monitoring.enabled=true \
  --set monitoring.serviceMonitor.enabled=true

```

Once enabled, the metrics are available for scraping by your Prometheus instance, and Grafana can visualize them using the built-in dashboard ConfigMap.



## View control plane metrics {#control-plane-metrics}

The following steps show you how to view the raw metrics endpoint of the control plane deployment.

1. Port-forward the control plane deployment on port 9092.

   ```sh
   kubectl -n {{< reuse "agw-docs/snippets/namespace.md" >}} port-forward deployment/{{< reuse "/agw-docs/snippets/helm-kgateway.md" >}} 9092
   ```

2. Open your browser to the metrics endpoint: [http://localhost:9092/metrics](http://localhost:9092/metrics).

   Example output:

   ```console
   # HELP agentgateway_controller_reconciliations_total Total number of controller reconciliations
   # TYPE agentgateway_controller_reconciliations_total counter
   agentgateway_controller_reconciliations_total{controller="gateway",result="success"} 1
   agentgateway_controller_reconciliations_total{controller="gatewayclass",result="success"} 2
   agentgateway_controller_reconciliations_total{controller="gatewayclass-provisioner",result="success"} 2
   ```

{{< doc-test paths="control-plane-metrics" >}}
YAMLTest -f - <<'EOF'
- name: Control plane metrics endpoint returns HTTP 200
  retries: 3
  http:
    url: "http://localhost:9092/metrics"
    method: GET
  source:
    type: pod
    usePortForward: true
    selector:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: agentgateway
  expect:
    statusCode: 200
EOF
{{< /doc-test >}}

## Control plane metrics reference {#reference}

Review the following table to understand more about each metric.

Helpful terms:

* Controller: A Kubernetes controller that reconciles resources as part of the {{< reuse "/agw-docs/snippets/kgateway.md" >}} control plane deployment.

* Resource: A Kubernetes object that is managed by a controller of the control plane.

* Snapshot: A complete, point-in-time representation of the current state of resources that the controller builds and serves to a gateway proxy via the Envoy extensible Discovery Service (XDS) API.

* Sync: The metrics refer to two kinds of syncs:
  
  * Status sync metrics represent the time it takes for you as a user to view the status that is reported on the resource.
  * Snapshot sync metrics roughly represent the time it takes for a resource change to become effective in the gateway proxies.

* Transform: The process of the control plane converting high-level resources or intermediate representations (IR) into lower-level representations into the structure that the XDS API expects for a snapshot.

{{< version include-if="1.4.x" >}}
{{< reuse "agw-docs/snippets/metrics-control-plane-latest.md" >}}
{{< /version >}}
{{< version include-if="1.5.x" >}}
{{< reuse "agw-docs/snippets/metrics-control-plane-main.md" >}}
{{< /version >}}
