---
title: Content-based routing
weight: 45
description: Route requests to different LLM backends based on request body content, such as the requested model name.
test:
  content-routing-model:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - path: content-routing
---

{{< reuse "agw-docs/pages/agentgateway/llm/content-routing.md" >}}
