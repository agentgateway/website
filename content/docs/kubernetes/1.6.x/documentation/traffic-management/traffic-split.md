---
title: Traffic splitting
weight: 60
description: Set up A/B testing, traffic splitting, and canary deployments using weighted routing.
test:
  traffic-split-llm-models:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/integrations/llm/providers/openai.md
    path: openai-setup
  - file: ${versionRoot}/documentation/traffic-management/traffic-split.md
    path: traffic-split-llm
---

{{< reuse "agw-docs/pages/traffic-management/traffic-split.md" >}}
