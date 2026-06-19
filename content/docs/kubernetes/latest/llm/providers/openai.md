---
title: OpenAI
weight: 20
description: Configure OpenAI as an LLM provider for agentgateway.
test:
  openai-setup:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/llm/providers/openai.md
    path: openai-setup
---

{{< reuse "agw-docs/pages/agentgateway/llm/providers/openai.md" >}}