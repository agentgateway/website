---
title: Load balancing
weight: 34
description: Distribute requests across multiple LLM providers automatically (Power of Two Choices, P2C).
test:
  load-balancing-multi-provider:
  - file: content/docs/kubernetes/latest/install/helm.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/llm/load-balancing.md
    path: load-balancing
---

{{< reuse "agw-docs/pages/agentgateway/llm/load-balancing.md" >}}
