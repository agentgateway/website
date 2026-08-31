---
title: Delegation via labels
weight: 20
description: Use labels to delegate traffic to child HTTPRoutes with the `<key>=<value>` syntax.
test:
  label:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/traffic-management/route-delegation/label.md
    path: route-delegation-prereq
  - file: ${versionRoot}/documentation/traffic-management/route-delegation/label.md
    path: label
---

{{< reuse "agw-docs/pages/traffic-management/route-delegation/label.md" >}}
