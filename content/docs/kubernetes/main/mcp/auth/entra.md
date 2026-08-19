---
title: Set up Microsoft Entra ID
weight: 50
description: Configure Microsoft Entra ID (Azure AD) as an OAuth identity provider for MCP authentication with agentgateway.
test:
  setup-entra:
  - file: ${versionRoot}/install/helm.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/mcp/static-mcp.md
    path: setup-mcp-server
  - file: ${versionRoot}/mcp/auth/entra.md
    path: setup-entra
---

{{< reuse "agw-docs/pages/agentgateway/mcp/mcp-auth-entra.md" >}}
