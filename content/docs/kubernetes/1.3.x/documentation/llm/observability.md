---
title: Metrics and logs
weight: 95
description: View LLM-specific metrics and access logs for token usage and request monitoring.
test:
  llm-observability:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/integrations/llm/providers/openai.md
    path: openai-setup
  - file: ${versionRoot}/documentation/llm/observability.md
    path: llm-observability
---

{{< reuse "agw-docs/pages/agentgateway/llm/observability.md" >}}

## Learn more

- [Observability overview]({{< link-hextra path="/observability/" >}}) for metrics, traces, and access logs.
- [LLM observability integrations]({{< link-hextra path="/integrations/llm-observability/" >}}) for external observability platforms.
