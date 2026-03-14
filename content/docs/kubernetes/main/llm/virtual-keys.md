---
title: Virtual key management
weight: 32
description: Issue API keys with per-key token budgets and cost tracking (also known as virtual keys).
test:
  virtual-keys-auth:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: content/docs/kubernetes/main/llm/virtual-keys.md
    path: virtual-keys
  - file: content/docs/kubernetes/main/llm/virtual-keys.md
    path: virtual-keys-httpbun-test
---

{{< reuse "agw-docs/pages/agentgateway/llm/virtual-keys.md" >}}
