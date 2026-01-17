---
title: Linkerd
weight: 20
description: Integrate Agent Gateway with Linkerd service mesh
---

[Linkerd](https://linkerd.io/) is a lightweight, security-focused service mesh. Agent Gateway works seamlessly with Linkerd to provide AI-specific traffic management.

## Why use Agent Gateway with Linkerd?

| Feature | Linkerd | Agent Gateway | Combined Benefit |
|---------|---------|---------------|------------------|
| mTLS | ✅ | ✅ | Zero-config encryption |
| Observability | ✅ | ✅ | Golden metrics + AI metrics |
| Traffic splitting | ✅ | ✅ | A/B test LLM models |
| Retries | ✅ | ✅ | AI-aware retry policies |
| MCP protocol | ❌ | ✅ | MCP support in mesh |
| Token limits | ❌ | ✅ | LLM-specific rate limiting |

## Deployment

Deploy Agent Gateway with Linkerd injection:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentgateway
  annotations:
    linkerd.io/inject: enabled
spec:
  replicas: 2
  selector:
    matchLabels:
      app: agentgateway
  template:
    metadata:
      labels:
        app: agentgateway
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

## Traffic splitting for LLM A/B testing

Use Linkerd TrafficSplit with multiple Agent Gateway backends:

```yaml
apiVersion: split.smi-spec.io/v1alpha1
kind: TrafficSplit
metadata:
  name: llm-ab-test
spec:
  service: agentgateway
  backends:
  - service: agentgateway-gpt4
    weight: 90
  - service: agentgateway-gpt4o
    weight: 10
```

## Learn more

- [Linkerd Documentation](https://linkerd.io/docs/)
- [Kubernetes Deployment](/docs/integrations/platforms/kubernetes)
