---
title: Claude Code
weight: 5
description: Configure Claude Code CLI to use agentgateway running in Kubernetes
test:
  claude-code-k8s:
  - file: content/docs/kubernetes/main/install/helm.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/integrations/llm-clients/_index.md
    path: llm-clients-k8s-gateway-url
  - file: content/docs/kubernetes/main/integrations/llm-clients/claude-code.md
    path: claude-code-k8s
---

{{< reuse "agw-docs/pages/agentgateway/integrations/llm-clients-k8s/claude-code.md" >}}
