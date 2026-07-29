---
title: Set up Auth0
weight: 70
description: Configure Auth0 as an OAuth identity provider for MCP authentication with agentgateway.
test:
  setup-auth0:
  - file: ${versionRoot}/install/helm.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/mcp/static-mcp.md
    path: setup-mcp-server
  - file: ${versionRoot}/mcp/auth/auth0.md
    path: setup-auth0
---

{{< reuse "agw-docs/pages/agentgateway/mcp/mcp-auth-auth0.md" >}}
