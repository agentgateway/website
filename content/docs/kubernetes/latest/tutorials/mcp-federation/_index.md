---
title: MCP Federation
weight: 3
description: Federate tools from multiple MCP servers through a single endpoint on Kubernetes
---

Expose a single MCP endpoint that aggregates tools from multiple backend MCP servers with unified routing on Kubernetes.

## What you'll build

In this tutorial, you will:

1. Set up a local Kubernetes cluster with agentgateway
2. Deploy two separate MCP servers (echo and filesystem)
3. Federate both servers into a single {{< reuse "agw-docs/snippets/backend.md" >}}
4. Access tools from both servers through one unified endpoint

## Before you begin

Make sure you have the following tools installed:
- [Docker](https://www.docker.com/products/docker-desktop/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [kind](https://kind.sigs.k8s.io/)
- [Helm](https://helm.sh/docs/intro/install/)

For detailed installation instructions, see the [LLM Gateway tutorial](../llm-gateway/).

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
kubectl get deployment agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

---

## Step 4: Deploy the MCP servers

Deploy two separate MCP servers that provide different sets of tools.

### MCP "Everything" server

This server provides general-purpose tools like `echo`, `add`, and `longRunningOperation`.

```bash
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-everything
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mcp-everything
  template:
    metadata:
      labels:
        app: mcp-everything
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
  name: mcp-everything
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  selector:
    app: mcp-everything
  ports:
  - port: 80
    targetPort: 8080
    appProtocol: kgateway.dev/mcp
EOF
```

### MCP "Filesystem" server

This server provides file operation tools like `read_file`, `write_file`, and `list_directory`.

```bash
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-filesystem
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mcp-filesystem
  template:
    metadata:
      labels:
        app: mcp-filesystem
    spec:
      containers:
      - name: mcp-server
        image: node:22-alpine
        command: ["npx", "-y", "mcp-proxy", "--port", "8080", "--", "npx", "-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
        ports:
        - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: mcp-filesystem
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  selector:
    app: mcp-filesystem
  ports:
  - port: 80
    targetPort: 8080
    appProtocol: kgateway.dev/mcp
EOF
```

Wait for both pods to be ready:

```bash
kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}} -l 'app in (mcp-everything, mcp-filesystem)' -w
```

---

## Step 5: Create the federated backend

Create a single {{< reuse "agw-docs/snippets/backend.md" >}} that targets both MCP servers. Tools from each server are automatically prefixed with their target name.

```bash
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: mcp-federated
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  mcp:
    targets:
    - name: everything
      static:
        host: mcp-everything.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local
        port: 80
        protocol: SSE
    - name: filesystem
      static:
        host: mcp-filesystem.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local
        port: 80
        protocol: SSE
EOF
```

---

## Step 6: Create the HTTPRoute

```bash
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: mcp-federated
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  rules:
    - backendRefs:
      - name: mcp-federated
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        group: agentgateway.dev
        kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
```

---

## Step 7: Test the federated endpoint

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

Copy the `mcp-session-id` from the response headers, then list all available tools:

```bash
curl -s http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":2}'
```

You should see tools from **both** servers, prefixed with their target name:
- `everything_echo`, `everything_add`, `everything_longRunningOperation`, ...
- `filesystem_read_file`, `filesystem_write_file`, `filesystem_list_directory`, ...

### Call a tool from each server

Call the echo tool from the "everything" server:

```bash
curl -s http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"everything_echo","arguments":{"message":"Hello from federation!"}},"id":3}'
```

Call the list_directory tool from the "filesystem" server:

```bash
curl -s http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"filesystem_list_directory","arguments":{"path":"/tmp"}},"id":4}'
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
  {{< card link="/docs/kubernetes/latest/tutorials/jwt-authorization" title="JWT Authorization" subtitle="Secure with JWT authentication" >}}
  {{< card link="/docs/kubernetes/latest/mcp/" title="MCP Documentation" subtitle="Complete MCP configuration reference" >}}
{{< /cards >}}
