---
title: Ollama
weight: 25
description: Configure agentgateway to route LLM traffic to Ollama for local model inference
test:
  ollama-provider-setup:
  - file: ${versionRoot}/install/helm.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/llm/providers/ollama.md
    path: ollama-provider-setup
---

{{< callout type="info" >}}
This guide shows the simple OpenAI-compatible configuration for Ollama. To
declare multiple Ollama API formats, such as chat completions and messages, use
a [custom provider]({{< link-hextra path="/llm/providers/custom/" >}}).
{{< /callout >}}

{{< reuse "agw-docs/pages/agentgateway/llm/providers/ollama.md" >}}
