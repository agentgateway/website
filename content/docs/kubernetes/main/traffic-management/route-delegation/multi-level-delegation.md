---
title: Multi-level delegation
weight: 30
description: Create a 3-level route delegation hierarchy with a parent, child, and grandchild HTTPRoute.
test:
  multi-level:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/traffic-management/route-delegation/multi-level-delegation.md
    path: route-delegation-prereq
  - file: content/docs/kubernetes/main/traffic-management/route-delegation/multi-level-delegation.md
    path: multi-level
---

{{< reuse "agw-docs/pages/traffic-management/route-delegation/multi-level-delegation.md" >}}
