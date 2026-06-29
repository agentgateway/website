---
title: OpenAI Realtime
weight: 47
description: Proxy OpenAI Realtime API WebSocket traffic and track token usage.
test:
  realtime:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/llm/providers/openai.md
    path: openai-setup
  - path: realtime
---

{{< reuse "agw-docs/pages/agentgateway/llm/realtime.md" >}}
