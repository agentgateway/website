---
title: Load balancing
weight: 35
description: Distribute requests across multiple LLM providers automatically (Power of Two Choices, P2C).
test:
  load-balancing-multi-provider:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/llm/load-balancing.md
    path: load-balancing
---

{{< reuse "agw-docs/pages/agentgateway/llm/load-balancing.md" >}}
