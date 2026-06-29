---
title: Basic example
weight: 10
description: Set up basic route delegation between a parent HTTPRoute and two child HTTPRoutes.
test:
  basic:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - path: route-delegation-prereq
  - path: basic
---

{{< reuse "agw-docs/pages/traffic-management/route-delegation/basic.md" >}}
