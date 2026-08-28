---
title: OTel Collector
description: Configure agentgateway to send traces to a standalone OpenTelemetry Collector.
weight: 20
---

An [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/) is a vendor-neutral component that receives, processes, and exports telemetry data to one or more backends, such as Jaeger, Tempo, or Datadog. The following steps show you how to install a standalone OTel Collector in your cluster and configure {{< reuse "agw-docs/snippets/agentgateway.md" >}} to send traces to it.

> [!TIP]
> If you already have the [OTel stack]({{< link path="/observability/otel-stack/" >}}) installed, an OTel Collector is already running in the `telemetry` namespace. You do not need to install another one.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Install the OTel Collector

1. Add the OpenTelemetry Helm repository and install the collector.

   ```sh
   helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
   helm repo update
   helm install opentelemetry-collector open-telemetry/opentelemetry-collector \
     --namespace tracing \
     --create-namespace \
     --set mode=deployment \
     --set image.repository=otel/opentelemetry-collector-contrib \
     --set config.exporters.debug.verbosity=detailed
   ```

2. Verify the collector pod is running.

   ```sh
   kubectl get pods -n tracing
   ```

   Example output:

   ```console
   NAME                                          READY   STATUS    RESTARTS   AGE
   opentelemetry-collector-6b9d7c5d65-q2r9k     1/1     Running   0          34s
   ```

## Configure tracing

Create an {{< reuse "agw-docs/snippets/policy.md" >}} that points the agentgateway proxy at the collector.

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

## Verify traces

1. Send a request to the httpbin app.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi -X POST http://$INGRESS_GW_ADDRESS:80/post \
    -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi -X POST localhost:8080/post \
    -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Check the collector logs for the trace.

   ```sh
   kubectl logs -n tracing deploy/opentelemetry-collector | grep -A 5 "agentgateway"
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Delete the {{< reuse "agw-docs/snippets/policy.md" >}} resource.
   ```sh
   kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} tracing -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

2. Uninstall the OTel Collector.
   ```sh
   helm uninstall opentelemetry-collector -n tracing
   kubectl delete namespace tracing
   ```
