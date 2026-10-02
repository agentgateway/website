---
title: Static MCP
weight: 10
test:
  setup-mcp-server:
    type: [schema, functional]
    steps:
    - file: content/docs/kubernetes/latest/documentation/install/helm.md
      path: standard
    - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
      path: all
    - file: content/docs/kubernetes/latest/documentation/mcp/static-mcp.md
      path: setup-mcp-server
---

{{< reuse "agw-docs/pages/agentgateway/mcp/static.md" >}}