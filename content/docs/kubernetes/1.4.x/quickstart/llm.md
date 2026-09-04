---
title: LLM (OpenAI)
weight: 11
description: Route requests to OpenAI's chat completions API with agentgateway on Kubernetes.
test:
  openai:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/quickstart/llm.md
    path: openai-setup
---

{{< reuse "agw-docs/pages/agentgateway/quickstart/llm.md" >}}
