---
title: Ollama
weight: 25
description: Configure agentgateway to route LLM traffic to Ollama for local model inference
test:
  ollama-provider-setup:
  - file: ${versionRoot}/documentation/install/helm.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/llm/providers/ollama.md
    path: ollama-provider-setup
---

> [!NOTE]
> This guide shows the simple OpenAI-compatible configuration for Ollama. To
> declare multiple Ollama API formats, such as chat completions and messages, use
> a [custom provider]({{< link-hextra path="/documentation/llm/providers/custom/" >}}).

{{< reuse "agw-docs/pages/agentgateway/llm/providers/ollama.md" >}}
