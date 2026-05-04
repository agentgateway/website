---
title: OpenAI Realtime
weight: 47
description: Proxy OpenAI Realtime API WebSocket traffic and track token usage.
test:
  realtime:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/llm/providers/openai.md
    path: openai-setup
  - file: content/docs/kubernetes/latest/llm/realtime.md
    path: realtime
---

{{< reuse "agw-docs/pages/agentgateway/llm/realtime.md" >}}
