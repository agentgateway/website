---
title: Ollama
weight: 25
description: Configure agentgateway to route LLM traffic to Ollama for local model inference
test:
  ollama-provider-setup:
  - file: content/docs/kubernetes/main/install/helm.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/llm/providers/ollama.md
    path: ollama-provider-setup
---

{{< reuse "agw-docs/pages/agentgateway/llm/providers/ollama2.2+.md" >}}
