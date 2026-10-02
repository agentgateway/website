---
title: Inject LLM model headers
weight: 47
description: Detect model fallback by injecting the requested and actual LLM model names as response headers using llm.requestModel and llm.responseModel CEL variables.
test:
  llm-transformations:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/integrations/llm/providers/openai.md
    path: openai-setup
  - file: ${versionRoot}/documentation/traffic-management/transformations/llm-model-headers.md
    path: llm-transformations

  llm-model-headers:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/integrations/llm/providers/openai.md
    path: openai-setup
  - file: ${versionRoot}/documentation/traffic-management/transformations/llm-model-headers.md
    path: llm-model-headers
---

{{< reuse "agw-docs/pages/agentgateway/llm/transformations.md" >}}
