---
title: Virtual keys
weight: 30
description: Issue API keys with per-key token budgets and cost tracking (also known as virtual keys).
test:
  virtual-keys-auth:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: content/docs/kubernetes/latest/llm/virtual-keys.md
    path: virtual-keys
  - file: content/docs/kubernetes/latest/llm/virtual-keys.md
    path: virtual-keys-httpbun-test
  virtual-keys-ratelimit:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: content/docs/kubernetes/latest/security/rate-limit-global.md
    path: deploy-rate-limit-server
  - file: content/docs/kubernetes/latest/llm/virtual-keys.md
    path: virtual-keys
  - file: content/docs/kubernetes/latest/llm/virtual-keys.md
    path: virtual-keys-with-ratelimit
  - file: content/docs/kubernetes/latest/llm/virtual-keys.md
    path: virtual-keys-ratelimit-test
---

{{< reuse "agw-docs/pages/agentgateway/llm/virtual-keys.md" >}}
