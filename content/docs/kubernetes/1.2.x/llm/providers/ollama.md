---
title: Ollama
weight: 25
description: Configure agentgateway to route LLM traffic to Ollama for local model inference
test:
  ollama-provider-setup:
  - file: content/docs/kubernetes/latest/install/helm.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/llm/providers/ollama.md
    path: ollama-provider-setup
---

{{< reuse "agw-docs/pages/agentgateway/llm/providers/ollama.md" >}}
