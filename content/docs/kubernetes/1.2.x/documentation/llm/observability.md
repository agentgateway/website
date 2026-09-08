---
title: Metrics and logs
weight: 95
description: View LLM-specific metrics and access logs for token usage and request monitoring.
test:
  llm-observability:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/integrations/llm/providers/openai.md
    path: openai-setup
  - file: content/docs/kubernetes/latest/documentation/llm/observability.md
    path: llm-observability
---

{{< reuse "agw-docs/pages/agentgateway/llm/observability.md" >}}