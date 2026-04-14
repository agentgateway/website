---
title: Request transformations
weight: 70
description: Dynamically compute and set LLM request fields using CEL expressions.
test:
  llm-transformations:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/llm/providers/openai.md
    path: openai-setup
  - file: content/docs/kubernetes/latest/llm/transformations.md
    path: llm-transformations
  llm-model-headers:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/llm/providers/openai.md
    path: openai-setup
  - file: content/docs/kubernetes/latest/llm/transformations.md
    path: llm-model-headers
  llm-context-vars:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/llm/providers/openai.md
    path: openai-setup
  - file: content/docs/kubernetes/latest/llm/transformations.md
    path: llm-context-vars
---

{{< reuse "agw-docs/pages/agentgateway/llm/transformations.md" >}}
