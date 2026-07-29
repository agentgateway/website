---
title: Set up Descope
weight: 90
description: Configure Descope as an OAuth identity provider for MCP authentication with agentgateway.
test:
  setup-descope:
  - file: ${versionRoot}/install/helm.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/mcp/static-mcp.md
    path: setup-mcp-server
  - file: ${versionRoot}/mcp/auth/descope.md
    path: setup-descope
---

{{< reuse "agw-docs/pages/agentgateway/mcp/mcp-auth-descope.md" >}}
