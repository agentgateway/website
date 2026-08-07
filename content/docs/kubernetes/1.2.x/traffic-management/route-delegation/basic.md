---
title: Basic example
weight: 10
description: Set up basic route delegation between a parent HTTPRoute and two child HTTPRoutes.
test:
  basic:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/traffic-management/route-delegation/basic.md
    path: route-delegation-prereq
  - file: content/docs/kubernetes/latest/traffic-management/route-delegation/basic.md
    path: basic
---

{{< reuse "agw-docs/pages/traffic-management/route-delegation/basic.md" >}}
