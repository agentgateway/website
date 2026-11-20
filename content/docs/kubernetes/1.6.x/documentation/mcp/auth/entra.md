---
title: Set up Microsoft Entra ID
weight: 50
description: Configure Microsoft Entra ID (Azure AD) as an OAuth identity provider for MCP authentication with agentgateway.
test:
  setup-entra:
  - file: ${versionRoot}/documentation/install/helm.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/mcp/static-mcp.md
    path: setup-mcp-server
  - file: ${versionRoot}/documentation/mcp/auth/entra.md
    path: setup-entra
---

{{< reuse "agw-docs/pages/agentgateway/mcp/mcp-auth-entra.md" >}}
