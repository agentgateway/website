---
title: Budget and spend limits
weight: 35
description: Control LLM spending by enforcing token budget limits per API key or user.
test:
  budget-limits:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: content/docs/kubernetes/latest/llm/budget-limits.md
    path: budget-limits
---

{{< reuse "agw-docs/pages/agentgateway/llm/budget-limits.md" >}}
