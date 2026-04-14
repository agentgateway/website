---
title: Request transformations
weight: 70
description: Dynamically compute and set LLM request fields using CEL expressions.
test:
  llm-transformations:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: content/docs/kubernetes/main/llm/transformations.md
    path: llm-transformations
  llm-model-headers:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: content/docs/kubernetes/main/llm/transformations.md
    path: llm-model-headers
  llm-context-vars:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: content/docs/kubernetes/main/llm/transformations.md
    path: llm-context-vars
---

{{< reuse "agw-docs/pages/agentgateway/llm/transformations.md" >}}
