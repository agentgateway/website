---
title: Static MCP
weight: 10
description: Route traffic to an MCP server at a static address by configuring a fixed Backend resource.
test:
  setup-mcp-server:
  - file: content/docs/kubernetes/latest/install/helm.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/mcp/static-mcp.md
    path: setup-mcp-server
---

{{< reuse "agw-docs/pages/agentgateway/mcp/static.md" >}}