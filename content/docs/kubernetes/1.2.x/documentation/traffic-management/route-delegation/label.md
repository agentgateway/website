---
title: Delegation via labels
weight: 20
description: Use labels to delegate traffic to child HTTPRoutes with the `<key>=<value>` syntax.
test:
  label:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/traffic-management/route-delegation/label.md
    path: route-delegation-prereq
  - file: content/docs/kubernetes/latest/traffic-management/route-delegation/label.md
    path: label
---

{{< reuse "agw-docs/pages/traffic-management/route-delegation/label.md" >}}
