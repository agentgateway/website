---
title: "MCP Multiplexing with AgentGateway"
publishDate: 2026-02-20
author: "Sebastian Maniak"
description: "Federate multiple MCP servers behind a single endpoint with AgentGateway OSS so clients connect once and see all available tools."
---

## Introduction

As your agentic AI environment grows, you end up with a sprawl of MCP servers — one for time utilities, one for general-purpose tools, one for Slack, another for GitHub. Each server exposes different tools, runs on a different port, and needs its own connection configuration.

Your MCP clients (Cursor, Claude Desktop, VS Code) shouldn't need to know about every server individually. They should connect to **one endpoint** and see **all available tools**.

This guide walks you through **MCP Multiplexing** — federating multiple MCP servers behind a single AgentGateway endpoint.

We'll deploy two MCP servers (`mcp-server-everything` for utility tools and `mcp-website-fetcher` for fetching web content), multiplex them behind AgentGateway, and connect from any IDE.

## What You Get

- **One endpoint, many servers**: Clients connect to `/mcp` and see tools from all federated servers
- **Automatic tool namespacing**: Tools are prefixed with the server name to avoid conflicts
- **Label-based federation**: Add servers by just adding a Kubernetes label — no config changes
- **IDE-agnostic**: Works with Cursor, VS Code, Claude Code, Windsurf, OpenCode

## Architecture

![mcp-multiplexing-architecture](https://github.com/user-attachments/assets/f81ffbc6-96b3-4771-bb47-c61c1823ad77)


## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed and running
- [kind](https://kind.sigs.k8s.io/docs/user/quick-start/#installation) installed
- `kubectl` and `helm` installed
- At least one MCP client: Cursor, VS Code, Claude Code, Windsurf, or OpenCode

## Step 1: Create a Kind Cluster

```bash
kind create cluster --name agentgateway-mcp
```

Verify it's running:

```bash
kubectl get nodes
```

## Step 2: Install AgentGateway OSS

Deploy the Kubernetes Gateway API CRDs:

```bash
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.4.0/standard-install.yaml
```

Install the AgentGateway CRDs and control plane:

```bash
helm upgrade -i --create-namespace \
  --namespace agentgateway-system \
  --version v2.2.1 \
  agentgateway-crds oci://ghcr.io/kgateway-dev/charts/agentgateway-crds

helm upgrade -i -n agentgateway-system \
  agentgateway oci://ghcr.io/kgateway-dev/charts/agentgateway \
  --version v2.2.1
```

Verify the control plane is running:

```bash
kubectl get pods -n agentgateway-system
```

You should see the `agentgateway` control plane pod in `Running` state.

## Step 3: Create an AgentGateway Proxy

```bash
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: mcp-gateway
  namespace: agentgateway-system
spec:
  gatewayClassName: agentgateway
  listeners:
  - name: http
    port: 80
    protocol: HTTP
EOF
```

Wait for the proxy pod:

```bash
kubectl rollout status deploy/mcp-gateway -n agentgateway-system --timeout=60s
```

## Step 4: Deploy Two MCP Servers

### Server 1: mcp-server-everything

This is the reference MCP test server from the Model Context Protocol project. It provides utility tools like `echo`, `add`, `longRunningOperation`, and more. The `streamableHttp` argument tells it to listen over HTTP instead of stdio — which is exactly the transport AgentGateway's multiplex feature requires.

```bash
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server-everything
  namespace: agentgateway-system
  labels:
    app: mcp-server-everything
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
      - name: mcp-server-everything
        image: node:20-alpine
        command: ["npx"]
        args: ["-y", "@modelcontextprotocol/server-everything", "streamableHttp"]
        ports:
        - containerPort: 3001
---
apiVersion: v1
kind: Service
metadata:
  name: mcp-server-everything
  namespace: agentgateway-system
  labels:
    app: mcp-server-everything
    mcp-federation: "true"
spec:
  selector:
    app: mcp-server-everything
  ports:
  - protocol: TCP
    port: 3001
    targetPort: 3001
    appProtocol: kgateway.dev/mcp
  type: ClusterIP
EOF
```

### Server 2: mcp-website-fetcher

This server provides a `fetch` tool that can retrieve and extract content from any URL — useful for giving your AI assistant web browsing capabilities. It's already HTTP-native, no wrapper needed.

```bash
kubectl apply -f- <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: mcp-website-fetcher-fix
  namespace: agentgateway-system
data:
  app.py: |
    import httpx
    from mcp.server.fastmcp import FastMCP
    mcp = FastMCP(
        "mcp-website-fetcher",
        host="0.0.0.0",
        port=8000,
        streamable_http_path="/mcp",
        stateless_http=True,
    )
    @mcp.tool()
    async def fetch(url: str) -> str:
        """Fetches a website and returns its content"""
        headers = {"User-Agent": "MCP Test Server"}
        async with httpx.AsyncClient(follow_redirects=True, headers=headers) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.text
    if __name__ == "__main__":
        mcp.run(transport="streamable-http")
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-website-fetcher
  namespace: agentgateway-system
spec:
  selector:
    matchLabels:
      app: mcp-website-fetcher
  template:
    metadata:
      labels:
        app: mcp-website-fetcher
    spec:
      containers:
      - name: mcp-website-fetcher
        image: ghcr.io/peterj/mcp-website-fetcher:main
        imagePullPolicy: Always
        command: ["python3", "/app/app.py"]
        volumeMounts:
        - name: fix
          mountPath: /app/app.py
          subPath: app.py
      volumes:
      - name: fix
        configMap:
          name: mcp-website-fetcher-fix
---
apiVersion: v1
kind: Service
metadata:
  name: mcp-website-fetcher
  namespace: agentgateway-system
  labels:
    app: mcp-website-fetcher
    mcp-federation: "true"
spec:
  selector:
    app: mcp-website-fetcher
  ports:
  - port: 80
    targetPort: 8000
    appProtocol: kgateway.dev/mcp
  type: ClusterIP
EOF
```

Wait for both servers to be ready:

```bash
kubectl rollout status deploy/mcp-server-everything -n agentgateway-system --timeout=60s
kubectl rollout status deploy/mcp-website-fetcher -n agentgateway-system --timeout=60s
```

> **Key detail**: Both services have the label `mcp-federation: "true"` and `appProtocol: kgateway.dev/mcp`. This is how AgentGateway discovers and federates them.

## Step 5: Create the Multiplexed MCP Backend

Here's where the magic happens. Instead of pointing to individual servers, you use a **label selector** to match all services with `mcp-federation: "true"`:

```bash
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: mcp-federated
  namespace: agentgateway-system
spec:
  mcp:
    targets:
    - name: mcp-servers
      selector:
        services:
          matchLabels:
            mcp-federation: "true"
EOF
```

This single backend automatically discovers both `mcp-server-everything` and `mcp-website-fetcher` — and any future MCP server you deploy with the `mcp-federation: "true"` label.

## Step 6: Create the HTTPRoute

```bash
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: mcp-route
  namespace: agentgateway-system
spec:
  parentRefs:
  - name: mcp-gateway
    namespace: agentgateway-system
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /mcp
    backendRefs:
    - name: mcp-federated
      group: agentgateway.dev
      kind: AgentgatewayBackend
EOF
```

## Step 7: Port-Forward and Test

Expose the gateway locally:

```bash
kubectl port-forward -n agentgateway-system deployment/mcp-gateway 8080:80
```

### Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector@latest
```

Connect with:
- **Transport**: Streamable HTTP
- **URL**: `http://localhost:8080/mcp`

Click **Tools** → **List Tools**. You should see tools from **both** servers, namespaced:

- `mcp-server-everything-3001_echo` — echo a message
- `mcp-server-everything-3001_add` — add two numbers
- `mcp-server-everything-3001_longRunningOperation` — simulate a long task
- `mcp-website-fetcher-80_fetch` — fetch and extract content from a URL

![mcpsuccess](https://github.com/user-attachments/assets/79433500-f480-4c36-a4f1-73d1a05e2483)


**One endpoint. Two servers. All tools.**

---

## Step 8: Connect from Your IDE

With port-forward running, configure your IDE:

### Cursor

Create or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "federated-tools": {
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

### VS Code (with GitHub Copilot)

Add to `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "federated-tools": {
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

### Claude Code

```bash
claude mcp add federated-tools --transport sse http://localhost:8080/mcp
```

### Windsurf

Create or edit `~/.windsurf/mcp.json`:

```json
{
  "mcpServers": {
    "federated-tools": {
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

### OpenCode

Add to `opencode.json`:

```json
{
  "mcp": {
    "servers": {
      "federated-tools": {
        "type": "sse",
        "url": "http://localhost:8080/mcp"
      }
    }
  }
}
```

Now try asking your IDE:

- *"Echo back: AgentGateway is awesome"* — uses the everything server
- *"Add 42 and 58"* — uses the everything server
- *"Fetch the content from https://agentgateway.dev"* — uses the website fetcher

The IDE doesn't know or care that these tools come from different servers. It's all one MCP endpoint.

---

## Adding More MCP Servers

The beauty of label-based federation: adding a new server is just a deployment + service with the `mcp-federation: "true"` label. No AgentGateway config changes needed — the backend's label selector picks it up automatically.

## Cleanup

```bash
kubectl delete httproute mcp-route -n agentgateway-system
kubectl delete agentgatewaybackend mcp-federated -n agentgateway-system
kubectl delete deploy mcp-server-everything mcp-website-fetcher -n agentgateway-system
kubectl delete svc mcp-server-everything mcp-website-fetcher -n agentgateway-system
kind delete cluster --name agentgateway-mcp
```

## Conclusion

MCP multiplexing solves one of the biggest challenges in production agentic AI environments: **server sprawl**. Developers shouldn't need to configure connections to every MCP server individually. One gateway endpoint, all tools.

Federate all your MCP servers behind AgentGateway, add new servers with a label, and every connected client sees the new tools immediately. No agent code changes. No client reconfiguration.

One gateway. All your tools.
