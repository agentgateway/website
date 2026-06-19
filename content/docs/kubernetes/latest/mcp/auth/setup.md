---
title: Set up MCP auth
weight: 40
description: Secure MCP servers with OAuth 2.0 authentication using agentgateway and an identity provider like Keycloak.
test:
  mcp-auth-setup:
  - file: content/docs/kubernetes/main/install/helm.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/mcp/static-mcp.md
    path: setup-mcp-server
  - file: content/docs/kubernetes/main/mcp/auth/keycloak.md
    path: setup-keycloak
  - file: content/docs/kubernetes/main/mcp/auth/setup.md
    path: mcp-auth-setup
---

{{< reuse "agw-docs/pages/agentgateway/mcp/mcp-auth-setup.md" >}}
