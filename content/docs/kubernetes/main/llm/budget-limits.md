---
title: Budget and spend limits
weight: 75
description: Control LLM spending by enforcing token budget limits per API key or user.
test:
  budget-limits-apikey-auth:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/llm/providers/openai.md
    path: openai-setup
  - file: content/docs/kubernetes/main/llm/budget-limits.md
    path: budget-limits
---

{{< reuse "agw-docs/pages/agentgateway/llm/budget-limits.md" >}}
