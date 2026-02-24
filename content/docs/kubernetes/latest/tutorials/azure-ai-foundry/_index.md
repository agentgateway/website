---
title: Azure AI Foundry
weight: 8
description: Route requests to Azure OpenAI through agentgateway on Kubernetes
---

Route LLM requests to Azure AI Foundry (Azure OpenAI) through agentgateway on Kubernetes, using custom path routing and URL rewriting.

## What you'll build

In this tutorial, you will:

1. Set up a local Kubernetes cluster with agentgateway
2. Configure an Azure OpenAI backend with Azure AI Foundry credentials
3. Set up path-based routing with URL rewriting
4. Send chat completion requests through agentgateway to Azure OpenAI

## Before you begin

Make sure you have the following tools installed:
- [Docker](https://www.docker.com/products/docker-desktop/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [kind](https://kind.sigs.k8s.io/)
- [Helm](https://helm.sh/docs/intro/install/)

You also need:
- An Azure account with access to [Azure AI Foundry](https://ai.azure.com/)
- An Azure OpenAI deployment with an API key
- Your Azure OpenAI endpoint URL (e.g., `your-resource.services.ai.azure.com`)
- Your deployment name (e.g., `gpt-4o-mini`)

For detailed tool installation instructions, see the [LLM Gateway tutorial](../llm-gateway/).

---

## Step 1: Create a kind cluster

```bash
kind create cluster --name agentgateway
```

---

## Step 2: Install agentgateway

```bash
# Gateway API CRDs
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version.md" >}}/standard-install.yaml

# agentgateway CRDs
helm upgrade -i --create-namespace \
  --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} {{< reuse "agw-docs/snippets/helm-kgateway-crds.md" >}} oci://{{< reuse "agw-docs/snippets/helm-path.md" >}}/charts/{{< reuse "agw-docs/snippets/helm-kgateway-crds.md" >}}

# Control plane
helm upgrade -i -n {{< reuse "agw-docs/snippets/namespace.md" >}} {{< reuse "agw-docs/snippets/helm-kgateway.md" >}} oci://{{< reuse "agw-docs/snippets/helm-path.md" >}}/charts/{{< reuse "agw-docs/snippets/helm-kgateway.md" >}} \
  --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}}
```

---

## Step 3: Create a Gateway

```bash
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: agentgateway-proxy
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  gatewayClassName: {{< reuse "agw-docs/snippets/agw-gatewayclass.md" >}}
  listeners:
  - protocol: HTTP
    port: 80
    name: http
    allowedRoutes:
      namespaces:
        from: All
EOF
```

Wait for the proxy:

```bash
kubectl get deployment agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

---

## Step 4: Set your Azure credentials

Export your Azure AI Foundry API key:

```bash
export AZURE_FOUNDRY_API_KEY=<insert your Azure API key>
```

---

## Step 5: Create the Kubernetes secret

Store your Azure credentials in a Kubernetes secret:

```bash
kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: azureopenai-secret
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
type: Opaque
stringData:
  Authorization: $AZURE_FOUNDRY_API_KEY
EOF
```

---

## Step 6: Create the Azure OpenAI backend

Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource configured for Azure OpenAI. Replace `your-resource.services.ai.azure.com` with your actual Azure AI Foundry endpoint, and `gpt-4o-mini` with your deployment name.

```bash
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: azureopenai
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      azureopenai:
        endpoint: your-resource.services.ai.azure.com
        deploymentName: gpt-4o-mini
        apiVersion: 2025-01-01-preview
  policies:
    auth:
      secretRef:
        name: azureopenai-secret
EOF
```

| Setting | Description |
|---------|-------------|
| `azureopenai.endpoint` | Your Azure AI Foundry resource endpoint |
| `azureopenai.deploymentName` | The name of your Azure OpenAI model deployment |
| `azureopenai.apiVersion` | The Azure OpenAI API version to use |
| `policies.auth.secretRef` | Reference to the secret containing your API key |

Verify the backend was created:

```bash
kubectl get agentgatewaybackend -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

---

## Step 7: Create the HTTPRoute with URL rewriting

Create an HTTPRoute that routes requests on the `/azureopenai` path and rewrites the URL to the chat completions endpoint.

```bash
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: azureopenai
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /azureopenai
    filters:
    - type: URLRewrite
      urlRewrite:
        path:
          type: ReplaceFullPath
          replaceFullPath: /v1/chat/completions
    backendRefs:
    - name: azureopenai
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
      group: agentgateway.dev
      kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
```

This route:
- **Matches** requests to `/azureopenai`
- **Rewrites** the path to `/v1/chat/completions` before forwarding to Azure
- **Routes** to the Azure OpenAI backend

---

## Step 8: Test the API

Set up port-forwarding:

```bash
kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80 &
```

Send a request to Azure OpenAI through agentgateway:

```bash
curl "localhost:8080/azureopenai" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "system",
        "content": "You are a helpful assistant."
      },
      {
        "role": "user",
        "content": "What is Azure AI Foundry in one sentence?"
      }
    ]
  }' | jq
```

Example output:

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Azure AI Foundry is Microsoft's unified platform for building, deploying, and managing AI applications and models at scale."
    },
    "index": 0,
    "finish_reason": "stop"
  }]
}
```

---

## Multiple Azure deployments

You can route to different Azure OpenAI deployments based on request paths. Create additional backends and routes for each deployment:

```yaml
# Backend for a different model
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: azureopenai-gpt4
  namespace: agentgateway-system
spec:
  ai:
    provider:
      azureopenai:
        endpoint: your-resource.services.ai.azure.com
        deploymentName: gpt-4
        apiVersion: 2025-01-01-preview
  policies:
    auth:
      secretRef:
        name: azureopenai-secret
```

Then add an HTTPRoute matching `/azureopenai-gpt4` to route to the new backend.

---

## Cleanup

```bash
kill %1 2>/dev/null
kind delete cluster --name agentgateway
```

---

## Next steps

{{< cards >}}
  {{< card link="/docs/kubernetes/latest/llm/providers/azureopenai" title="Azure OpenAI Reference" subtitle="Complete Azure OpenAI configuration" >}}
  {{< card link="/docs/kubernetes/latest/tutorials/llm-gateway" title="LLM Gateway" subtitle="Route to multiple LLM providers" >}}
  {{< card link="/docs/kubernetes/latest/tutorials/ai-prompt-guard" title="AI Prompt Guard" subtitle="Protect your LLM requests" >}}
{{< /cards >}}
