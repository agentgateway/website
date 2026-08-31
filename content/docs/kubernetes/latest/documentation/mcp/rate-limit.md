---
title: Rate limiting for MCP
weight: 65
description: Control MCP tool call rates to prevent overload and ensure fair access to expensive tools.
test:
  mcp-local-rate-limit:
  - file: ${versionRoot}/install/helm.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/mcp/static-mcp.md
    path: setup-mcp-server
  - file: ${versionRoot}/mcp/rate-limit.md
    path: mcp-local-rate-limit
---

{{< reuse "agw-docs/pages/agentgateway/mcp/rate-limit.md" >}}
