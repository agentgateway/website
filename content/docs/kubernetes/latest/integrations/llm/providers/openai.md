---
title: OpenAI
weight: 20
description: Configure OpenAI as an LLM provider for agentgateway.
test:
  openai-setup:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/integrations/llm/providers/openai.md
    path: openai-setup
---

{{< reuse "agw-docs/pages/agentgateway/llm/providers/openai.md" >}}