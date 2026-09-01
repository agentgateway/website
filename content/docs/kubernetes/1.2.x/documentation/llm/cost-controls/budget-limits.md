---
title: Budget and spend limits
weight: 40
description: Control LLM spending by enforcing token budget limits per API key or user.
test:
  budget-limits-apikey-auth:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/integrations/llm/providers/openai.md
    path: openai-setup
  - file: ${versionRoot}/documentation/llm/budget-limits.md
    path: budget-limits
---

{{< reuse "agw-docs/pages/agentgateway/llm/budget-limits.md" >}}
