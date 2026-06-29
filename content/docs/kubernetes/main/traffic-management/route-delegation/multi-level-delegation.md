---
title: Multi-level delegation
weight: 30
description: Create a 3-level route delegation hierarchy with a parent, child, and grandchild HTTPRoute.
test:
  multi-level:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/traffic-management/route-delegation/multi-level-delegation.md
    path: route-delegation-prereq
  - file: ${versionRoot}/traffic-management/route-delegation/multi-level-delegation.md
    path: multi-level
---

{{< reuse "agw-docs/pages/traffic-management/route-delegation/multi-level-delegation.md" >}}
