---
title: Request transformations
weight: 70
description: Dynamically compute and set LLM request fields using CEL expressions.
test:
  llm-transformations:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/llm/providers/openai.md
    path: openai-setup
  - file: ${versionRoot}/llm/transformations.md
    path: llm-transformations
  llm-model-headers:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/llm/providers/openai.md
    path: openai-setup
  - file: ${versionRoot}/llm/transformations.md
    path: llm-model-headers
---

{{< reuse "agw-docs/pages/agentgateway/llm/transformations.md" >}}
