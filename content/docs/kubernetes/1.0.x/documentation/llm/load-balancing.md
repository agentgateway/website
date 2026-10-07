---
title: Load balancing
weight: 35
description: Distribute requests across multiple LLM providers automatically (Power of Two Choices, P2C).
test:
  load-balancing-multi-provider:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/llm/load-balancing.md
    path: load-balancing
---

{{< reuse "agw-docs/pages/agentgateway/llm/load-balancing.md" >}}
