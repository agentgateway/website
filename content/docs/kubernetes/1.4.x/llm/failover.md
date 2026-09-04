---
title: Model failover
weight: 40
description: Priority-based failover across LLM providers (automatic fallback when models fail or are rate-limited).
test:
  failover:
  - file: ${versionRoot}/install/helm.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: ${versionRoot}/llm/failover.md
    path: failover
---

{{< reuse "agw-docs/pages/agentgateway/llm/failover.md" >}}
