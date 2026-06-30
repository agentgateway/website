---
title: Budget and spend limits
weight: 75
description: Control LLM spending by enforcing token budget limits per API key or user.
test:
  budget-limits-apikey-auth:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/llm/providers/openai.md
    path: openai-setup
  - file: ${versionRoot}/llm/budget-limits.md
    path: budget-limits
---

{{< reuse "agw-docs/pages/agentgateway/llm/budget-limits.md" >}}
