
The agentgateway proxy exposes a Prometheus-compatible metrics endpoint on port `15020`. Metrics are collected automatically for every request that passes through the gateway and follow the [OpenMetrics](https://openmetrics.io/) format. All agentgateway metrics use the `agentgateway_` prefix.

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x,2.2.x" >}}
When a gateway joins an Istio ambient mesh through the `spec.istio` section of its `AgentgatewayParameters` resource, a Prometheus instance in the mesh can scrape this endpoint over HBONE with no extra setup. Routes and policies do not apply to the metrics request.
{{< /version >}}

To set up automatic scraping of these metrics with Prometheus, see [Enable metrics scraping]({{< link path="/documentation/observability/metrics/overview/" >}}).

## View data plane metrics

1. Port-forward the agentgateway proxy.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} deploy/agentgateway-proxy 15020:15020
   ```

2. Query the metrics endpoint.

   ```sh
   curl http://localhost:15020/metrics
   ```

3. Enable metrics scraping for data plane metrics with the OTel stack so that you can export and visualize metrics in monitoring tools, such as Prometheus and Grafana. For more information, see [Scrape metrics for querying and visualization]({{< link path="/documentation/observability/metrics/overview/" >}}).

## Metrics format {#metrics-format}

{{< reuse "agw-docs/snippets/metrics-format.md" >}}

## Add custom metric labels

You can enrich all metrics with custom labels computed from [CEL]({{< link path="/reference/cel/" >}}) expressions by using an {{< reuse "agw-docs/snippets/policy.md" >}}. Labels are added to every metric that carries route identifier labels.

The following example adds two labels to all metrics:
- `team`: A dynamic label computed from a JWT claim, so each metric reflects the team that owns the request.
- `org`: A dynamic label read from the `x-org-id` request header.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: metrics-labels
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
  frontend:
    metrics:
      attributes:
        add:
        - name: team
          expression: jwt.team
        - name: org
          expression: 'request.headers["x-org-id"]'
EOF
```

> [!WARNING]
> High-cardinality labels, such as per-user IDs, can significantly increase Prometheus storage and memory usage. Prefer low-cardinality dimensions such as team or environment.

> [!NOTE]
> The Kubernetes API only supports adding labels. Removing default metric labels or an entire metric is not supported via {{< reuse "agw-docs/snippets/policy.md" >}} resource.

