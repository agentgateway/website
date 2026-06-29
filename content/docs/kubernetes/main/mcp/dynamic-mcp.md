---
title: Dynamic MCP
weight: 20
description: Route traffic to MCP servers dynamically using label selectors so backends can be updated without changing the Backend resource.
test:
  dynamic-mcp:
  - file: ${versionRoot}/install/helm.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - path: dynamic-mcp
---

{{< reuse "agw-docs/pages/agentgateway/mcp/dynamic.md" >}}