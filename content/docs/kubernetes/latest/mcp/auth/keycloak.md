---
title: Set up Keycloak
weight: 20
description: Deploy and configure Keycloak as an OAuth identity provider for MCP authentication with agentgateway.
test:
  setup-keycloak:
  - file: content/docs/kubernetes/main/install/helm.md
    path: experimental
  - file: content/docs/kubernetes/main/mcp/auth/keycloak.md
    path: setup-keycloak
---

{{< reuse "agw-docs/pages/agentgateway/mcp/mcp-auth-keycloak.md" >}}
