---
title: vLLM
weight: 30
description: Configure agentgateway to route traffic to vLLM for self-hosted model inference
test:
  vllm-provider-setup:
  - file: content/docs/kubernetes/latest/install/helm.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/llm/providers/vllm.md
    path: vllm-provider-setup
---

{{< reuse "agw-docs/pages/agentgateway/llm/providers/vllm.md" >}}
