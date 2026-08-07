---
title: Inject LLM model headers
weight: 47
description: Detect model fallback by injecting the requested and actual LLM model names as response headers using llm.requestModel and llm.responseModel CEL variables.
test:
  llm-transformations:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/llm/providers/openai.md
    path: openai-setup
  - file: ${versionRoot}/traffic-management/transformations/llm-model-headers.md
    path: llm-transformations

  llm-model-headers:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/llm/providers/openai.md
    path: openai-setup
  - file: ${versionRoot}/traffic-management/transformations/llm-model-headers.md
    path: llm-model-headers
---

{{< reuse "agw-docs/pages/agentgateway/llm/transformations.md" >}}
