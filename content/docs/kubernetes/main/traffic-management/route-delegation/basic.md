---
title: Basic example
weight: 10
description: Set up basic route delegation between a parent HTTPRoute and two child HTTPRoutes.
test:
  basic:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/traffic-management/route-delegation/basic.md
    path: route-delegation-prereq
  - file: content/docs/kubernetes/main/traffic-management/route-delegation/basic.md
    path: basic
---

{{< reuse "agw-docs/pages/traffic-management/route-delegation/basic.md" >}}
