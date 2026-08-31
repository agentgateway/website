---
title: vLLM
weight: 30
description: Configure agentgateway to route traffic to vLLM for self-hosted model inference
test:
  vllm-provider-setup:
  - file: ${versionRoot}/documentation/install/helm.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/llm/providers/vllm.md
    path: vllm-provider-setup
---

> [!NOTE]
> This guide shows the simple OpenAI-compatible configuration for vLLM. If you
> want to declare explicit format support, set per-format paths, or route to vLLM
> through an InferencePool, use a
> [custom provider]({{< link-hextra path="/documentation/llm/providers/custom/" >}}).

{{< reuse "agw-docs/pages/agentgateway/llm/providers/vllm.md" >}}
