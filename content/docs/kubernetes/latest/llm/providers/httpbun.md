---
title: Mock LLM with httpbun
weight: 100
description: Set up httpbun as a mock OpenAI-compatible LLM backend for testing without API keys.
test:
  setup-httpbun-llm:
  - file: ${versionRoot}/install/helm.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - path: setup-httpbun-llm
---

{{< reuse "agw-docs/pages/agentgateway/llm/providers/httpbun.md" >}}

