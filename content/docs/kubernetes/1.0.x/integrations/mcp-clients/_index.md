---
title: MCP clients
weight: 15
description: Connect AI coding assistants to MCP servers exposed through agentgateway on Kubernetes
test:
  mcp-clients-k8s:
  - file: content/docs/kubernetes/latest/install/helm.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/mcp/static-mcp.md
    path: setup-mcp-server
  - file: content/docs/kubernetes/latest/integrations/mcp-clients/_index.md
    path: mcp-clients-k8s
---

{{< reuse "agw-docs/pages/agentgateway/integrations/mcp-clients-k8s.md" >}}
