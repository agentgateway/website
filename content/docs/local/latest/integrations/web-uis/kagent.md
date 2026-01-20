---
title: Kagent
description: Secure and observe Kagent with Agent Gateway for Kubernetes-native AI governance
---

[Kagent](https://github.com/kagent-dev/kagent) is a Kubernetes-native AI agent framework that brings autonomous agents to cloud-native environments. It leverages Kubernetes primitives for agent lifecycle management, scaling, and orchestration.

## What is Kagent?

Kagent provides a Kubernetes-native approach to running AI agents:

- **CRD-based Configuration** - Define agents as Kubernetes resources
- **Native Scaling** - Horizontal pod autoscaling for agent workloads
- **MCP Support** - Built-in Model Context Protocol for tool access
- **A2A Communication** - Agent-to-agent messaging via Kubernetes services
- **GitOps Ready** - Declarative agent definitions for Flux/ArgoCD

## Why Use Agent Gateway with Kagent?

Kagent agents running in Kubernetes need enterprise governance:

| Kubernetes Challenge | Agent Gateway Solution |
|---------------------|----------------------|
| Multi-tenant clusters | Namespace-aware policies |
| Service-to-service auth | mTLS and JWT validation |
| Distributed tracing | OpenTelemetry integration |
| Cost allocation | Per-namespace token tracking |
| Compliance requirements | Centralized audit logging |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                        │
│                                                              │
│  ┌──────────────┐    ┌─────────────────┐    ┌────────────┐ │
│  │   Kagent     │───▶│  Agent Gateway  │───▶│    LLM     │ │
│  │   Agents     │    │   (Deployment)  │    │  Provider  │ │
│  │              │    │                 │    └────────────┘ │
│  │  ┌────────┐  │    │  - Auth/AuthZ   │                   │
│  │  │Agent A │  │    │  - Audit        │    ┌────────────┐ │
│  │  └────────┘  │    │  - Metrics      │───▶│    MCP     │ │
│  │  ┌────────┐  │    │  - Rate Limit   │    │  Servers   │ │
│  │  │Agent B │  │    └─────────────────┘    └────────────┘ │
│  │  └────────┘  │            │                             │
│  └──────────────┘            │              ┌────────────┐ │
│                              └─────────────▶│   Other    │ │
│                                 A2A         │   Agents   │ │
│                                             └────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Deployment

### 1. Deploy Agent Gateway

Deploy Agent Gateway in your cluster:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentgateway
  namespace: ai-platform
spec:
  replicas: 3
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
            - containerPort: 8080  # LLM
            - containerPort: 8081  # MCP
            - containerPort: 8082  # A2A
          volumeMounts:
            - name: config
              mountPath: /etc/agentgateway
      volumes:
        - name: config
          configMap:
            name: agentgateway-config
---
apiVersion: v1
kind: Service
metadata:
  name: agentgateway
  namespace: ai-platform
spec:
  selector:
    app: agentgateway
  ports:
    - name: llm
      port: 8080
    - name: mcp
      port: 8081
    - name: a2a
      port: 8082
```

### 2. Configure Agent Gateway

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agentgateway-config
  namespace: ai-platform
data:
  config.yaml: |
    listeners:
      - name: llm
        address: 0.0.0.0
        port: 8080
        protocol: HTTP

      - name: mcp
        address: 0.0.0.0
        port: 8081
        protocol: MCP

      - name: a2a
        address: 0.0.0.0
        port: 8082
        protocol: A2A

    llm:
      providers:
        - name: openai
          type: openai
          api_key_secret: openai-credentials

    security:
      authentication:
        type: kubernetes
        service_account_validation: true
```

### 3. Create ModelConfig for Agent Gateway

First, create a ModelConfig that points to Agent Gateway:

```yaml
apiVersion: kagent.dev/v1alpha2
kind: ModelConfig
metadata:
  name: gateway-model-config
  namespace: ai-platform
spec:
  provider: openai
  model: gpt-4
  apiKeySecretRef:
    name: gateway-api-key
    key: api-key
  baseUrl: http://agentgateway.ai-platform.svc:8080/v1
```

### 4. Configure Kagent Agents

Point Kagent agents to use the gateway ModelConfig:

```yaml
apiVersion: kagent.dev/v1alpha2
kind: Agent
metadata:
  name: code-assistant
  namespace: dev-team
spec:
  description: A code review and documentation assistant
  type: Declarative
  declarative:
    modelConfig: gateway-model-config
    systemMessage: |-
      You are an expert code reviewer and documentation writer.
      Help users with code review, documentation, and best practices.
    tools:
      - type: McpServer
        mcpServer:
          name: filesystem-server
          kind: RemoteMCPServer
          toolNames:
            - read_file
            - write_file
      - type: McpServer
        mcpServer:
          name: github-server
          kind: RemoteMCPServer
          toolNames:
            - get_pull_request
            - create_review
```

## Governance Capabilities

### Namespace-Aware Policies

Enforce policies per Kubernetes namespace:

```yaml
authorization:
  policies:
    # Production namespace - restricted models
    - name: prod-policy
      match:
        kubernetes:
          namespace: production
      resources:
        - "model:gpt-4"
      action: allow

    # Dev namespace - broader access
    - name: dev-policy
      match:
        kubernetes:
          namespace: development
      resources:
        - "model:*"
      action: allow
```

### Service Account Authentication

Validate Kubernetes service accounts:

```yaml
security:
  authentication:
    type: kubernetes
    service_account_validation: true
    allowed_namespaces:
      - ai-agents
      - dev-team
      - prod-team
```

### A2A Authorization

Control agent-to-agent communication:

```yaml
a2a:
  authorization:
    - name: dev-team-agents
      source:
        namespace: dev-team
      target:
        namespace: dev-team
      action: allow

    - name: cross-namespace-restricted
      source:
        namespace: dev-team
      target:
        namespace: production
      action: deny
```

### Per-Namespace Rate Limits

Allocate token budgets by team:

```yaml
rate_limiting:
  - name: dev-team-budget
    match:
      kubernetes:
        namespace: dev-team
    limit: 1000000  # tokens per day
    window: 24h
    limit_by: tokens

  - name: prod-budget
    match:
      kubernetes:
        namespace: production
    limit: 5000000
    window: 24h
    limit_by: tokens
```

## Observability

### Kubernetes-Native Metrics

Agent Gateway exposes Prometheus metrics compatible with kube-prometheus-stack:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: agentgateway
  namespace: ai-platform
spec:
  selector:
    matchLabels:
      app: agentgateway
  endpoints:
    - port: metrics
      interval: 30s
```

### Distributed Tracing

Enable OpenTelemetry for cross-service tracing:

```yaml
observability:
  tracing:
    enabled: true
    exporter: otlp
    endpoint: jaeger-collector.observability.svc:4317
    propagation:
      - w3c
      - b3
```

### Audit Logging

Send audit logs to your SIEM:

```yaml
observability:
  logging:
    enabled: true
    format: json
    output:
      - type: stdout
      - type: elasticsearch
        endpoint: https://elasticsearch.logging.svc:9200
        index: agentgateway-audit
```

## Best Practices

1. **Namespace Isolation** - Separate teams with namespace-aware policies
2. **Resource Quotas** - Set token budgets per namespace
3. **Audit Everything** - Log all LLM, MCP, and A2A traffic
4. **GitOps Policies** - Manage authorization policies declaratively
