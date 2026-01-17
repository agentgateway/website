---
title: Istio
weight: 10
description: Integrate Agent Gateway with Istio service mesh
---

[Istio](https://istio.io/) is a service mesh that provides traffic management, security, and observability. Agent Gateway can work alongside Istio to provide AI-specific routing while leveraging Istio's mTLS and telemetry.

## Why use Agent Gateway with Istio?

| Feature | Istio | Agent Gateway | Combined Benefit |
|---------|-------|---------------|------------------|
| mTLS | ✅ | ✅ | End-to-end encryption for AI traffic |
| Traffic management | ✅ | ✅ | AI-aware routing with mesh policies |
| Observability | ✅ | ✅ | Unified tracing across mesh and AI |
| Rate limiting | ✅ | ✅ | Token-based limits for LLMs |
| MCP protocol | ❌ | ✅ | MCP support within mesh |
| LLM routing | ❌ | ✅ | Model-aware traffic management |

## Deployment options

### Option 1: Agent Gateway as mesh workload

Deploy Agent Gateway as a regular workload with Istio sidecar:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentgateway
  labels:
    app: agentgateway
spec:
  replicas: 2
  selector:
    matchLabels:
      app: agentgateway
  template:
    metadata:
      labels:
        app: agentgateway
      annotations:
        sidecar.istio.io/inject: "true"
    spec:
      containers:
      - name: agentgateway
        image: ghcr.io/agentgateway/agentgateway:latest
        ports:
        - containerPort: 3000
        volumeMounts:
        - name: config
          mountPath: /etc/agentgateway
      volumes:
      - name: config
        configMap:
          name: agentgateway-config
```

### Option 2: Agent Gateway as ingress

Use Agent Gateway at the mesh edge:

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: agentgateway
spec:
  hosts:
  - "ai.example.com"
  gateways:
  - istio-system/istio-ingressgateway
  http:
  - route:
    - destination:
        host: agentgateway
        port:
          number: 3000
```

## Istio authorization with Agent Gateway

Combine Istio AuthorizationPolicy with Agent Gateway's auth:

```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: agentgateway-policy
spec:
  selector:
    matchLabels:
      app: agentgateway
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/default/sa/ai-client"]
    to:
    - operation:
        paths: ["/mcp/*", "/v1/*"]
```

## Shared telemetry

Both Istio and Agent Gateway export OpenTelemetry traces. Configure them to use the same collector:

```yaml
# Agent Gateway config
config:
  tracing:
    otlpEndpoint: http://jaeger-collector.istio-system:4317
    randomSampling: true
```

This creates unified traces showing the full request path through the mesh and Agent Gateway.

## Learn more

- [Istio Documentation](https://istio.io/docs/)
- [Kubernetes Deployment](/docs/integrations/platforms/kubernetes)
