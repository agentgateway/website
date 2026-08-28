---
title: Sample tracing configs
weight: 30
description: Sample configurations for exporting agentgateway traces to OpenTelemetry Collector, Jaeger, Langfuse, and Arize AX.
test: skip
---

Agentgateway exports traces to any OTLP-compatible backend. Use one of these guides to connect agentgateway to OpenTelemetry Collector, Jaeger, Langfuse, or Arize AX.

For a self-hosted receiver, the `host` value in `frontendPolicies.tracing` depends on how you installed agentgateway and where your OTLP receiver runs.

| Install method | `host` value | Notes |
|----------------|--------------|-------|
| Binary | `localhost:4317` | Run the OTLP receiver as a separate process or Docker container on the same host. |
| Docker Compose | `<service-name>:4317` | Add the receiver as a service that runs alongside agentgateway. Use the Docker service name as the host. |
| Kubernetes (Helm) | `<service>.<namespace>.svc.cluster.local:4317` | Deploy the OTLP receiver as a separate Helm release. For example, you can install the Jaeger Helm chart that includes an OTLP receiver and the Jaeger UI to view your traces. Use the Kubernetes service DNS name as your host. |

Choose one of the following guides to configure your tracing backend.
