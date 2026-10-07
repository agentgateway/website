---
title: Content-based routing
weight: 45
description: Route requests to different LLM backends based on request body content, such as the requested model name.
test:
  content-routing-model:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/llm/content-routing.md
    path: content-routing
---

{{< reuse "agw-docs/pages/agentgateway/llm/content-routing.md" >}}
