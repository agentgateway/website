---
title: "Connect Any IDE to GitHub MCP Server Through AgentGateway"
publishDate: 2026-02-19
author: "Sebastian Maniak"
description: "Route MCP traffic from Cursor, VS Code, Windsurf, Claude Code, and OpenCode to GitHub's remote MCP server through Solo AgentGateway — with config examples for every IDE."
---

## Introduction

Modern AI-powered IDEs and coding agents ship with built-in MCP client support. That means you can connect them to GitHub's remote MCP server to give your AI assistant direct access to issues, pull requests, code search, and repository management.

But connecting directly to GitHub means no visibility into what tools are being called, no rate limiting, and no centralized credential management. Every developer has their own PAT, every tool call goes straight to GitHub ungoverned.

This guide shows you how to route MCP traffic from **any IDE** — Cursor, VS Code, Windsurf, Claude Code, or OpenCode — to **GitHub's remote MCP server** through **[Solo AgentGateway](https://agentgateway.dev)**. You deploy the gateway once, and every IDE on your team connects through it.

## What You Get

- **One gateway, every IDE**: Deploy AgentGateway once, connect all your tools
- **Centralized credentials**: GitHub PAT lives in a Kubernetes secret, not on every developer laptop
- **Rate limiting**: Control tool call volume per IDE or per user
- **Observability**: OpenTelemetry traces for every MCP interaction
- **No self-hosted MCP server**: GitHub hosts the MCP server at `api.githubcopilot.com` — you just proxy

## Architecture

{{< reuse-image src="img/blog/architecture.gif" >}}


## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed and running
- [kind](https://kind.sigs.k8s.io/docs/user/quick-start/#installation) installed
- `kubectl` and `helm` installed
- A [GitHub Personal Access Token](https://github.com/settings/tokens) (PAT)
- At least one of: Cursor, VS Code (with Copilot), Windsurf, Claude Code, or OpenCode

## Step 1: Create a Kind Cluster

```bash
kind create cluster --name agentgateway
```

Verify it's running:

```bash
kubectl get nodes
```

## Step 2: Install AgentGateway

Deploy the Kubernetes Gateway API CRDs:

```bash
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.4.0/standard-install.yaml
```

Install the AgentGateway CRDs and control plane:

```bash
helm upgrade -i --create-namespace \
  --namespace agentgateway-system \
  --version v2.2.1 agentgateway-crds oci://ghcr.io/kgateway-dev/charts/agentgateway-crds

helm upgrade -i -n agentgateway-system agentgateway oci://ghcr.io/kgateway-dev/charts/agentgateway \
--version v2.2.1
```

Verify the control plane is running:

```bash
kubectl get pods -n agentgateway-system
```

## Step 3: Create an AgentGateway Proxy

```bash
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: agentgateway-proxy
  namespace: agentgateway-system
spec:
  gatewayClassName: agentgateway
  listeners:
  - name: http
    port: 80
    protocol: HTTP
EOF
```

Wait for the proxy pod to be ready:

```bash
kubectl rollout status deploy/agentgateway-proxy -n agentgateway-system
```

## Step 4: Configure the GitHub Remote MCP Backend

GitHub hosts a remote MCP server at `https://api.githubcopilot.com/mcp/`. We point AgentGateway at it instead of deploying our own.

Create a secret with your GitHub PAT:

```bash
kubectl create secret generic github-mcp-secret \
  -n agentgateway-system \
  --from-literal=Authorization="Bearer ghp_your_token_here"
```

Create the backend:

```bash
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: github-mcp-backend
  namespace: agentgateway-system
spec:
  mcp:
    targets:
    - name: mcp-target
      static:
        host: api.githubcopilot.com
        port: 443
        path: /mcp/
  policies:
    auth:
      secretRef:
        name: github-mcp-secret
    tls:
      sni: api.githubcopilot.com
EOF
```

Key details:
- **`path: /mcp/`** — GitHub's MCP endpoint
- **`tls.sni`** — required for HTTPS on port 443
- **`auth.secretRef`** — injects the `Authorization: Bearer <PAT>` header automatically

## Step 5: Create the HTTPRoute

```bash
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: github-mcp
  namespace: agentgateway-system
spec:
  parentRefs:
  - name: agentgateway-proxy
    namespace: agentgateway-system
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /github
    backendRefs:
    - name: github-mcp-backend
      group: agentgateway.dev
      kind: AgentgatewayBackend
EOF
```

## Step 6: Port-Forward

Expose the gateway locally:

```bash
kubectl port-forward -n agentgateway-system deployment/agentgateway-proxy 8080:80
```

Leave this running. All IDE configs below use `http://localhost:8080`.

---

## IDE Configuration

Each IDE has its own MCP config format. Pick yours below — or configure all of them to use the same gateway endpoint.

### Cursor

Create or edit `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per-project):

```json
{
  "mcpServers": {
    "github": {
      "url": "http://localhost:8080/github/mcp"
    }
  }
}
```

Restart Cursor → **Settings → MCP** → verify GitHub tools appear.

### VS Code (with GitHub Copilot)

Add to your VS Code `settings.json` (Cmd/Ctrl + , → search "mcp"):

```json
{
  "github.copilot.chat.mcp.servers": {
    "github": {
      "url": "http://localhost:8080/github/mcp"
    }
  }
}
```

Or for workspace-specific config, add to `.vscode/settings.json`.

Reload VS Code (Cmd/Ctrl + Shift + P → "Developer: Reload Window") → open Copilot Chat → tools should list GitHub MCP tools.

### Windsurf

Create or edit `~/.windsurf/mcp.json` (global) or `.windsurf/mcp.json` (per-project):

```json
{
  "mcpServers": {
    "github": {
      "url": "http://localhost:8080/github/mcp"
    }
  }
}
```

Restart Windsurf → verify connection in MCP settings.

### Claude Code

Add via CLI:

```bash
claude mcp add github --transport sse http://localhost:8080/github/mcp
```

Or add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "github": {
      "type": "sse",
      "url": "http://localhost:8080/github/mcp"
    }
  }
}
```

### OpenCode

Add to your `opencode.json` config:

```json
{
  "mcp": {
    "servers": {
      "github": {
        "type": "sse",
        "url": "http://localhost:8080/github/mcp"
      }
    }
  }
}
```

---

## Step 7: Test It

Open your IDE's AI chat and try:

- *"List open issues in my repo"*
- *"Create a new branch called feature/test"*
- *"Search for files referencing AgentGateway"*

Every tool call flows through AgentGateway regardless of which IDE you're using. The gateway handles auth, logs the interaction, and forwards to GitHub.

## Verifying Traffic

Check proxy logs:

```bash
kubectl logs -n agentgateway-system deploy/agentgateway-proxy --tail=20
```

You should see MCP connection events and tool call forwards to `api.githubcopilot.com`.

## IDE Comparison

| IDE | Config File | Transport | Auth Headers |
|-----|------------|-----------|--------------|
| **Cursor** | `~/.cursor/mcp.json` | streamable-http | ✅ supported |
| **VS Code** | `settings.json` | streamable-http | ✅ supported |
| **Windsurf** | `~/.windsurf/mcp.json` | streamable-http | ✅ supported |
| **Claude Code** | `.mcp.json` or CLI | SSE | ✅ supported |
| **OpenCode** | `opencode.json` | SSE | ✅ supported |

> **Note**: All IDEs connect to the same `http://localhost:8080/github/mcp` endpoint. The gateway doesn't care which client is calling — it applies the same auth, rate limiting, and observability to all of them.

## What's Next

- **Add more MCP servers**: Slack, Notion, Jira — all behind the same gateway, same endpoint pattern
- **Security policies**: JWT auth, prompt guards, tool-level RBAC with `AgentgatewayPolicy`
- **Team rollout**: Share the gateway endpoint with your team — one PAT, centrally managed, no credentials on laptops
- **Per-IDE rate limiting**: Different limits for different tools or users

## Cleanup

```bash
kubectl delete httproute github-mcp -n agentgateway-system
kubectl delete agentgatewaybackend github-mcp-backend -n agentgateway-system
kubectl delete secret github-mcp-secret -n agentgateway-system
kind delete cluster --name agentgateway
```

## Conclusion

Every AI-powered IDE now speaks MCP. But connecting each one directly to backend servers means fragmented credentials, zero visibility, and no governance. AgentGateway gives you a single control point — deploy it once, connect every IDE on your team, and get auth, rate limiting, and observability on every tool call.

One gateway. Every IDE. Full visibility.
