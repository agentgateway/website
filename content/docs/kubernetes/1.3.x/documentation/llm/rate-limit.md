---
title: Rate limiting for LLMs
weight: 80
description: Control LLM costs with token-based rate limiting and request-based limits.
test:
  llm-token-rate-limit:
  - file: ${versionRoot}/documentation/install/helm.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: ${versionRoot}/documentation/llm/rate-limit.md
    path: llm-token-rate-limit
---

{{< reuse "agw-docs/pages/agentgateway/llm/rate-limit.md" >}}
