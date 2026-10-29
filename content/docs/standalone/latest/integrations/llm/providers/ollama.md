---
title: Ollama
weight: 15
icon: /integrations/providers/bw/ollama.svg
description: Configure agentgateway to route LLM traffic to Ollama for local model inference
---

{{< reuse "agw-docs/pages/agentgateway/llm/providers/ollama-standalone.md" >}}

> [!NOTE]
> Local providers like Ollama usually run over HTTP and do not require `llm.models[].auth` or `llm.models[].tls`. If your Ollama endpoint is behind HTTPS or requires authentication, configure `llm.models[].tls` and `llm.models[].auth` like any other upstream provider.
