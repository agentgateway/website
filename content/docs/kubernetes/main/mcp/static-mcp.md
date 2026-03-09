---
title: Static MCP
weight: 10
test:
  setup-mcp-server:
  - file: content/docs/kubernetes/latest/install/helm.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/mcp/static-mcp.md
    path: setup-mcp-server
---

{{< reuse "agw-docs/pages/agentgateway/mcp/static.md" >}}