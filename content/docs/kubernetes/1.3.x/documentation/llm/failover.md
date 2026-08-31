---
title: Model failover
weight: 40
description: Priority-based failover across LLM providers (automatic fallback when models fail or are rate-limited).
test:
  failover:
  - file: ${versionRoot}/documentation/install/helm.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: ${versionRoot}/documentation/llm/failover.md
    path: failover
---

{{< reuse "agw-docs/pages/agentgateway/llm/failover.md" >}}
