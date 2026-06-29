---
title: Metrics and logs
weight: 95
description: View LLM-specific metrics and access logs for token usage and request monitoring.
test:
  llm-observability:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/llm/providers/openai.md
    path: openai-setup
  - path: llm-observability
---

{{< reuse "agw-docs/pages/agentgateway/llm/observability.md" >}}