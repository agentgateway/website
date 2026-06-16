---
title: Static MCP
weight: 10
description: Route traffic to an MCP server at a static address by configuring a fixed Backend resource.
test:
  setup-mcp-server:
  - file: content/docs/kubernetes/main/install/helm.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/mcp/static-mcp.md
    path: setup-mcp-server
---

{{< reuse "agw-docs/pages/agentgateway/mcp/static.md" >}}