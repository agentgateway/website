---
title: LLM Gateway
weight: 1
description: Route requests to LLM providers through agentgateway on Kubernetes
---

Route requests to OpenAI, Anthropic, Google Gemini, and other LLM providers through a unified OpenAI-compatible API running on Kubernetes.

## What you'll build

In this tutorial, you will:

1. Set up a local Kubernetes cluster using kind
2. Install the {{< reuse "agw-docs/snippets/kgateway.md" >}} control plane with agentgateway
3. Create a Gateway and configure an LLM provider backend
4. Route requests to your LLM provider through the agentgateway proxy
5. Test the setup with curl

## Before you begin

Make sure you have the following tools installed on your machine.

### Docker

kind runs Kubernetes inside Docker containers. Install Docker Desktop or Docker Engine for your operating system.

{{< tabs items="macOS,Linux" >}}

{{< tab >}}
```bash
# Install Docker Desktop for macOS
# Download from https://www.docker.com/products/docker-desktop/
# Or via Homebrew:
brew install --cask docker
```

Start Docker Desktop and verify it's running:

```bash
docker version
```
{{< /tab >}}

{{< tab >}}
```bash
# Install Docker Engine
curl -fsSL https://get.docker.com | sh
sudo systemctl start docker
sudo systemctl enable docker
```

Verify Docker is running:

```bash
docker version
```
{{< /tab >}}

{{< /tabs >}}

### kubectl

```bash
# macOS
brew install kubectl

# Linux
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && sudo mv kubectl /usr/local/bin/
```

Verify kubectl is installed:

```bash
kubectl version --client
```

### kind

```bash
# macOS
brew install kind

# Linux
curl -Lo ./kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64
chmod +x ./kind && sudo mv ./kind /usr/local/bin/kind
```

Verify kind is installed:

```bash
kind version
```

### Helm

```bash
# macOS
brew install helm

# Linux
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

Verify Helm is installed:

```bash
helm version
```

---

## Step 1: Create a kind cluster

Create a local Kubernetes cluster with kind. This cluster is where you will install agentgateway.

```bash
kind create cluster --name agentgateway
```

Example output:

```console
Creating cluster "agentgateway" ...
 ✓ Ensuring node image (kindest/node:v1.32.0) 🖼
 ✓ Preparing nodes 📦
 ✓ Writing configuration 📜
 ✓ Starting control-plane 🕹️
 ✓ Installing CNI 🔌
 ✓ Installing StorageClass 💾
Set kubectl context to "kind-agentgateway"
```

Verify the cluster is running:

```bash
kubectl cluster-info --context kind-agentgateway
kubectl get nodes
```

---

## Step 2: Install the Kubernetes Gateway API CRDs

Install the custom resources for the Kubernetes Gateway API.

```bash
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version.md" >}}/standard-install.yaml
```

Example output:

```console
customresourcedefinition.apiextensions.k8s.io/gatewayclasses.gateway.networking.k8s.io created
customresourcedefinition.apiextensions.k8s.io/gateways.gateway.networking.k8s.io created
customresourcedefinition.apiextensions.k8s.io/httproutes.gateway.networking.k8s.io created
customresourcedefinition.apiextensions.k8s.io/referencegrants.gateway.networking.k8s.io created
customresourcedefinition.apiextensions.k8s.io/grpcroutes.gateway.networking.k8s.io created
```

---

## Step 3: Install agentgateway CRDs

Deploy the {{< reuse "agw-docs/snippets/kgateway.md" >}} CRDs using Helm. This creates the `{{< reuse "agw-docs/snippets/namespace.md" >}}` namespace and installs the custom resource definitions.

```bash
helm upgrade -i --create-namespace \
  --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} {{< reuse "agw-docs/snippets/helm-kgateway-crds.md" >}} oci://{{< reuse "agw-docs/snippets/helm-path.md" >}}/charts/{{< reuse "agw-docs/snippets/helm-kgateway-crds.md" >}}
```

---

## Step 4: Install the agentgateway control plane

Install the {{< reuse "agw-docs/snippets/kgateway.md" >}} control plane with Helm.

```bash
helm upgrade -i -n {{< reuse "agw-docs/snippets/namespace.md" >}} {{< reuse "agw-docs/snippets/helm-kgateway.md" >}} oci://{{< reuse "agw-docs/snippets/helm-path.md" >}}/charts/{{< reuse "agw-docs/snippets/helm-kgateway.md" >}} \
  --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}}
```

Verify that the control plane is running:

```bash
kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

Example output:

```console
NAME                              READY   STATUS    RESTARTS   AGE
agentgateway-78658959cd-cz6jt     1/1     Running   0          12s
```

Verify that the GatewayClass was created:

```bash
kubectl get gatewayclass {{< reuse "agw-docs/snippets/gatewayclass.md" >}}
```

---

## Step 5: Create a Gateway

Create a Gateway resource that sets up the agentgateway proxy with an HTTP listener.

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

Wait for the Gateway and its proxy deployment to become ready:

```bash
kubectl get gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl get deployment agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

Example output:

```console
NAME                 CLASS            ADDRESS   PROGRAMMED   AGE
agentgateway-proxy   agentgateway                True         30s

NAME                 READY   UP-TO-DATE   AVAILABLE   AGE
agentgateway-proxy   1/1     1            1           32s
```

---

## Step 6: Choose your LLM provider

Set your API key, create a Kubernetes secret, and configure the LLM backend.

{{< tabs items="OpenAI,Anthropic,Google Gemini" >}}

{{< tab >}}

### Set your API key

```bash
export OPENAI_API_KEY=<insert your API key>
```

### Create the Kubernetes secret

```bash
kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: openai-secret
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
type: Opaque
stringData:
  Authorization: $OPENAI_API_KEY
EOF
```

### Create the LLM backend

```bash
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: openai
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      openai:
        model: gpt-4.1-nano
  policies:
    auth:
      secretRef:
        name: openai-secret
EOF
```

### Create the HTTPRoute

```bash
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: openai
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  rules:
    - backendRefs:
      - name: openai
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        group: agentgateway.dev
        kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
```

{{< /tab >}}

{{< tab >}}

### Set your API key

```bash
export ANTHROPIC_API_KEY=<insert your API key>
```

### Create the Kubernetes secret

```bash
kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: anthropic-secret
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
type: Opaque
stringData:
  Authorization: $ANTHROPIC_API_KEY
EOF
```

### Create the LLM backend

```bash
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: anthropic
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      anthropic:
        model: claude-haiku-4-5-20251001
  policies:
    auth:
      secretRef:
        name: anthropic-secret
EOF
```

### Create the HTTPRoute

```bash
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: anthropic
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  rules:
    - backendRefs:
      - name: anthropic
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        group: agentgateway.dev
        kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
```

{{< /tab >}}

{{< tab >}}

### Set your API key

```bash
export GEMINI_API_KEY=<insert your API key>
```

### Create the Kubernetes secret

```bash
kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: gemini-secret
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
type: Opaque
stringData:
  Authorization: $GEMINI_API_KEY
EOF
```

### Create the LLM backend

```bash
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: gemini
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      gemini:
        model: gemini-2.0-flash
  policies:
    auth:
      secretRef:
        name: gemini-secret
EOF
```

### Create the HTTPRoute

```bash
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: gemini
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  rules:
    - backendRefs:
      - name: gemini
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        group: agentgateway.dev
        kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
```

{{< /tab >}}

{{< /tabs >}}

---

## Step 7: Test the API

Set up port-forwarding to access the agentgateway proxy from your local machine:

```bash
kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80 &
```

Send a request to the LLM provider through agentgateway:

{{< tabs items="OpenAI,Anthropic,Google Gemini" >}}

{{< tab >}}
```bash
curl "localhost:8080/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4.1-nano",
    "messages": [{"role": "user", "content": "Hello! What is Kubernetes in one sentence?"}]
  }' | jq
```
{{< /tab >}}

{{< tab >}}
```bash
curl "localhost:8080/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-haiku-4-5-20251001",
    "messages": [{"role": "user", "content": "Hello! What is Kubernetes in one sentence?"}]
  }' | jq
```
{{< /tab >}}

{{< tab >}}
```bash
curl "localhost:8080/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.0-flash",
    "messages": [{"role": "user", "content": "Hello! What is Kubernetes in one sentence?"}]
  }' | jq
```
{{< /tab >}}

{{< /tabs >}}

Example output:

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Kubernetes is an open-source container orchestration platform that automates the deployment, scaling, and management of containerized applications."
    },
    "index": 0,
    "finish_reason": "stop"
  }]
}
```

---

## Cleanup

When you're done, stop port-forwarding and delete the kind cluster:

```bash
# Stop port-forward (if running in background)
kill %1 2>/dev/null

# Delete the kind cluster
kind delete cluster --name agentgateway
```

---

## Next steps

{{< cards >}}
  {{< card link="/docs/kubernetes/latest/llm/" title="LLM Overview" subtitle="Learn more about LLM gateway features on Kubernetes" >}}
  {{< card link="/docs/kubernetes/latest/llm/providers/" title="More Providers" subtitle="Configure additional LLM providers" >}}
  {{< card link="/docs/kubernetes/latest/security/" title="Security" subtitle="Secure your agentgateway deployment" >}}
{{< /cards >}}
