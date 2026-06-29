---
title: Native Gateway API policies
weight: 10
description: Learn how Kubernetes Gateway API policies, such as request timeouts, are inherited and overridden along the route delegation chain.
test:
  native-policies:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/traffic-management/route-delegation/inheritance/native-policies.md
    path: route-delegation-prereq
  - file: ${versionRoot}/traffic-management/route-delegation/inheritance/native-policies.md
    path: native-policies
---

{{< reuse "agw-docs/pages/traffic-management/route-delegation/inheritance/native-policies.md" >}}
