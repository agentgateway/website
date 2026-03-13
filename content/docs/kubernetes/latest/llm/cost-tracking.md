---
title: Track LLM costs
weight: 100
description: Track and monitor LLM costs per request using token usage metrics.
test:
  cost-tracking:
  - file: content/docs/kubernetes/latest/quickstart/helm.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: content/docs/kubernetes/latest/llm/cost-tracking.md
    path: cost-tracking
---

{{< reuse "agw-docs/pages/agentgateway/llm/cost-tracking.md" >}}
