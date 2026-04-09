---
title: vLLM
weight: 30
description: Configure agentgateway to route traffic to vLLM for self-hosted model inference
test:
  vllm-provider-setup:
  - file: content/docs/kubernetes/main/install/helm.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/llm/providers/vllm.md
    path: vllm-provider-setup
---

{{< reuse "agw-docs/pages/agentgateway/llm/providers/vllm.md" >}}
