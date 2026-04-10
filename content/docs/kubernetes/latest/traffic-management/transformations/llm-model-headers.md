---
title: Inject LLM model headers
weight: 47
description: Detect model fallback by injecting the requested and actual LLM model names as response headers using llm.requestModel and llm.responseModel CEL variables.
test:
  llm-transformations:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: content/docs/kubernetes/latest/traffic-management/transformations/llm-model-headers.md
    path: llm-transformations

  llm-model-headers:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: content/docs/kubernetes/latest/traffic-management/transformations/llm-model-headers.md
    path: llm-model-headers
---

{{< reuse "agw-docs/pages/agentgateway/llm/transformations.md" >}}

