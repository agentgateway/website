---
title: Upgrade
weight: 20
description: Upgrade the control plane and any gateway proxies that run in your cluster.
test:
  upgrade:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/latest/operations/upgrade.md
    path: upgrade
---

{{< reuse "agw-docs/pages/operations/upgrade.md" >}}
