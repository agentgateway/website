---
title: Rate limiting for LLMs
weight: 80
description: Control LLM costs with token-based rate limiting and request-based limits.
test:
  llm-token-rate-limit:
  - file: content/docs/kubernetes/main/install/helm.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: content/docs/kubernetes/main/llm/rate-limit.md
    path: llm-token-rate-limit
---

{{< reuse "agw-docs/pages/agentgateway/llm/rate-limit.md" >}}
