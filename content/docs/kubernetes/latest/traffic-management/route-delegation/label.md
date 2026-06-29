---
title: Delegation via labels
weight: 20
description: Use labels to delegate traffic to child HTTPRoutes with the `<key>=<value>` syntax.
test:
  label:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - path: route-delegation-prereq
  - path: label
---

{{< reuse "agw-docs/pages/traffic-management/route-delegation/label.md" >}}
