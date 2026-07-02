---
title: vLLM
weight: 30
description: Configure agentgateway to route traffic to vLLM for self-hosted model inference
test:
  vllm-provider-setup:
  - file: ${versionRoot}/install/helm.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/llm/providers/vllm.md
    path: vllm-provider-setup
---

{{< callout type="info" >}}
This guide shows the simple OpenAI-compatible configuration for vLLM. If you
want to declare explicit format support, set per-format paths, or route to vLLM
through an InferencePool, use a
[custom provider]({{< link-hextra path="/llm/providers/custom/" >}}).
{{< /callout >}}

{{< reuse "agw-docs/pages/agentgateway/llm/providers/vllm.md" >}}
