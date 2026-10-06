---
title: Monitor proxy config rejections
description: Monitor and troubleshoot proxy configuration rejections with metrics and events.
weight: 30
test:
  nacks:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/observability/metrics/nacks.md
    path: nacks
# This page used to be `observability/nacks.md`. One alias per old URL shape: the
# pre-docTabs layout, then the docTabs layout before the page moved under
# `metrics/`. Aliases are relative to the parent of this page's URL, so a copied
# version tree redirects inside itself. Do not write
# `/docs/<section>/<version>/...`: that prefix goes stale when the tree is copied
# for a release. A bare `/...` alias builds at the site root, where every version
# tree collides.
aliases:
  - ../../../observability/nacks/
  - ../nacks/
---

{{< reuse "agw-docs/pages/observability/metrics/nacks.md" >}}

