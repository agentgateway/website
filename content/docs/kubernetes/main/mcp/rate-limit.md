---
title: Rate limiting for MCP
weight: 65
description: Control MCP tool call rates to prevent overload and ensure fair access to expensive tools.
test:
  mcp-local-rate-limit:
  - file: content/docs/kubernetes/latest/install/helm.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/mcp/static-mcp.md
    path: setup-mcp-server
  - file: content/docs/kubernetes/main/mcp/rate-limit.md
    path: mcp-local-rate-limit
---

{{< reuse "agw-docs/pages/agentgateway/mcp/rate-limit.md" >}}
