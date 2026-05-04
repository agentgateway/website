---
title: Model failover
weight: 40
description: Priority-based failover across LLM providers (automatic fallback when models fail or are rate-limited).
test:
  failover:
  - file: content/docs/kubernetes/main/install/helm.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: content/docs/kubernetes/main/llm/failover.md
    path: failover
---

{{< reuse "agw-docs/pages/agentgateway/llm/failover.md" >}}