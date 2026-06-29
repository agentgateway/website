---
title: Set up MCP auth
weight: 40
description: Secure MCP servers with OAuth 2.0 authentication using agentgateway and an identity provider like Keycloak.
test:
  mcp-auth-setup:
  - file: ${versionRoot}/install/helm.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/mcp/static-mcp.md
    path: setup-mcp-server
  - file: ${versionRoot}/mcp/auth/keycloak.md
    path: setup-keycloak
  - path: mcp-auth-setup
---

{{< reuse "agw-docs/pages/agentgateway/mcp/mcp-auth-setup.md" >}}
