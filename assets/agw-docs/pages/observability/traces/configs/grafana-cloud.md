
[Grafana Cloud](https://grafana.com/products/cloud/) is a managed observability platform. You can send traces to your Grafana Cloud OTLP endpoint from the agentgateway proxy via an OpenTelemetry Collector.

> [!NOTE]
> Grafana Cloud requires an `Authorization` header on every OTLP request. Because the agentgateway tracing policy does not support custom HTTP headers, you must route traces through an OTel Collector that injects the header before forwarding to Grafana Cloud.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Configure tracing

### Step 1: Set up the OTel Collector

1. Follow the [OTel Collector setup]({{< link path="/documentation/observability/traces/configs/otel/" >}}) guide to install a collector in your cluster. Then update the collector's exporter config to forward traces to Grafana Cloud.

2. In Grafana Cloud, go to **My Account → Stack → OpenTelemetry** to find your OTLP endpoint, instance ID, and API token. Then, base64-encode your credentials. 
   ```sh
   echo -n "<instanceID>:<apiToken>" | base64
   ```

3. Add the following exporter to your collector config:
   ```yaml
   exporters:
     otlp/grafana:
       endpoint: https://<your-grafana-otlp-endpoint>:443
       headers:
         Authorization: "Basic <base64-encoded-instanceID:apiToken>"
   ```

### Step 2: Point the tracing policy at the collector

Create an {{< reuse "agw-docs/snippets/policy.md" >}} that points the agentgateway proxy at the OTel Collector — not at Grafana Cloud directly.

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
        name: opentelemetry-collector
        namespace: tracing
        port: 4317
      protocol: GRPC
      randomSampling: "true"
EOF
```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

Delete the {{< reuse "agw-docs/snippets/policy.md" >}} resource.

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} tracing -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
