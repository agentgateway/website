---
title: vLLM
weight: 30
description: Configure agentgateway to route traffic to vLLM for self-hosted model inference
---

> [!NOTE]
> This guide shows the simple OpenAI-compatible configuration for vLLM. If you
> want to declare explicit format support, set per-format paths, or route to vLLM
> through an InferencePool, use a
> [custom provider]({{< link-hextra path="/integrations/llm/providers/custom/" >}}).

{{< reuse "agw-docs/pages/agentgateway/llm/providers/vllm.md" >}}
