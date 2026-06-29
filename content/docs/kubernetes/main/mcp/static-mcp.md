---
title: Static MCP
weight: 10
description: Route traffic to an MCP server at a static address by configuring a fixed Backend resource.
test:
  setup-mcp-server:
  - file: ${versionRoot}/install/helm.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - path: setup-mcp-server
---

{{< reuse "agw-docs/pages/agentgateway/mcp/static.md" >}}