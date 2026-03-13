---
title: Traffic splitting
weight: 60
description: Set up A/B testing, traffic splitting, and canary deployments using weighted routing.
test:
  traffic-split-llm-models:
  - file: content/docs/kubernetes/latest/install/helm.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/llm/providers/openai.md
    path: openai-setup
  - file: content/docs/kubernetes/main/traffic-management/traffic-split.md
    path: traffic-split-llm
---

{{< reuse "agw-docs/pages/traffic-management/traffic-split.md" >}}
