---
title: Buffering
weight: 10
description: Buffer requests and responses for inspection or replay.
test:
  buffering:
    type: [schema, functional]
    steps:
    - file: ${versionRoot}/documentation/quickstart/install.md
      path: experimental
    - file: ${versionRoot}/documentation/setup/gateway.md
      path: all
    - file: ${versionRoot}/documentation/traffic-management/buffering.md
      path: buffering
---

{{< reuse "agw-docs/pages/traffic-management/buffering.md" >}}
