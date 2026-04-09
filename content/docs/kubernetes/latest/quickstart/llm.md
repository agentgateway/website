---
title: LLM (OpenAI)
weight: 11
description: Route requests to OpenAI's chat completions API with agentgateway on Kubernetes.
test:
  openai:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/main/quickstart/llm.md
    path: openai-setup
---

{{< reuse "agw-docs/pages/agentgateway/quickstart/llm.md" >}}
