---
title: Virtual keys
weight: 10
description: Issue API keys with per-key token budgets and cost tracking (also known as virtual keys).
test:
  virtual-keys:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/integrations/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: content/docs/kubernetes/latest/documentation/llm/cost-controls/virtual-keys.md
    path: virtual-keys
  - file: content/docs/kubernetes/latest/documentation/llm/cost-controls/virtual-keys.md
    path: virtual-keys-httpbun-test
---

{{< reuse "agw-docs/pages/agentgateway/llm/virtual-keys.md" >}}
