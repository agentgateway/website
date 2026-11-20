---
title: Set up Descope
weight: 50
description: Configure Descope as an OAuth identity provider for MCP authentication with agentgateway.
test:
  setup-descope:
  - file: ${versionRoot}/documentation/install/helm.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/mcp/static-mcp.md
    path: setup-mcp-server
  - file: ${versionRoot}/documentation/mcp/auth/descope.md
    path: setup-descope
---

{{< reuse "agw-docs/pages/agentgateway/mcp/mcp-auth-descope.md" >}}
