---
title: Honeycomb
description: Configure agentgateway to send traces to Honeycomb.
weight: 40
---

[Honeycomb](https://www.honeycomb.io/) is an observability platform. You can send traces directly to the Honeycomb OTLP API from the agentgateway proxy.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Configure tracing

Create an {{< reuse "agw-docs/snippets/policy.md" >}} that points the agentgateway proxy at the Honeycomb API.

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
      url: https://api.honeycomb.io:443
      protocol: GRPC
      randomSampling: "true"
EOF
```

> [!NOTE]
> Honeycomb requires an API key sent as a header. Use an OTel Collector as an intermediary to inject the `x-honeycomb-team` header, or contact Honeycomb for alternative authentication methods.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} tracing -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
