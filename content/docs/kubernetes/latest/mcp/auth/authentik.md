---
title: Set up authentik
weight: 60
description: Deploy and configure authentik as an OAuth identity provider for MCP authentication with agentgateway.
test:
  setup-authentik:
  - file: ${versionRoot}/install/helm.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/mcp/static-mcp.md
    path: setup-mcp-server
  - file: ${versionRoot}/mcp/auth/authentik.md
    path: setup-authentik
---

{{< reuse "agw-docs/pages/agentgateway/mcp/mcp-auth-authentik.md" >}}
