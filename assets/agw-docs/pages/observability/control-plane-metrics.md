By default, the {{< reuse "/agw-docs/snippets/kgateway.md" >}} control plane exposes metrics in Prometheus format. You can use these metrics to monitor the health and performance of your gateway environment, or to verify that the control plane is emitting expected metrics when debugging your [observability stack]({{< link-hextra path="/observability/otel-stack/">}}). For more information about how metrics are implemented, refer to the [kgateway project developer docs](https://github.com/kgateway-dev/kgateway/blob/main/devel/architecture/metrics.md).

## Before you begin

{{< reuse "agw-docs/snippets/agentgateway-prereq.md" >}}

{{< version exclude-if="1.4.x,1.3.x,1.2.x,1.1.x,1.0.x,2.2.x,2.3.x" >}}
## Enable monitoring with Helm {#enable-monitoring}

The {{< reuse "/agw-docs/snippets/helm-agentgateway.md" >}} Helm chart can create the Prometheus and Grafana resources that collect and visualize these metrics. The chart does not create these resources by default.

> [!IMPORTANT]
> Install the Prometheus Operator custom resource definitions (CRDs) in your cluster before you enable monitoring. Without the CRDs, Prometheus cannot recognize the ServiceMonitor and PodMonitor resources that the chart creates.

1. Create a `monitoring-values.yaml` file that enables the monitoring resources.

   ```yaml
   monitoring:
     enabled: true
   ```

   Review the following table to understand the resources that the chart creates when you set `monitoring.enabled` to `true`. To disable or tune an individual resource, set the fields in its own section of the `monitoring` section.

   | Resource | What it scrapes | Section to tune |
   | -- | -- | -- |
   | ServiceMonitor | The control plane deployment on the `metrics` port, `9092` by default | `monitoring.serviceMonitor` |
   | PodMonitor | The proxy pods for the GatewayClasses in `monitoring.proxy.gatewayClassNames` on the `metrics` port, `15020` by default | `monitoring.proxy` |
   | ConfigMap for the Grafana dashboard | Nothing. The Grafana sidecar discovers the ConfigMap through the `grafana_dashboard: "1"` label. | `monitoring.grafanaDashboard` |

   > [!NOTE]
   > The PodMonitor selects proxy pods in the {{< reuse "agw-docs/snippets/namespace.md" >}} namespace only. Because gateway proxies usually run in the namespace of the Gateway that provisions them, set `monitoring.proxy.namespaceSelector` to `{any: true}` to scrape proxies in every namespace, or to a `matchNames` list to scrape specific namespaces.

2. Upgrade your {{< reuse "/agw-docs/snippets/kgateway.md" >}} installation with the values file.

   ```sh
   helm upgrade -i -n {{< reuse "agw-docs/snippets/namespace.md" >}} {{< reuse "agw-docs/snippets/helm-agentgateway.md" >}} {{< reuse "/agw-docs/snippets/helm-path.md" >}} \
   --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
   -f monitoring-values.yaml
   ```

3. Verify that the monitoring resources are created.

   ```sh
   kubectl get servicemonitor,podmonitor,configmap -n {{< reuse "agw-docs/snippets/namespace.md" >}} -l app.kubernetes.io/name={{< reuse "agw-docs/snippets/helm-agentgateway.md" >}}
   ```

   Example output:

   ```console
   NAME                                                AGE
   servicemonitor.monitoring.coreos.com/agentgateway   3s

   NAME                                                  AGE
   podmonitor.monitoring.coreos.com/agentgateway-proxy   3s

   NAME                               DATA   AGE
   configmap/agentgateway-dashboard   1      3s
   ```

Your Prometheus instance now scrapes the control plane and proxy metrics, and Grafana loads the dashboard from the ConfigMap.
{{< /version >}}

## View control plane metrics {#control-plane-metrics}

The following steps show you how to view the raw metrics endpoint of the control plane deployment.

1. Port-forward the control plane deployment on port 9092.

   ```sh
   kubectl -n {{< reuse "agw-docs/snippets/namespace.md" >}} port-forward deployment/{{< reuse "/agw-docs/snippets/helm-agentgateway.md" >}} 9092
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
