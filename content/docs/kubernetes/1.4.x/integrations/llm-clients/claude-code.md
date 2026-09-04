---
title: Claude Code
weight: 10
description: Configure Claude Code CLI to use agentgateway running in Kubernetes
test:
  claude-code-k8s:
  - file: ${versionRoot}/install/helm.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/integrations/llm-clients/claude-code.md
    path: claude-code-k8s
---

{{< reuse "agw-docs/pages/agentgateway/integrations/llm-clients-k8s/claude-code.md" >}}
