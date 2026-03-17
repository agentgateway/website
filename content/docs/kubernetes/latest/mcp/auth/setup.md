---
title: Set up MCP auth
weight: 40
test:
  mcp-auth-setup:
  - file: content/docs/kubernetes/latest/install/helm.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/mcp/static-mcp.md
    path: setup-mcp-server
  - file: content/docs/kubernetes/latest/mcp/auth/keycloak.md
    path: setup-keycloak
  - file: content/docs/kubernetes/latest/mcp/auth/setup.md
    path: mcp-auth-setup
---

{{< reuse "agw-docs/pages/agentgateway/mcp/mcp-auth-setup.md" >}}
