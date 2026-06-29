---
title: MCP clients
weight: 10
description: Connect AI coding assistants to MCP servers exposed through agentgateway on Kubernetes
test:
  mcp-clients-k8s:
  - file: ${versionRoot}/install/helm.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/mcp/static-mcp.md
    path: setup-mcp-server
  - path: mcp-clients-k8s
---

{{< reuse "agw-docs/pages/agentgateway/integrations/mcp-clients-k8s.md" >}}
