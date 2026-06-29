---
title: Header and query match
weight: 40
description: Use header and query matchers in a route delegation setup.
test:
  header-query:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - path: route-delegation-prereq
  - path: header-query
---

{{< reuse "agw-docs/pages/traffic-management/route-delegation/header-query.md" >}}
