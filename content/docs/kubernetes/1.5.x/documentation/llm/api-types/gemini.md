---
title: Gemini
weight: 33
description: Send requests through agentgateway in the native Gemini wire format, including streaming and token counting.
test:
  gemini-inbound:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - path: gemini-inbound
---

{{< reuse "agw-docs/pages/agentgateway/llm/api-types/gemini.md" >}}
