---
title: Upgrade
weight: 20
description: Upgrade the control plane and any gateway proxies that run in your cluster.
test:
  upgrade:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/operations/upgrade.md
    path: upgrade
---

{{< reuse "agw-docs/pages/operations/upgrade.md" >}}
