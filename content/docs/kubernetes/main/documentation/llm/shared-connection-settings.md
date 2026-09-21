---
title: Share connection settings
weight: 36
description: Reduce duplicated authentication, TLS, and tunnel settings between an AI provider group and other backends that reach the same endpoint.
test:
  shared-connection-settings:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - path: shared-connection-settings
---

{{< reuse "agw-docs/pages/agentgateway/llm/shared-connection-settings.md" >}}
