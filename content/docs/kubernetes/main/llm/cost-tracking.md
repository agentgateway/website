---
title: Track LLM costs
weight: 100
description: Track and monitor LLM costs per request using token usage metrics.
test:
  cost-tracking:
  - file: content/docs/kubernetes/latest/install/helm.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/llm/providers/openai.md
    path: openai-setup
  - file: content/docs/kubernetes/main/llm/cost-tracking.md
    path: cost-tracking
---

{{< reuse "agw-docs/pages/agentgateway/llm/cost-tracking.md" >}}
