---
title: Virtual key management
weight: 32
description: Issue API keys with per-key token budgets and cost tracking (also known as virtual keys).
test:
  virtual-keys:
  - file: content/docs/kubernetes/latest/quickstart/helm.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: content/docs/kubernetes/latest/llm/virtual-keys.md
    path: virtual-keys
---

{{< reuse "agw-docs/pages/agentgateway/llm/virtual-keys.md" >}}
