---
title: Multi-level delegation
weight: 30
description: Create a 3-level route delegation hierarchy with a parent, child, and grandchild HTTPRoute.
test:
  multi-level:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/traffic-management/route-delegation/multi-level-delegation.md
    path: route-delegation-prereq
  - file: content/docs/kubernetes/latest/traffic-management/route-delegation/multi-level-delegation.md
    path: multi-level
---

{{< reuse "agw-docs/pages/traffic-management/route-delegation/multi-level-delegation.md" >}}
