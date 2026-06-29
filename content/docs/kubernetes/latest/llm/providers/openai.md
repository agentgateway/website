---
title: OpenAI
weight: 20
description: Configure OpenAI as an LLM provider for agentgateway.
test:
  openai-setup:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - path: openai-setup
---

{{< reuse "agw-docs/pages/agentgateway/llm/providers/openai.md" >}}