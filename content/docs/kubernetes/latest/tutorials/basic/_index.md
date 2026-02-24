---
title: Basic MCP Server
weight: 2
description: Deploy and connect to an MCP server through agentgateway on Kubernetes
---

Deploy an MCP server on Kubernetes and connect to it through agentgateway using the Kubernetes Gateway API.

## What you'll build

In this tutorial, you will:

1. Set up a local Kubernetes cluster using kind
2. Install the {{< reuse "agw-docs/snippets/kgateway.md" >}} control plane
3. Deploy an MCP server as a Kubernetes service
4. Create an {{< reuse "agw-docs/snippets/backend.md" >}} to connect to the MCP server
5. Route MCP traffic through agentgateway and test tool calls

## Before you begin

Make sure you have the following tools installed:
- [Docker](https://www.docker.com/products/docker-desktop/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [kind](https://kind.sigs.k8s.io/)
- [Helm](https://helm.sh/docs/intro/install/)

For detailed installation instructions for each tool, see the [LLM Gateway tutorial](../llm-gateway/).

---

## Step 1: Create a kind cluster

```bash
kind create cluster --name agentgateway
```

Verify the cluster is running:

```bash
kubectl cluster-info --context kind-agentgateway
```

---

## Step 2: Install agentgateway

Install the Gateway API CRDs, agentgateway CRDs, and the control plane.

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

Verify the control plane is running:

```bash
kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}}
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

Wait for the proxy to be ready:

```bash
kubectl get gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl get deployment agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

---

## Step 4: Deploy an MCP server

Deploy the MCP "everything" server as a Kubernetes Deployment and Service. This server provides sample tools like `echo`, `add`, and `longRunningOperation`.

```bash
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server-everything
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mcp-server-everything
  template:
    metadata:
      labels:
        app: mcp-server-everything
    spec:
      containers:
      - name: mcp-server
        image: node:22-alpine
        command: ["npx", "-y", "mcp-proxy", "--port", "8080", "--", "npx", "-y", "@modelcontextprotocol/server-everything"]
        ports:
        - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: mcp-server-everything
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  selector:
    app: mcp-server-everything
  ports:
  - port: 80
    targetPort: 8080
    appProtocol: kgateway.dev/mcp
EOF
```

Wait for the MCP server pod to be ready. The first startup may take a minute as it downloads the npm packages.

```bash
kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}} -l app=mcp-server-everything -w
```

---

## Step 5: Create the MCP backend

Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource that connects to the MCP server using dynamic service discovery.

```bash
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: mcp-backend
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  mcp:
    selector:
      services:
        matchLabels:
          app: mcp-server-everything
EOF
```

---

## Step 6: Create the HTTPRoute

Route MCP traffic through the agentgateway proxy to the backend.

```bash
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: mcp
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  rules:
    - backendRefs:
      - name: mcp-backend
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        group: agentgateway.dev
        kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
```

---

## Step 7: Test the MCP connection

Set up port-forwarding:

```bash
kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80 &
```

Initialize an MCP session:

```bash
curl -s -i http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
```

Copy the `mcp-session-id` from the response headers, then list available tools:

```bash
curl -s http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":2}'
```

You should see tools like `echo`, `add`, `longRunningOperation`, and more.

### Call a tool

```bash
curl -s http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"Hello from Kubernetes!"}},"id":3}'
```

Example output:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [{"type": "text", "text": "Echo: Hello from Kubernetes!"}]
  }
}
```

---

## Cleanup

```bash
kill %1 2>/dev/null
kind delete cluster --name agentgateway
```

---

## Next steps

{{< cards >}}
  {{< card link="/docs/kubernetes/latest/tutorials/mcp-federation" title="MCP Federation" subtitle="Federate multiple MCP servers" >}}
  {{< card link="/docs/kubernetes/latest/tutorials/jwt-authorization" title="JWT Authorization" subtitle="Secure with JWT authentication" >}}
  {{< card link="/docs/kubernetes/latest/mcp/" title="MCP Documentation" subtitle="Complete MCP configuration reference" >}}
{{< /cards >}}
