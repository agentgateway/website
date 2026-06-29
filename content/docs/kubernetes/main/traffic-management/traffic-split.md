---
title: Traffic splitting
weight: 60
description: Set up A/B testing, traffic splitting, and canary deployments using weighted routing.
test:
  traffic-split-llm-models:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/llm/providers/openai.md
    path: openai-setup
  - file: ${versionRoot}/traffic-management/traffic-split.md
    path: traffic-split-llm
---

{{< reuse "agw-docs/pages/traffic-management/traffic-split.md" >}}
