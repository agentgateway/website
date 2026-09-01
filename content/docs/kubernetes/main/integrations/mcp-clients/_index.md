---
title: MCP clients
weight: 10
description: Connect AI coding assistants to MCP servers exposed through agentgateway on Kubernetes
test:
  mcp-clients-k8s:
  - file: ${versionRoot}/documentation/install/helm.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/mcp/static-mcp.md
    path: setup-mcp-server
  - file: ${versionRoot}/integrations/mcp-clients/_index.md
    path: mcp-clients-k8s
icon: extension
---

{{< reuse "agw-docs/pages/agentgateway/integrations/mcp-clients-k8s.md" >}}
