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
  - file: ${versionRoot}/traffic-management/route-delegation/header-query.md
    path: route-delegation-prereq
  - file: ${versionRoot}/traffic-management/route-delegation/header-query.md
    path: header-query
---

{{< reuse "agw-docs/pages/traffic-management/route-delegation/header-query.md" >}}
