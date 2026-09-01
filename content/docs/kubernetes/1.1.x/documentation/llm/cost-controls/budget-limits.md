---
title: Budget and spend limits
weight: 40
description: Control LLM spending by enforcing token budget limits per API key or user.
test:
  budget-limits-apikey-auth:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/integrations/llm/providers/openai.md
    path: openai-setup
  - file: content/docs/kubernetes/latest/documentation/llm/cost-controls/budget-limits.md
    path: budget-limits
---

{{< reuse "agw-docs/pages/agentgateway/llm/budget-limits.md" >}}
