
[Honeycomb](https://www.honeycomb.io/) is an observability platform. You can send traces to the Honeycomb OTLP API from the agentgateway proxy via an OpenTelemetry Collector.

> [!NOTE]
> Honeycomb requires an `x-honeycomb-team` header on every OTLP request. Because the agentgateway tracing policy does not support custom HTTP headers, you must route traces through an OTel Collector that injects the header before forwarding to Honeycomb.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Configure tracing

### Step 1: Set up the OTel Collector

1. Follow the [OTel Collector setup]({{< link path="/observability/traces/configs/otel/" >}}) guide to install a collector in your cluster. Then update the collector's exporter config to forward traces to Honeycomb with your API key.

2. In Honeycomb, go to **Account → Team Settings** to find or create an API key. Add the following exporter to your collector config. 
   ```yaml
   exporters:
     otlp/honeycomb:
       endpoint: https://api.honeycomb.io:443
       headers:
         x-honeycomb-team: "<your-honeycomb-api-key>"
   ```

### Step 2: Point the tracing policy at the collector

Create an {{< reuse "agw-docs/snippets/policy.md" >}} that points the agentgateway proxy at the OTel Collector.

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

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} tracing -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
