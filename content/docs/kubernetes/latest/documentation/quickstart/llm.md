---
title: LLM (OpenAI)
weight: 11
description: Expose OpenAI models through agentgateway on Kubernetes and send a chat completion request.
test:
  quickstart-llm:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/quickstart/llm.md
    path: quickstart-llm
---

{{< reuse "agw-docs/pages/agentgateway/quickstart/llm-models.md" >}}
