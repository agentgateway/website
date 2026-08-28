---
title: Grafana Cloud
description: Configure agentgateway to send traces to Grafana Cloud.
weight: 50
---

[Grafana Cloud](https://grafana.com/products/cloud/) is a managed observability platform. You can send traces directly to your Grafana Cloud OTLP endpoint from the agentgateway proxy.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Configure tracing

Create an {{< reuse "agw-docs/snippets/policy.md" >}} that points the agentgateway proxy at your Grafana Cloud OTLP endpoint.

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
      url: https://<your-grafana-otlp-endpoint>:443
      protocol: GRPC
      randomSampling: "true"
EOF
```

> [!NOTE]
> Grafana Cloud requires an API token sent as a header. Use an OTel Collector as an intermediary to inject the `Authorization` header.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

Delete the {{< reuse "agw-docs/snippets/policy.md" >}} resource.

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} tracing -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
