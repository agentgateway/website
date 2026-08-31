---
title: Request transformations
weight: 70
description: Dynamically compute and set LLM request fields using CEL expressions.
test:
  llm-transformations:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/llm/providers/openai.md
    path: openai-setup
  - file: ${versionRoot}/documentation/llm/transformations.md
    path: llm-transformations
  llm-model-headers:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/llm/providers/openai.md
    path: openai-setup
  - file: ${versionRoot}/documentation/llm/transformations.md
    path: llm-model-headers
---

{{< reuse "agw-docs/pages/agentgateway/llm/transformations.md" >}}
