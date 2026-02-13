---
title: "Your First AI Route: Connecting to OpenAI with AgentGateway"
publishDate: 2026-02-11
author: "Sebastian Maniak"
description: "Step-by-step guide to connecting open source AgentGateway to OpenAI API with cost tracking, monitoring, security best practices, and production-ready configurations."
---

## Introduction
This is a how-to guide to setup AgentGateway and get your first AI route working with OpenAI. We'll walk through the complete setup from scratch - creating a Kubernetes cluster, installing AgentGateway, and connecting it to OpenAI's API.

## What is AgentGateway?

AgentGateway is an open source, AI-native data plane built in Rust for connecting, securing, and observing AI traffic. Originally created by Solo.io and now a Linux Foundation project, it acts as a purpose-built proxy layer between your applications and AI services like LLMs, MCP tool servers, and other AI agents.

* Traditional API gateways don't fit AI workloads — AI inference requests are long-running (minutes vs milliseconds), have larger payloads, and can consume entire GPUs, unlike standard web traffic.
* Connectivity — Unified interface to route requests to LLM providers (OpenAI, Anthropic, Bedrock, etc.), self-hosted models, and MCP tool servers.
* Security — Built-in auth, RBAC, and secrets management for API keys and sensitive data.
* Observability — Automatic token counting, cost tracking, and OpenTelemetry-compatible structured logs.
* MCP support — Can federate multiple MCP servers behind a single endpoint, and expose legacy REST APIs as MCP tools via OpenAPI integration.
* A2A support — Native Agent-to-Agent protocol for secure inter-agent communication..

In this tutorial, we'll focus on one of AgentGateway's most common use cases: routing requests to an LLM provider (OpenAI) with secure credential management and built-in cost observability.

## What You'll Learn

- Create a Kubernetes cluster and install AgentGateway
- Set up secure OpenAI API key storage
- Configure AgentGateway to route to OpenAI
- Test chat completions, embeddings, and model listings
- Monitor real AI requests and track costs
- Troubleshoot common issues

## Prerequisites

- Docker installed and running
- kubectl CLI tool
- Helm 3.x installed  
- Valid OpenAI API Key with credits (get from [OpenAI Platform](https://platform.openai.com))
- Basic understanding of Kubernetes and OpenAI API structure

---

## Step 1: Environment Setup

In this step, we'll create a local Kubernetes cluster using kind (Kubernetes in Docker) and install AgentGateway. This gives us a complete testing environment that mirrors production setups but runs entirely on your local machine.

### Install Kind

Kind creates Kubernetes clusters using Docker containers as nodes. This is perfect for development and testing because it's lightweight, fast to spin up, and doesn't require cloud resources.
```bash
# On macOS 
brew install kind

# On Linux
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.22.0/kind-linux-amd64
chmod +x ./kind && sudo mv ./kind /usr/local/bin/kind
```

### Create Kind Cluster

This creates a single-node Kubernetes cluster that will host our AgentGateway installation. The cluster provides the foundation for all the networking, security, and routing capabilities we'll configure.

```bash
# Create the cluster
kind create cluster --name agentgateway

# Verify cluster is ready
kubectl get nodes
```

### Install AgentGateway

AgentGateway installation happens in three phases: First we install the Kubernetes Gateway API (the standard for ingress traffic), then AgentGateway's custom resources, and finally the control plane that manages everything. This separation allows for better modularity and easier upgrades.
```bash
# 1. Install Gateway API CRDs (version 1.4.0)
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.4.0/standard-install.yaml

# 2. Install AgentGateway CRDs
helm upgrade -i --create-namespace \
  --namespace agentgateway-system \
  --version v2.2.0 agentgateway-crds \
  oci://ghcr.io/kgateway-dev/charts/agentgateway-crds

# 3. Install AgentGateway control plane
helm upgrade -i -n agentgateway-system agentgateway \
  oci://ghcr.io/kgateway-dev/charts/agentgateway \
  --version v2.2.0

# 4. Verify installation
kubectl get pods -n agentgateway-system
```

---

## Step 2: OpenAI API Key Setup

Security is paramount when working with AI services. Instead of embedding API keys directly in configurations, we'll use Kubernetes secrets to store credentials securely. This approach ensures keys are encrypted at rest and can be rotated without changing application code.

### Get Your OpenAI API Key

OpenAI uses API keys for authentication and billing. Each key is tied to your account and usage limits, making it essential to secure them properly.
1. Visit [OpenAI Platform](https://platform.openai.com)
2. Navigate to API Keys section and create a new key
3. Set usage limits to control costs
4. Copy your API key securely

### Test Your API Key

Before integrating with AgentGateway, we'll verify the API key works directly with OpenAI's API. This eliminates the key as a potential issue if something goes wrong later in the setup.
```bash
# Set your OpenAI API key (replace with your actual key)
export OPENAI_API_KEY="sk-your-openai-api-key-here"

# Test the key directly
curl -s "https://api.openai.com/v1/models" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  | jq '.data[0:3] | .[].id'
```

### Create Kubernetes Secret

Kubernetes secrets provide a secure way to store sensitive data like API keys. We format the key as a complete Authorization header (`Bearer sk-...`) so AgentGateway can use it directly without modification. The `--dry-run=client -o yaml | kubectl apply -f -` pattern ensures the secret is created safely even if it already exists.
```bash
# Create secret with proper authorization header format
kubectl create secret generic openai-secret \
  -n agentgateway-system \
  --from-literal="Authorization=Bearer $OPENAI_API_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

# Verify secret creation
kubectl get secret openai-secret -n agentgateway-system
```

---

## Step 3: Configure AgentGateway

Now we'll configure the core components that make AI routing work. AgentGateway follows the Kubernetes Gateway API pattern with three main resources: Gateway (the entry point), Backends (destination services), and HTTPRoutes (traffic routing rules). This declarative approach makes configurations version-controllable and environment-portable.

### Create Gateway Resource

The Gateway resource defines the entry point for all incoming traffic. It specifies which ports to listen on, what protocols to accept, and which namespaces can create routes through it. Think of it as the front door to your AI services.
```bash
kubectl apply -f- <<'EOF'
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: agentgateway-proxy
  namespace: agentgateway-system
spec:
  gatewayClassName: agentgateway
  listeners:
  - protocol: HTTP
    port: 8080
    name: http
    allowedRoutes:
      namespaces:
        from: All
EOF
```

### Create OpenAI Backend

AgentgatewayBackend resources define how to connect to AI services. The `ai.provider.openai` section tells AgentGateway this is an AI service that expects OpenAI-compatible requests. The authentication policy references our secret, and the timeout ensures long-running AI requests don't hang indefinitely.
```bash
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: openai-backend
  namespace: agentgateway-system
spec:
  ai:
    provider:
      openai:
        model: gpt-4o-mini
  policies:
    auth:
      secretRef:
        name: openai-secret
EOF
```

### Create HTTP Routes

Create an HTTPRoute resource that routes incoming traffic to the AgentgatewayBackend. The following example sets up a route. Note that agentgateway automatically rewrites the endpoint to the OpenAI /v1/chat/completions endpoint.

Create the HTTP routes:
```bash
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: openai-chat
  namespace: agentgateway-system
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: agentgateway-system
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /openai
    backendRefs:
    - name: openai-backend
      namespace: agentgateway-system
      group: agentgateway.dev
      kind: AgentgatewayBackend
EOF
```

### Verify Configuration

Before testing, we'll check that all our resources are properly created and accepted by the AgentGateway controller. The `Accepted` status indicates that configurations are valid and the controller can proceed with implementation.
```bash
# Check both backends
kubectl get agentgatewaybackend -n agentgateway-system

# Check routes
kubectl get httproute -n agentgateway-system

# Check Gateway
kubectl get gateway agentgateway-proxy -n agentgateway-system
```

---

## Step 4: Testing Your Setup

With our configuration complete, it's time to test the AI routing. Since we're using a local kind cluster, we'll use port-forwarding to access the Gateway service. In production, this would be handled by a LoadBalancer or Ingress controller.

### Setup Port-Forward

Port-forwarding creates a tunnel from your local machine to the AgentGateway service inside the Kubernetes cluster. This lets us test the setup without exposing services publicly.
```bash
# Port-forward AgentGateway service in background
kubectl port-forward -n agentgateway-system svc/agentgateway-proxy 8080:8080 &

```

### Test Chat Completions

This is where the magic happens! Our request travels through AgentGateway, gets authenticated using our secret, routed to OpenAI's API, and returns with a complete AI response. Notice how the response includes token usage information that AgentGateway automatically captures for cost tracking and observability.
```bash
# Test basic chat completion
curl -i "localhost:8080/openai/chat/completions" \
  -H "content-type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "user",
        "content": "What are the key benefits of using an AI Gateway?"
      }
    ],
    "max_tokens": 100
  }'
```

**Expected Response:**
```json
{
  "id": "chatcmpl-abc123def456",
  "object": "chat.completion",
  "created": 1701234567,
  "model": "gpt-4o-mini-2024-07-18",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "An AI Gateway provides unified access to multiple AI providers, centralized security and authentication, comprehensive observability and cost tracking, rate limiting and quotas, and improved reliability through failover and retry mechanisms."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 35,
    "total_tokens": 50
  }
}
```

### Test Different Models

AgentGateway allows you to easily switch between different OpenAI models by simply changing the `model` parameter. The backend automatically routes to the appropriate model while maintaining consistent authentication and observability.
```bash
# Test with GPT-4o
curl -s "localhost:8080/openai/chat/completions" \
  -H "content-type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "user",
        "content": "Explain AgentGateway in one sentence."
      }
    ],
    "max_tokens": 50
  }' | jq '.choices[0].message.content'
```

---

## Troubleshooting

When working with distributed systems like Kubernetes and external APIs, issues can arise at multiple layers. This section covers the most common problems you might encounter and how to systematically diagnose them. The key is to test each layer independently: network connectivity, authentication, resource configuration, and API compatibility.

### Common Issues

**1. Service Not Found Error:**
This usually means the service name doesn't match what was actually created during installation. Different AgentGateway versions or installation methods may create services with different names.
```bash
# Check what services exist
kubectl get svc -n agentgateway-system

# If agentgateway-proxy doesn't exist, use the correct service name
kubectl get svc -n agentgateway-system | grep -i gateway
```

**2. Authentication Errors (401):**
Authentication failures typically indicate either an invalid API key or incorrect secret formatting. Always test the key directly with OpenAI before troubleshooting AgentGateway.
```bash
# Verify secret exists
kubectl get secret openai-secret -n agentgateway-system -o yaml

# Test API key directly
curl -s "https://api.openai.com/v1/models" \
  -H "Authorization: Bearer $OPENAI_API_KEY" | jq '.data[0].id'
```

**3. Routes Not Working:**
Route issues often stem from mismatched resource names or namespaces. The Gateway, HTTPRoute, and Backend must all reference each other correctly for traffic to flow.
```bash
# Check backend status
kubectl describe agentgatewaybackend openai-backend -n agentgateway-system

# Check route status
kubectl describe httproute openai-chat -n agentgateway-system

# Check Gateway status
kubectl describe gateway agentgateway-proxy -n agentgateway-system
```

**4. Port-Forward Issues:**
Port conflicts are common on development machines. If port 8080 is busy, either stop the conflicting service or use a different port.
```bash
# Check if port 8080 is in use
lsof -i :8080

# Try a different port
kubectl port-forward -n agentgateway-system svc/agentgateway-proxy 8081:8080 &
export GATEWAY_PORT="8081"
```

### Debug Commands
```bash
# View all AgentGateway resources
kubectl get agentgatewaybackend,gateway,httproute -n agentgateway-system

# Check pod logs for errors
kubectl logs deploy/agentgateway -n agentgateway-system --tail=20

# Test connectivity from inside cluster
kubectl exec -n agentgateway-system deploy/agentgateway -- \
  curl -v https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

---

## Cleanup

When you're done experimenting, it's important to clean up resources to free up system resources and avoid any potential costs. The cleanup process should happen in reverse order: stop network connections first, then remove application resources, and finally remove infrastructure.

### Stop Port-Forward
```bash
# Kill the port-forward process
kill $PORTFORWARD_PID
```

### Remove Resources (Optional)

This removes all the AgentGateway configuration we created, but leaves the AgentGateway installation intact for future experiments. Remove resources in dependency order: routes first (they reference backends), then backends, then the Gateway.
```bash
# Remove all OpenAI configuration
kubectl delete httproute openai-chat openai-models -n agentgateway-system
kubectl delete agentgatewaybackend openai-backend openai-models-backend -n agentgateway-system
kubectl delete gateway agentgateway-proxy -n agentgateway-system
kubectl delete secret openai-secret -n agentgateway-system
```

### Remove Kind Cluster (Optional)

This completely removes the Kubernetes cluster and all associated resources. Only do this if you're completely done with the tutorial, as you'll need to recreate everything from Step 1 to run it again.
```bash
# Delete the entire cluster
kind delete cluster --name agentgateway
```

---

## Next Steps

Now that you have a working AI gateway, you can build on this foundation to create production-ready AI infrastructure:

- **Add more providers** - Configure Anthropic, AWS Bedrock, or Azure OpenAI for multi-provider setups and failover scenarios
- **Implement security** - Add rate limiting, authentication, and guardrails to protect against abuse and unexpected costs
- **Set up monitoring** - Configure Grafana dashboards and alerting to track performance, costs, and usage patterns across teams
- **Explore advanced routing** - Implement path-based, header-based, and weighted routing to direct different types of requests to optimal models

## Key Takeaways

This tutorial demonstrates several important concepts for production AI systems:

- **AgentGateway provides a unified interface** to AI providers with minimal overhead, making it easy to switch providers or implement failover
- **Proper secret management** is essential for production deployments - never embed API keys in code or configuration files
- **Built-in observability** gives immediate insights into costs and performance without requiring additional tooling or instrumentation
- **The Gateway API pattern** makes routing configuration declarative and portable across different Kubernetes environments
- **Dual backend types** (AI-aware vs static HTTP) allow you to handle both complex AI workloads and simple metadata requests efficiently
- **Kind clusters** are perfect for local development and testing, providing a production-like environment without cloud costs

Your AgentGateway is now successfully routing requests to OpenAI with enterprise-grade security, observability, and cost control! You've built a foundation that can scale from development to production while maintaining visibility and control over your AI infrastructure. 🎯
