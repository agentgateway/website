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
  - file: ${versionRoot}/llm/observability.md
    path: llm-observability
---

{{< reuse "agw-docs/pages/agentgateway/llm/observability.md" >}}

## Learn more

- [Observability overview]({{< link-hextra path="/observability/" >}}) for metrics, traces, and access logs.
- [LLM observability integrations]({{< link-hextra path="/integrations/llm-observability/" >}}) for external observability platforms.
