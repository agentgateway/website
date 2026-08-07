---
title: Header and query match
weight: 40
description: Use header and query matchers in a route delegation setup.
test:
  header-query:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/traffic-management/route-delegation/header-query.md
    path: route-delegation-prereq
  - file: content/docs/kubernetes/latest/traffic-management/route-delegation/header-query.md
    path: header-query
---

{{< reuse "agw-docs/pages/traffic-management/route-delegation/header-query.md" >}}
