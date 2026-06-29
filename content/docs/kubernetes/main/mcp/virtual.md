---
title: Virtual MCP
weight: 30
description: Federate tools from multiple MCP servers on a single gateway endpoint using virtual MCP multiplexing.
test:
  virtual-mcp:
  - file: ${versionRoot}/install/helm.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - path: virtual-mcp
---

{{< reuse "agw-docs/pages/agentgateway/mcp/multiplex.md" >}}