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
  - path: route-delegation-prereq
  - path: native-policies
---

{{< reuse "agw-docs/pages/traffic-management/route-delegation/inheritance/native-policies.md" >}}
