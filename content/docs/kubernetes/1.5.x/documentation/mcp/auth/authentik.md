---
title: Set up authentik
weight: 50
description: Deploy and configure authentik as an OAuth identity provider for MCP authentication with agentgateway.
test:
  setup-authentik:
  - file: ${versionRoot}/documentation/install/helm.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/mcp/static-mcp.md
    path: setup-mcp-server
  - file: ${versionRoot}/documentation/mcp/auth/authentik.md
    path: setup-authentik
---

{{< reuse "agw-docs/pages/agentgateway/mcp/mcp-auth-authentik.md" >}}
