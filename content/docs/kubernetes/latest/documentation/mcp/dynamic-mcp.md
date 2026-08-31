---
title: Dynamic MCP
weight: 20
description: Route traffic to MCP servers dynamically using label selectors so backends can be updated without changing the Backend resource.
test:
  dynamic-mcp:
  - file: ${versionRoot}/documentation/install/helm.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/mcp/dynamic-mcp.md
    path: dynamic-mcp
---

{{< reuse "agw-docs/pages/agentgateway/mcp/dynamic.md" >}}